import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { runOk } from '../lib/run.ts'
import type { CompositionInput, CoverInput, GenerateSettings, SceneAudio, Storyboard, StyleTemplate, TutorialProject } from '../../src/utilities/tutorials/types.ts'
import { BUILTIN_TEMPLATES } from '../../src/utilities/tutorials/catalog.ts'
import { estimateSeconds, projectCover } from '../../video/lib/cover.ts'
import { PORT } from '../config.ts'
import type { JobContext } from '../jobs.ts'
import { analyzePage } from './analyze.ts'
import { captureStoryboard } from './capture.ts'
import { hyperframesAvailable, renderTitles, usesHyperframes } from './hyperframes.ts'
import { renderCoverStill, renderTutorial } from './compose.ts'
import { writeScript } from './script.ts'
import { customTemplates, getTutorial, tutorialDir, updateTutorial } from './store.ts'
import { synthesize } from './tts.ts'

export const filesUrl = (id: string, file: string) => `http://127.0.0.1:${PORT}/files/tutorials/${id}/${file.split(path.sep).join('/')}`

export async function findTemplate(id: string): Promise<StyleTemplate> {
  const all = [...(await customTemplates()), ...BUILTIN_TEMPLATES]
  return all.find((t) => t.id === id) ?? BUILTIN_TEMPLATES[0]
}

const scenesOf = (b: Storyboard) => b.chapters.flatMap((c) => c.scenes)

/** Rang de progrés: cada fase ocupa un tros de la barra. */
function sub(ctx: JobContext, from: number, to: number) {
  return (s: string, p?: number | null) => ctx.stage(s, p == null ? null : from + (to - from) * p)
}

/** Analitza la pàgina i escriu el guió. */
export async function analyzeAndScript(id: string, opts: { maxMinutes: number }, ctx: JobContext): Promise<void> {
  const p = await updateTutorial(id, (t) => {
    t.status = 'analitzant'
    t.lastError = undefined
  })
  const dir = path.join(tutorialDir(id), 'analysis')
  const analysis = await analyzePage(p.url, dir, { useSession: p.useSession, onStage: (s) => ctx.stage(s) })
  await updateTutorial(id, (t) => {
    t.analysis = analysis
  })
  const { storyboard, errors } = await writeScript(analysis, dir, {
    brief: p.brief,
    maxMinutes: opts.maxMinutes,
    useSession: p.useSession,
    stage: (s) => ctx.stage(s),
  })
  await updateTutorial(id, (t) => {
    t.storyboard = storyboard
    t.validation = errors.map((e) => ({ sceneId: e.sceneId, error: e.error }))
    t.status = 'guio'
    t.capture = undefined
    t.final = undefined
  })
}

/** Locució de totes les escenes (també serveix per a escoltar-la abans de generar). */
export async function makeVoice(id: string, settings: GenerateSettings, ctx: JobContext, range: [number, number] = [0, 1]): Promise<SceneAudio[]> {
  const p = (await getTutorial(id))!
  if (!p.storyboard) throw new Error('Encara no hi ha guió.')
  const notices: string[] = []
  const audio = await synthesize(
    scenesOf(p.storyboard).map((s) => ({ sceneId: s.id, text: s.narration })),
    settings.voice,
    path.join(tutorialDir(id), 'audio'),
    { stage: sub(ctx, range[0], range[1]), notice: (n) => notices.push(n) },
  )
  await updateTutorial(id, (t) => {
    t.audio = audio
    t.notices = notices
  })
  return audio
}

/** La captura depén de les accions i de la durada de cada locució. */
export function captureKey(board: Storyboard, audio: SceneAudio[], useSession: boolean): string {
  const data = scenesOf(board).map((s) => [s.id, s.actions, s.focus, audio.find((a) => a.sceneId === s.id)?.duration.toFixed(2)])
  return createHash('sha1').update(JSON.stringify([board.startUrl, useSession, data])).digest('hex').slice(0, 16)
}

/**
 * Còpia de la captura a 2560×1440 per als renders que no són 4K: és nítida fins a un zoom
 * d'1,7× en 1080p i el render la descodifica en menys de la meitat de temps que la 4K.
 */
