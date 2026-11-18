import { existsSync } from 'node:fs'
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { FONTS_DIR, PY_TRANSCRIBE, PYTHON, WHISPER_MODEL } from './config.ts'
import { parseSilences, type Silence, type Word } from './lib/edl.ts'
import { run, runOk } from './lib/run.ts'

export interface MediaInfo {
  duration: number
  width: number
  height: number
  hdr: boolean
  hasAudio: boolean
}

export async function probe(file: string): Promise<MediaInfo> {
  const r = await runOk('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file])
  const data = JSON.parse(r.stdout) as {
    format?: { duration?: string }
    streams?: { codec_type: string; width?: number; height?: number; color_transfer?: string; side_data_list?: { rotation?: number }[]; tags?: { rotate?: string } }[]
  }
  const v = data.streams?.find((s) => s.codec_type === 'video')
  if (!v) throw new Error('El fitxer no té vídeo.')
  const rotation = Math.abs(Number(v.side_data_list?.find((d) => d.rotation != null)?.rotation ?? v.tags?.rotate ?? 0))
  const rotated = rotation === 90 || rotation === 270
  return {
    duration: Number(data.format?.duration ?? 0),
    width: rotated ? (v.height ?? 0) : (v.width ?? 0),
    height: rotated ? (v.width ?? 0) : (v.height ?? 0),
    hdr: ['arib-std-b67', 'smpte2084'].includes(v.color_transfer ?? ''),
    hasAudio: !!data.streams?.some((s) => s.codec_type === 'audio'),
  }
}

export async function extractAudio(file: string, out: string): Promise<void> {
  await runOk('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '16000', out])
}

export async function detectSilences(file: string, duration: number): Promise<Silence[]> {
  const r = await run('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', 'silencedetect=noise=-45dB:d=0.25', '-f', 'null', '-'])
  return parseSilences(r.stderr, duration)
}

export async function extractFrame(file: string, t: number, out: string, width = 540): Promise<void> {
  await runOk('ffmpeg', ['-y', '-v', 'error', '-ss', t.toFixed(2), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-q:v', '4', out])
}

/** Moments per a estudiar una referència: 0,5, 1,5, 3 i cada 3 s, com a màxim 8. */
export function referenceTimes(duration: number): number[] {
  const times = [0.5, 1.5, 3]
  for (let t = 6; t < duration - 0.5 && times.length < 8; t += 3) times.push(t)
  return times.filter((t) => t < duration)
}

/** Canvis de pla per segon, amb la detecció d'escenes d'ffmpeg. */
export async function cutsPerSecond(file: string, duration: number): Promise<number> {
  const r = await run('ffmpeg', ['-hide_banner', '-i', file, '-an', '-vf', "select='gt(scene,0.3)',showinfo", '-f', 'null', '-'])
  const cuts = (r.stderr.match(/pts_time:/g) ?? []).length
  return duration > 0 ? cuts / duration : 0
}

export async function transcribe(
  audio: string,
  language: string,
  out: string,
  onProgress: (p: number) => void,
): Promise<{ language: string; words: Word[] }> {
  await runOk(PYTHON, [PY_TRANSCRIBE, audio, WHISPER_MODEL, language || 'auto', out], {
    onStderr: (chunk) => {
      const m = /(\d{1,3})%\|/g
      let last: RegExpExecArray | null = null
      let hit: RegExpExecArray | null
      while ((hit = m.exec(chunk))) last = hit
      if (last) onProgress(Number(last[1]) / 100)
    },
  })
  const data = JSON.parse(await readFile(out, 'utf8')) as { language: string; words: Omit<Word, 'i'>[] }
  return { language: data.language, words: data.words.map((w, i) => ({ ...w, i })) }
}

/**
 * Descarrega una lletra de Google Fonts en TTF perquè libass la trobe.
 * Només s'envia el nom de la lletra. Si falla, ffmpeg usa una lletra del sistema.
 */
export async function ensureFont(family: string): Promise<string | null> {
  const name = family.trim()
  if (!name) return null
  const slug = name.replace(/[^\p{L}\p{N}]+/gu, '-')
  const existing = (await readdir(FONTS_DIR)).filter((f) => f.startsWith(`${slug}-`))
  if (existing.length > 0) return null
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;700;900&display=swap`
    // Sense navegador modern, Google torna TTF en lloc de WOFF2.
    const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/4.0' } })).text()
    const urls = [...css.matchAll(/url\((https:[^)]+\.ttf)\)/g)].map((m) => m[1])
    if (urls.length === 0) return `No he trobat la lletra «${name}» a Google Fonts. S'usarà una del sistema.`
    for (const [i, u] of [...new Set(urls)].entries()) {
      const buf = Buffer.from(await (await fetch(u)).arrayBuffer())
      await writeFile(path.join(FONTS_DIR, `${slug}-${i}.ttf`), buf)
    }
    return null
  } catch {
    return `No s'ha pogut descarregar la lletra «${name}». S'usarà una del sistema.`
  }
}

export interface RenderOptions {
  cwd: string
  input: string
  logo?: string
  graphFile: string
  output: string
  quality: 'preview' | 'final'
  expectedDuration: number
  onProgress: (p: number) => void
}

export async function render(o: RenderOptions): Promise<void> {
  const args = ['-y', '-hide_banner', '-v', 'error', '-i', o.input]
  if (o.logo) args.push('-i', o.logo)
  args.push('-/filter_complex', o.graphFile, '-map', '[vout]', '-map', '[aout]')
  if (o.quality === 'preview') args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28')
  else args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-profile:v', 'high')
  args.push(
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', o.quality === 'preview' ? '128k' : '192k',
    '-movflags', '+faststart',
    '-map_metadata', '-1',
    '-progress', 'pipe:1',
    '-nostats',
    o.output,
  )
  await runOk('ffmpeg', args, {
    cwd: o.cwd,
    onStdout: (chunk) => {
      const m = /out_time_us=(\d+)/g
      let last: RegExpExecArray | null = null
      let hit: RegExpExecArray | null
      while ((hit = m.exec(chunk))) last = hit
      if (last && o.expectedDuration > 0) o.onProgress(Math.min(1, Number(last[1]) / 1e6 / o.expectedDuration))
    },
  })
}

/** Mesura la sonoritat integrada (LUFS) i el pic real d'un fitxer. */
export async function measureLoudness(file: string): Promise<{ lufs: number | null; truePeak: number | null }> {
  const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'))
  const i = /I:\s*(-?[\d.]+) LUFS/.exec(summary)
  const p = /Peak:\s*(-?[\d.]+) dBFS/.exec(summary)
  return { lufs: i ? Number(i[1]) : null, truePeak: p ? Number(p[1]) : null }
}

/**
 * Ajusta el volum fins a −14 LUFS ±0,3 amb el pic real per davall de −1,5 dB.
 * Només es recodifica l'àudio; el vídeo es copia tal qual.
 */
export async function normalizeLoudness(cwd: string, file: string, target = -14): Promise<{ lufs: number | null; truePeak: number | null }> {
  const full = path.join(cwd, file)
  let m = await measureLoudness(full)
  for (let attempt = 0; attempt < 3 && m.lufs != null && Math.abs(m.lufs - target) > 0.3; attempt++) {
    const gain = (target - m.lufs).toFixed(2)
    const tmp = `${file}.vol.mp4`
    await runOk(
      'ffmpeg',
      [
        '-y', '-v', 'error', '-i', file,
        '-c:v', 'copy',
        // Limitador a −1,6 dBFS (0,83): deixa el pic real per davall de −1,5 dB.
        '-af', `volume=${gain}dB,alimiter=limit=0.83:attack=3:release=50:level=disabled`,
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart', '-map_metadata', '-1',
        tmp,
      ],
      { cwd },
    )
    await rm(full)
    await rename(path.join(cwd, tmp), full)
    m = await measureLoudness(full)
  }
  return m
}

export async function removeIfExists(p: string): Promise<void> {
  if (existsSync(p)) await rm(p, { recursive: true, force: true })
}
