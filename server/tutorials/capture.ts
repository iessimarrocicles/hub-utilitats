import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Box, CaptureEvent, CaptureResult, SceneAudio, SceneTiming, Storyboard } from '../../src/utilities/tutorials/types.ts'
import { runOk } from '../lib/run.ts'
import { estimateSeconds, performAction, type ActionContext } from './actions.ts'
import { settle } from './analyze.ts'
import { gotoWithRetry, launch, resolve, VIEWPORT } from './browser.ts'

const SCALE = 2
const FPS = 60
/** Silenci abans de la primera acció i després de l'última frase. */
const LEAD = 0.6
const TAIL = 0.45

export interface ScenePlan {
  /** Durada objectiu de l'escena (la de la veu). */
  duration: number
  /** Espera abans de cada acció. */
  gaps: number[]
}

/**
 * Reparteix les accions dins del temps de la locució: comencen poc després que la
 * veu, amb pauses iguals entre elles, i deixen aire al final perquè es vegen els resultats.
 */
export function planScene(actionSeconds: number[], audioSeconds: number): ScenePlan {
  const busy = actionSeconds.reduce((a, b) => a + b, 0)
  const n = actionSeconds.length
  if (n === 0) return { duration: Math.max(audioSeconds + TAIL, 1.5), gaps: [] }
  const room = Math.max(0, audioSeconds * 0.85 - LEAD - busy)
  const gap = Math.min(2.5, Math.max(0.35, room / n))
  return { duration: Math.max(audioSeconds + TAIL, LEAD + busy + gap * n + TAIL), gaps: actionSeconds.map((_, i) => (i === 0 ? LEAD : gap)) }
}

export async function captureStoryboard(
  board: Storyboard,
  audio: SceneAudio[],
  outDir: string,
  opts: { useSession: boolean; stage: (s: string, p?: number | null) => void },
): Promise<CaptureResult> {
  const framesDir = path.join(outDir, 'frames')
  await rm(framesDir, { recursive: true, force: true })
  await mkdir(framesDir, { recursive: true })
  const audioBy = new Map(audio.map((a) => [a.sceneId, a]))
  const scenesTotal = board.chapters.reduce((n, c) => n + c.scenes.length, 0)

  const { browser, context, page } = await launch({ scale: SCALE, useSession: opts.useSession })
  const frames: { file: string; t: number }[] = []
  const writes: Promise<void>[] = []
  const events: CaptureEvent[] = []
  const timings: SceneTiming[] = []
  const focus: Record<string, Box | undefined> = {}

  try {
    opts.stage('Obrint la pàgina per a gravar', 0)
    // Amaga el cursor del sistema i les barres en cada document: el cursor es pinta després, suau.
    await context.addInitScript(() => {
      const css = '*{cursor:none!important;scrollbar-width:none!important} ::-webkit-scrollbar{display:none}'
      const add = () => {
        const s = document.createElement('style')
        s.textContent = css
        document.head.appendChild(s)
      }
      if (document.head) add()
      else document.addEventListener('DOMContentLoaded', add)
    })
    await gotoWithRetry(page, board.startUrl)
    await settle(page)

    const cdp = await context.newCDPSession(page)
    let wallStart = 0
    let n = 0
    cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
      const t = (f.metadata.timestamp ?? Date.now() / 1000) - wallStart
      const file = `f${String(++n).padStart(6, '0')}.jpg`
      frames.push({ file, t })
      writes.push(writeFile(path.join(framesDir, file), Buffer.from(f.data, 'base64')))
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
    })
    wallStart = Date.now() / 1000
    const clock0 = performance.now()
    const now = () => (performance.now() - clock0) / 1000
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 94,
      maxWidth: VIEWPORT.width * SCALE,
      maxHeight: VIEWPORT.height * SCALE,
      everyNthFrame: 1,
    })
    // Força un primer fotograma encara que la pàgina estiga quieta.
    await page.evaluate(() => document.body.style.setProperty('outline', '0px solid transparent'))
    await page.waitForTimeout(300)

    const ctx: ActionContext = { human: true, sceneId: '', now, mouse: { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.7 }, log: (e) => events.push(e) }
    let done = 0
    for (const chapter of board.chapters) {
      for (const scene of chapter.scenes) {
        opts.stage(`Gravant l’escena ${done + 1} de ${scenesTotal}`, done / scenesTotal)
        ctx.sceneId = scene.id
        const voice = audioBy.get(scene.id)?.duration ?? scene.narration.split(/\s+/).length / 2.4
        const plan = planScene(scene.actions.map(estimateSeconds), voice)
        const start = now()
        for (const [i, action] of scene.actions.entries()) {
          await page.waitForTimeout(plan.gaps[i] * 1000)
          await performAction(page, action, ctx).catch((err: Error) => {
            throw new Error(`Escena «${scene.narration.slice(0, 50)}…»: ${err.message.split('\n')[0]}`)
          })
        }
        // Caixa del focus: la de l'última acció sobre un element, o la del localitzador de focus.
        const lastBox = [...events].reverse().find((e) => e.sceneId === scene.id && e.box)?.box
        if (scene.focus) {
          const b = await resolve(page, scene.focus).boundingBox({ timeout: 1500 }).catch(() => null)
          focus[scene.id] = b ? { x: b.x, y: b.y, width: b.width, height: b.height } : lastBox
        } else focus[scene.id] = lastBox
        const remaining = start + plan.duration - now()
        if (remaining > 0) await page.waitForTimeout(remaining * 1000)
        timings.push({ sceneId: scene.id, chapterId: chapter.id, start, end: now() })
        done++
      }
    }
    await cdp.send('Page.stopScreencast')
    await page.waitForTimeout(200)
    await Promise.all(writes)
    const duration = now()

    opts.stage('Muntant el vídeo de la captura', 0.97)
    const file = 'captura.mp4'
    await encodeFrames(frames, duration, framesDir, path.join(outDir, file))
    await rm(framesDir, { recursive: true, force: true })
    return {
      file,
      width: VIEWPORT.width * SCALE,
      height: VIEWPORT.height * SCALE,
      viewport: { ...VIEWPORT },
      fps: FPS,
      duration,
      events,
      scenes: timings,
      focus,
    }
  } finally {
    await browser.close()
  }
}