export async function captureProxy(id: string, file: string): Promise<string> {
  const dir = tutorialDir(id)
  const proxy = file.replace(/\.mp4$/, '-1440.mp4')
  const src = path.join(dir, file)
  const dst = path.join(dir, proxy)
  if (existsSync(dst) && (await stat(dst)).mtimeMs >= (await stat(src)).mtimeMs) return proxy
  await runOk(
    'ffmpeg',
    ['-y', '-v', 'error', '-i', file, '-vf', 'scale=2560:1440:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-g', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', proxy],
    { cwd: dir, timeoutMs: 60 * 60_000 },
  )
  return proxy
}

export async function compositionInput(p: TutorialProject, settings: GenerateSettings, captureFile?: string): Promise<CompositionInput> {
  if (!p.storyboard || !p.capture || !p.audio) throw new Error('Falten dades per a compondre el vídeo.')
  const template = await findTemplate(settings.templateId)
  return {
    storyboard: p.storyboard,
    capture: p.capture,
    captureSrc: filesUrl(p.id, captureFile ?? p.capture.file),
    audio: p.audio.map((a) => ({ ...a, src: filesUrl(p.id, `audio/${a.file}`) })),
    template,
    graphics: settings.graphics,
    format: settings.format,
    cover: coverInput(p, settings.coverInVideo !== false),
  }
}

/** Dades de la miniatura d'un projecte: textos, imatge sense fons i si ix al vídeo. */
export function coverInput(p: TutorialProject, inVideo: boolean, seconds?: number): CoverInput {
  return {
    ...projectCover(p),
    image: p.coverImage ? filesUrl(p.id, p.coverImage.file) : undefined,
    inVideo,
    seconds,
  }
}

/** Genera la miniatura com a imatge, sense haver de fer el vídeo. */
export async function makeCoverStill(id: string): Promise<TutorialProject> {
  const p = (await getTutorial(id))!
  const format = p.settings?.format ?? '1080p'
  // Amb vídeo, la durada real; si no, una estimació a partir de la narració.
  const seconds = p.final?.duration ?? (p.storyboard ? estimateSeconds(p.storyboard) : 60)
  const file = `${slug(p.storyboard?.title || p.name)}-miniatura.jpg`
  await renderCoverStill({ cover: coverInput(p, false, seconds), format, seconds }, path.join(tutorialDir(id), file))
  return updateTutorial(id, (t) => {
    t.coverStill = { file, updatedAt: new Date().toISOString() }
  })
}

/** Del guió al vídeo final: veu → captura (si cal) → render. */
export async function generate(id: string, settings: GenerateSettings, ctx: JobContext): Promise<void> {
  let p = await updateTutorial(id, (t) => {
    t.status = 'generant'
    t.settings = settings
    t.lastError = undefined
  })
  if (!p.storyboard) throw new Error('Encara no hi ha guió.')
  const audio = await makeVoice(id, settings, ctx, [0, 0.2])

  const key = captureKey(p.storyboard, audio, p.useSession)
  const dir = tutorialDir(id)
  const stored = p.capture as (TutorialProject['capture'] & { key?: string }) | undefined
  if (!stored || stored.key !== key || !existsSync(path.join(dir, stored.file))) {
    const capture = await captureStoryboard(p.storyboard, audio, dir, { useSession: p.useSession, stage: sub(ctx, 0.2, 0.45) })
    p = await updateTutorial(id, (t) => {
      t.capture = { ...capture, key } as TutorialProject['capture']
    })
  } else {
    ctx.stage('La captura ja està feta: es reaprofita', 0.45)
  }

  p = (await getTutorial(id))!
  let source = p.capture!.file
  if (settings.format !== '4k') {
    ctx.stage('Preparant una còpia lleugera de la captura', 0.46)
    source = await captureProxy(id, source)
  }
  const input = await compositionInput(p, settings, source)

  // Intro i tancament amb HyperFrames quan la plantilla ho demana; si falla, les fa Remotion.
  if (usesHyperframes(input.template, settings.format, settings.graphics)) {
    try {
      if (!(await hyperframesAvailable())) throw new Error('No s’ha trobat l’ordre hyperframes.')
      const clips = await renderTitles(input.template, p.storyboard!, settings.graphics, path.join(dir, 'titles'), (s) => ctx.stage(s, 0.47))
      input.clips = {
        intro: clips.intro ? filesUrl(id, `titles/${clips.intro}`) : undefined,
        outro: clips.outro ? filesUrl(id, `titles/${clips.outro}`) : undefined,
      }
    } catch (err) {
      await updateTutorial(id, (t) => {
        t.notices = [...(t.notices ?? []), `La intro de HyperFrames no s’ha pogut fer i l’ha feta Remotion: ${(err as Error).message.split('\n')[0]}`]
      })
    }
  }
  const name = slug(p.storyboard!.title || p.name)
  const r = await renderTutorial(input, dir, name, { stage: sub(ctx, 0.45, 1) })
  await updateTutorial(id, (t) => {
    t.status = 'final'
    if (r.coverError) t.notices = [...(t.notices ?? []), `La miniatura amb la plantilla ha fallat i s’ha usat un fotograma del vídeo: ${r.coverError}`]
    t.final = {
      file: r.file,
      srt: `${name}.srt`,
      vtt: `${name}.vtt`,
      thumb: `${name}.jpg`,
      duration: r.duration,
      lufs: r.lufs,
      updatedAt: new Date().toISOString(),
    }
  })
}

export function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'tutorial'
  )
}
