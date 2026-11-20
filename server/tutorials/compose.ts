import { createHash } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import type { CompositionInput } from '../../src/utilities/tutorials/types.ts'
import { buildTimeline, SIZES, type Timeline } from '../../video/lib/timeline.ts'
import { BROWSER_PATH, ROOT, WORKSPACE } from '../config.ts'
import { runOk } from '../lib/run.ts'
import { normalizeLoudness } from '../media.ts'

const ENTRY = path.join(ROOT, 'video', 'Root.tsx')
const BUNDLE_DIR = path.join(WORKSPACE, 'remotion-bundle')
const SOURCE_DIRS = [path.join(ROOT, 'video'), path.join(ROOT, 'src', 'utilities', 'tutorials')]

/** Empremta dels fitxers de la composició: només es torna a empaquetar si han canviat. */
async function sourcesHash(): Promise<string> {
  const h = createHash('sha1')
  const walk = async (dir: string) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) await walk(p)
      else if (/\.(tsx?|css)$/.test(e.name) && !e.name.includes('.test.')) h.update(p + (await stat(p)).mtimeMs)
    }
  }
  for (const d of SOURCE_DIRS) await walk(d)
  return h.digest('hex').slice(0, 12)
}

let bundling: Promise<string> | null = null

export async function ensureBundle(stage?: (s: string) => void): Promise<string> {
  const hash = await sourcesHash()
  const dir = path.join(BUNDLE_DIR, hash)
  if (existsSync(path.join(dir, 'index.html'))) return dir
  bundling ??= (async () => {
    stage?.('Preparant la composició (només la primera vegada)')
    const { bundle } = await import('@remotion/bundler')
    await rm(BUNDLE_DIR, { recursive: true, force: true })
    return bundle({ entryPoint: ENTRY, outDir: dir })
  })().finally(() => {
    bundling = null
  })
  return bundling
}

/**
 * Navegador per al render. El «headless shell» de Playwright fa les captures de fotograma
 * fins a 5 vegades més ràpid que el Chromium complet; si no hi és, s'usa el complet.
 */
function renderBrowser(): { browserExecutable: string; chromeMode: 'headless-shell' | 'chrome-for-testing' } {
  if (BROWSER_PATH) return { browserExecutable: BROWSER_PATH, chromeMode: 'chrome-for-testing' }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.LOCALAPPDATA ?? os.homedir(), 'ms-playwright')
  try {
    const dirs = readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()
    for (const d of dirs) {
      for (const exe of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-mac-x64/chrome-headless-shell']) {
        const full = path.join(root, d, exe)
        if (existsSync(full)) return { browserExecutable: full, chromeMode: 'headless-shell' }
      }
    }
  } catch {
    /* sense carpeta de navegadors */
  }
  return { browserExecutable: chromium.executablePath(), chromeMode: 'chrome-for-testing' }
}

export interface RenderResult {
  file: string
  duration: number
  lufs: number | null
}

