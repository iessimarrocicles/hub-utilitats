import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { GraphicId, Storyboard, StyleTemplate, VideoFormat } from '../../src/utilities/tutorials/types.ts'
import { ROOT } from '../config.ts'
import { run } from '../lib/run.ts'

const PROJECT = path.join(ROOT, 'hyperframes', 'titles')

/**
 * Com executar HyperFrames. En Windows, l'ordre global de npm és un .cmd que no es pot
 * llançar sense shell: s'executa directament el seu fitxer .mjs amb Node.
 */
function hyperframesCommand(): { cmd: string; pre: string[] } {
  if (process.env.HUB_HYPERFRAMES) return { cmd: process.env.HUB_HYPERFRAMES, pre: [] }
  const roots = [process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules'), path.join(ROOT, 'node_modules')].filter(Boolean) as string[]
  for (const r of roots) {
    const pkg = path.join(r, 'hyperframes', 'package.json')
    if (!existsSync(pkg)) continue
    try {
      const bin = (JSON.parse(readFileSync(pkg, 'utf8')) as { bin?: Record<string, string> }).bin?.hyperframes
      if (bin) return { cmd: process.execPath, pre: [path.join(r, 'hyperframes', bin)] }
    } catch {
      /* package.json il·legible */
    }
  }
  return { cmd: 'hyperframes', pre: [] }
}

const hf = (args: string[], opts: Parameters<typeof run>[2] = {}) => {
  const c = hyperframesCommand()
  return run(c.cmd, [...c.pre, ...args], opts)
}

/** Lletres que HyperFrames porta incorporades. Les altres de les plantilles van a la més pròxima. */
const FONT_MAP: Record<string, string> = {
  Inter: 'Inter',
  Montserrat: 'Montserrat',
  Poppins: 'Poppins',
  'Space Grotesk': 'Outfit',
  Merriweather: 'Playfair Display',
  'Source Sans 3': 'Open Sans',
}

/** HyperFrames fa la intro i el tancament en 16:9 a 1080p. En vertical i 4K les fa Remotion, en vectorial. */
export function usesHyperframes(t: StyleTemplate, format: VideoFormat, graphics: GraphicId[]): boolean {
  return !!t.hyperframes && format === '1080p' && (graphics.includes('intro') || graphics.includes('outro'))
}

export async function hyperframesAvailable(): Promise<boolean> {
  const r = await hf(['--version'], { timeoutMs: 30_000 }).catch(() => ({ code: 1 }))
  return r.code === 0
}

/**
 * Renderitza la intro i el tancament amb la plantilla de HyperFrames (hyperframes/titles).
 * Es reaprofiten si el títol i els colors no han canviat.
 */
export async function renderTitles(
  t: StyleTemplate,
  board: Storyboard,
  graphics: GraphicId[],
  outDir: string,
  stage: (s: string) => void,
): Promise<{ intro?: string; outro?: string }> {
  await mkdir(outDir, { recursive: true })
  const base = {
    title: board.title,
    bg1: t.colors.background,
    bg2: t.colors.background2,
    accent: t.colors.accent,
    ink: t.colors.text,
    muted: t.colors.muted,
    font: FONT_MAP[t.fonts.title] ?? 'Inter',
  }
  const rows: Record<string, string>[] = []
  if (graphics.includes('intro')) rows.push({ ...base, kind: 'intro', kicker: 'Tutorial', subtitle: board.summary })
  if (graphics.includes('outro')) rows.push({ ...base, kind: 'outro', kicker: '¡Gracias por verlo!', subtitle: '' })
  if (rows.length === 0) return {}

  const hash = createHash('sha1').update(JSON.stringify(rows)).digest('hex').slice(0, 12)
  const file = (kind: string) => path.join(outDir, `${kind}-${hash}.mp4`)
  const missing = rows.filter((r) => !existsSync(file(r.kind)))
  if (missing.length) {
    stage('HyperFrames està fent la intro i el tancament')
    const batch = path.join(outDir, `rows-${hash}.json`)
    await writeFile(batch, JSON.stringify({ rows: missing }), 'utf8')
    const r = await hf(
      ['render', '--batch', batch, '--output', path.join(outDir, `{kind}-${hash}.mp4`), '--fps', '60', '--quality', 'delivery', '--strict-variables'],
      { cwd: PROJECT, timeoutMs: 20 * 60_000 },
    )
    if (r.code !== 0) throw new Error(`HyperFrames ha fallat.\n${(r.stderr || r.stdout).trim().split('\n').slice(-6).join('\n')}`)
  }
  const out: { intro?: string; outro?: string } = {}
  for (const r of rows) if (existsSync(file(r.kind))) out[r.kind as 'intro' | 'outro'] = path.basename(file(r.kind))
  return out
}
