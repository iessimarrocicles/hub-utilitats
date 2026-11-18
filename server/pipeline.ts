import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BrandProfile } from '../src/utilities/reels/model.ts'
import type { EditPlan, ServerProject } from '../src/utilities/reels/auto/types.ts'
import { askClaude } from './claude.ts'
import { FONTS_DIR, REFERENCES_DIR } from './config.ts'
import type { JobContext } from './jobs.ts'
import {
  buildAss,
  buildFilterGraph,
  buildPlan,
  keptRanges,
  logoPlacement,
  mapSubtitles,
  outputDuration,
  type ClaudePlan,
} from './lib/edl.ts'
import { EDIT_SCHEMA, LOOK_SCHEMA, editPrompt, lookPrompt, type LookResult } from './lib/prompts.ts'
import {
  cutsPerSecond,
  detectSilences,
  ensureFont,
  extractAudio,
  extractFrame,
  normalizeLoudness,
  probe,
  referenceTimes,
  render,
  transcribe,
} from './media.ts'
import { getLook, listReferences, projectDir, saveLook, updateProject } from './store.ts'

/** Analitza els reels de referència i en trau un look. */
export async function analyzeLook(ctx: JobContext): Promise<void> {
  const refs = await listReferences()
  if (refs.length === 0) throw new Error('Puja almenys un reel de referència.')
  const framesDir = path.join(REFERENCES_DIR, 'frames')
  await mkdir(framesDir, { recursive: true })

  const input: { name: string; frames: { file: string; t: number }[]; cutsPerSecond: number }[] = []
  for (const [k, ref] of refs.entries()) {
    ctx.stage(`Traient fotogrames de «${ref.name}»`, k / refs.length)
    const file = path.join(REFERENCES_DIR, ref.file)
    const frames: { file: string; t: number }[] = []
    for (const t of referenceTimes(ref.duration)) {
      const name = `${ref.id}-${String(t).replace('.', '_')}.jpg`
      await extractFrame(file, t, path.join(framesDir, name))
      frames.push({ file: name, t })
    }
    ctx.stage(`Mesurant el ritme de «${ref.name}»`, (k + 0.5) / refs.length)
    input.push({ name: ref.name, frames, cutsPerSecond: await cutsPerSecond(file, ref.duration) })
  }

  ctx.stage('Claude Code està estudiant les referències. Pot tardar uns minuts.')
  const { output } = await askClaude<LookResult>({
    prompt: lookPrompt(input),
    schema: LOOK_SCHEMA,
    cwd: framesDir,
    tools: ['Read'],
  })
  await saveLook({ ...output, analyzedAt: new Date().toISOString(), references: refs.map((r) => r.name) })
}

/** Del vídeo en brut a la primera proposta, amb previsualització. */
export async function autoEdit(projectId: string, brand: BrandProfile, ctx: JobContext): Promise<void> {
  const dir = projectDir(projectId)
  let project = await updateProject(projectId, (p) => {
    p.status = 'processant'
    p.lastError = undefined
  })
  const raw = path.join(dir, project.rawFile)

  ctx.stage('Llegint el vídeo')
  const media = await probe(raw)
  if (!media.hasAudio) throw new Error('El vídeo no té so: no es pot transcriure.')
  project = await updateProject(projectId, (p) => {
    p.media = { duration: media.duration, width: media.width, height: media.height, hdr: media.hdr }
  })

  ctx.stage('Traient l’àudio')
  const audio = path.join(dir, 'audio.wav')
  await extractAudio(raw, audio)

  ctx.stage('Transcrivint paraula per paraula. La primera vegada descarrega el model de Whisper.', 0)
  const transcript = await transcribe(audio, project.language, path.join(dir, 'transcript.json'), (p) =>
    ctx.stage('Transcrivint paraula per paraula', p),
  )
  if (transcript.words.length === 0) throw new Error('Whisper no ha trobat cap paraula al vídeo.')
  project = await updateProject(projectId, (p) => {
    p.transcript = transcript
  })

  ctx.stage('Mesurant els silencis')
  const silences = await detectSilences(audio, media.duration)

  ctx.stage('Claude Code està decidint els talls i els subtítols. Pot tardar uns minuts.')
  const look = await getLook()
  const { output } = await askClaude<ClaudePlan>({
    prompt: editPrompt({
      words: transcript.words,
      silences,
      duration: media.duration,
      language: transcript.language,
      brand,
      lookNotes: look ? [look.transitions, ...look.notes] : [],
      instructions: project.instructions,
    }),
    schema: EDIT_SCHEMA,
    cwd: dir,
  })
  const plan = buildPlan(transcript.words, media.duration, output)
  if (keptRanges(plan.segments).length === 0) throw new Error('Claude Code no ha deixat cap tram. Revisa les instruccions.')
  await updateProject(projectId, (p) => {
    p.plan = plan
  })

  await renderProject(projectId, brand, 'preview', ctx)
}