export async function renderTutorial(
  input: CompositionInput,
  outDir: string,
  name: string,
  opts: { stage: (s: string, p?: number | null) => void },
): Promise<RenderResult & { timeline: Timeline }> {
  const serveUrl = await ensureBundle(opts.stage)
  const { selectComposition, renderMedia } = await import('@remotion/renderer')
  const inputProps = input as unknown as Record<string, unknown>
  const common = {
    serveUrl,
    inputProps,
    ...renderBrowser(),
    logLevel: 'warn' as const,
  }
  opts.stage('Preparant el render', 0)
  const composition = await selectComposition({ ...common, id: 'Tutorial' })
  const raw = path.join(outDir, `${name}.render.mp4`)
  const size = SIZES[input.format]
  await renderMedia({
    ...common,
    composition,
    codec: 'h264',
    outputLocation: raw,
    scale: size.scale,
    crf: 16,
    x264Preset: 'slow',
    audioCodec: 'aac',
    audioBitrate: '192k',
    pixelFormat: 'yuv420p',
    concurrency: Math.max(2, Math.min(8, Math.floor(os.cpus().length / 2))),
    timeoutInMilliseconds: 120_000,
    onProgress: ({ progress, renderedFrames }) =>
      opts.stage(`Renderitzant el vídeo (${renderedFrames} de ${composition.durationInFrames} fotogrames)`, 0.05 + progress * 0.85),
  })

  opts.stage('Ajustant el volum a −16 LUFS', 0.92)
  const timeline = buildTimeline(input)
  const final = `${name}.mp4`
  await rename(raw, path.join(outDir, final))
  const loud = await normalizeLoudness(outDir, final, -16)

  opts.stage('Afegint capítols, subtítols i miniatura', 0.97)
  await addChapters(outDir, final, timeline, input.storyboard.title)
  await writeFile(path.join(outDir, `${name}.srt`), toSrt(timeline, input), 'utf8')
  await writeFile(path.join(outDir, `${name}.vtt`), toVtt(timeline, input), 'utf8')
  const firstCapture = timeline.segments.find((s) => s.kind === 'capture')
  const thumbAt = firstCapture ? firstCapture.from + Math.min(4, firstCapture.duration / 2) : 1
  await runOk('ffmpeg', ['-y', '-v', 'error', '-ss', thumbAt.toFixed(2), '-i', final, '-frames:v', '1', '-q:v', '2', `${name}.jpg`], { cwd: outDir })
  return { file: final, duration: timeline.duration, lufs: loud.lufs, timeline }
}

async function addChapters(dir: string, file: string, timeline: Timeline, title: string): Promise<void> {
  if (timeline.chapters.length === 0) return
  const esc = (s: string) => s.replace(/([=;#\\\n])/g, '\\$1')
  const lines = [';FFMETADATA1', `title=${esc(title)}`]
  for (const c of timeline.chapters) {
    lines.push('[CHAPTER]', 'TIMEBASE=1/1000', `START=${Math.round(c.from * 1000)}`, `END=${Math.round(c.to * 1000)}`, `title=${esc(c.title)}`)
  }
  await writeFile(path.join(dir, 'chapters.txt'), lines.join('\n'), 'utf8')
  const tmp = `${file}.chap.mp4`
  await runOk('ffmpeg', ['-y', '-v', 'error', '-i', file, '-i', 'chapters.txt', '-map_metadata', '1', '-map_chapters', '1', '-c', 'copy', '-movflags', '+faststart', tmp], { cwd: dir })
  await rm(path.join(dir, file))
  await rename(path.join(dir, tmp), path.join(dir, file))
  await rm(path.join(dir, 'chapters.txt'))
}

interface Cue {
  start: number
  end: number
  text: string
}

/** Subtítols per frases curtes, amb els temps de cada paraula. */
export function cues(timeline: Timeline, input: Pick<CompositionInput, 'audio'>, maxChars = 46): Cue[] {
  const out: Cue[] = []
  for (const v of timeline.voices) {
    const audio = input.audio.find((a) => a.sceneId === v.sceneId)
    if (!audio) continue
    let cur: typeof audio.words = []
    const flush = () => {
      if (cur.length) out.push({ start: v.at + cur[0].start, end: v.at + cur.at(-1)!.end + 0.15, text: cur.map((w) => w.w).join(' ') })
      cur = []
    }
    for (const w of audio.words) {
      const len = cur.reduce((n, x) => n + x.w.length + 1, 0)
      if (cur.length && (len + w.w.length > maxChars || /[.!?]$/.test(cur.at(-1)!.w))) flush()
      cur.push(w)
    }
    flush()
  }
  return out
}

const stamp = (s: number, sep: string) => {
  const ms = Math.max(0, Math.round(s * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}${sep}${pad(ms % 1000, 3)}`
}

export function toSrt(timeline: Timeline, input: Pick<CompositionInput, 'audio'>): string {
  return cues(timeline, input)
    .map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`)
    .join('\n')
}

export function toVtt(timeline: Timeline, input: Pick<CompositionInput, 'audio'>): string {
  return `WEBVTT\n\n${cues(timeline, input)
    .map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`)
    .join('\n')}`
}

export async function readJsonFile<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T
}