/**
 * Filtre de la captura. L'escalat va ABANS de fps: així cada imatge del navegador s'escala una vegada
 * i les còpies que fps fa per omplir els 60 fotogrames per segon són referències, no fotogrames 4K nous.
 * A l'inrevés, una imatge que dura 8 s generava 480 fotogrames de 26 MB i ffmpeg passava de 16 GB.
 */
export function captureFilter(width: number, height: number, fps: number): string {
  return `scale=${width}:${height}:flags=lanczos,format=yuv420p,fps=${fps}`
}

/** Fotogrames irregulars del screencast → vídeo a 60 fps constants, alta qualitat i fàcil de buscar. */
async function encodeFrames(frames: { file: string; t: number }[], duration: number, dir: string, out: string): Promise<void> {
  if (frames.length === 0) throw new Error('El navegador no ha enviat cap fotograma.')
  const sorted = [...frames].sort((a, b) => a.t - b.t)
  const lines: string[] = []
  sorted.forEach((f, i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1].t : duration
    const start = i === 0 ? 0 : f.t
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - start).toFixed(4)}`)
  })
  lines.push(`file '${sorted.at(-1)!.file}'`)
  await writeFile(path.join(dir, 'list.txt'), lines.join('\n'), 'utf8')
  await runOk(
    'ffmpeg',
    [
      '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt',
      '-vf', captureFilter(VIEWPORT.width * SCALE, VIEWPORT.height * SCALE, FPS),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-g', String(FPS), '-tune', 'stillimage',
      '-t', duration.toFixed(3), '-movflags', '+faststart', out,
    ],
    { cwd: dir, timeoutMs: 60 * 60_000 },
  )
}