/** Munta la previsualització o el vídeo final amb la proposta actual. */
export async function renderProject(projectId: string, brand: BrandProfile, quality: 'preview' | 'final', ctx: JobContext): Promise<void> {
  const dir = projectDir(projectId)
  const project = await updateProject(projectId, (p) => {
    p.status = 'processant'
    p.lastError = undefined
  })
  if (!project.plan || !project.media) throw new Error('Encara no hi ha cap proposta per a muntar.')
  const ranges = keptRanges(project.plan.segments)
  if (ranges.length === 0) throw new Error('Has llevat tots els trams. Activa’n almenys un.')
  const duration = outputDuration(ranges)

  ctx.stage('Preparant les lletres')
  const notices = (await Promise.all([ensureFont(brand.fonts.title.family), ensureFont(brand.fonts.body.family)])).filter(
    (n): n is string => !!n,
  )

  let logo: string | undefined
  if (brand.logo.dataUrl.startsWith('data:image/')) {
    logo = path.join(dir, 'logo.png')
    await writeFile(logo, Buffer.from(brand.logo.dataUrl.split(',')[1] ?? '', 'base64'))
  }

  const width = quality === 'preview' ? 540 : 1080
  const height = quality === 'preview' ? 960 : 1920
  const subtitles = mapSubtitles(project.plan.subtitles, ranges)
  await writeFile(path.join(dir, 'subs.ass'), buildAss({ subtitles, hook: project.plan.hook, brand, duration }), 'utf8')
  const fontsDir = path.relative(dir, FONTS_DIR).split(path.sep).join('/')

  const graph = buildFilterGraph({
    ranges,
    width,
    height,
    hdr: project.media.hdr,
    assFile: 'subs.ass',
    fontsDir,
    logo: logo ? logoPlacement(brand, width, height) : undefined,
  })
  await writeFile(path.join(dir, `graph-${quality}.txt`), graph, 'utf8')

  const output = quality === 'preview' ? 'preview.mp4' : `${baseName(project)}.mp4`
  ctx.stage(quality === 'preview' ? 'Muntant la previsualització' : 'Muntant el vídeo final', 0)
  await render({
    cwd: dir,
    input: project.rawFile,
    logo: logo ? 'logo.png' : undefined,
    graphFile: `graph-${quality}.txt`,
    output,
    quality,
    expectedDuration: duration,
    onProgress: (p) => ctx.progress(quality === 'final' ? p * 0.6 : p),
  })

  if (quality === 'preview') {
    await updateProject(projectId, (p) => {
      p.preview = { file: output, updatedAt: new Date().toISOString(), duration }
      p.status = 'proposta'
      p.notices = notices
    })
    return
  }

  // Còpia neta: el mateix muntatge, sense textos ni logo (per a la skill efectos-reels).
  ctx.stage('Muntant la còpia neta', 0.6)
  const cleanGraph = buildFilterGraph({ ranges, width, height, hdr: project.media.hdr })
  await writeFile(path.join(dir, 'graph-clean.txt'), cleanGraph, 'utf8')
  const clean = `${baseName(project)}-limpio.mp4`
  await render({
    cwd: dir,
    input: project.rawFile,
    graphFile: 'graph-clean.txt',
    output: clean,
    quality: 'final',
    expectedDuration: duration,
    onProgress: (p) => ctx.progress(0.6 + p * 0.35),
  })

  ctx.stage('Ajustant el volum a −14 LUFS', 0.95)
  const loud = await normalizeLoudness(dir, output)
  await normalizeLoudness(dir, clean)
  await updateProject(projectId, (p) => {
    p.final = { file: output, clean, updatedAt: new Date().toISOString(), duration, lufs: loud.lufs, truePeak: loud.truePeak }
    p.status = 'final'
    p.notices = notices
  })
}

export function baseName(p: ServerProject): string {
  const base = p.originalName.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '_')
  return base || 'reel'
}

export function sanitizePlan(plan: EditPlan, duration: number): EditPlan {
  const clamp = (t: number) => Math.max(0, Math.min(duration, Number(t) || 0))
  return {
    ...plan,
    segments: plan.segments
      .map((s) => ({ ...s, start: clamp(s.start), end: clamp(s.end), keep: !!s.keep }))
      .filter((s) => s.end > s.start)
      .sort((a, b) => a.start - b.start),
    subtitles: plan.subtitles
      .map((s) => ({ ...s, start: clamp(s.start), end: clamp(s.end), text: String(s.text ?? ''), highlight: String(s.highlight ?? '') }))
      .filter((s) => s.end > s.start && s.text.trim()),
    hook: { line1: String(plan.hook?.line1 ?? ''), line2: String(plan.hook?.line2 ?? '') },
  }
}
