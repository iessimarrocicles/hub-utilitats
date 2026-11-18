/**
 * Llista d'edició: de les decisions de Claude (per índex de paraula)
 * als talls en segons, i d'ací als filtres d'ffmpeg i als subtítols ASS.
 * Tot pur i provat: no toca disc ni processos.
 */
import type { BrandProfile } from '../../src/utilities/reels/model.ts'
import type { EditPlan, RemovedKind, Segment, SegmentKind, Subtitle, Word } from '../../src/utilities/reels/auto/types.ts'

export type { EditPlan, RemovedKind, Segment, SegmentKind, Subtitle, Word }

/** Aire que es deixa abans i després de cada paraula, en segons. */
export const AIR = 0.1
/** Pauses més llargues que això, dins d'un tram, es tallen. */
export const MAX_PAUSE = 0.4

export interface Silence {
  start: number
  end: number
}

/** El que torna Claude Code. Tots els rangs són índexs de paraula inclusius. */
export interface ClaudePlan {
  keep: { from: number; to: number }[]
  removed: { from: number; to: number; kind: RemovedKind; note: string }[]
  subtitles: { from: number; to: number; text: string; highlight: string }[]
  hook: { line1: string; line2: string }
  summary: string
  warnings: string[]
}

export interface Range {
  start: number
  end: number
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

function clampRange(from: number, to: number, n: number): [number, number] | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || n === 0) return null
  const a = Math.max(0, Math.floor(Math.min(from, to)))
  const b = Math.min(n - 1, Math.floor(Math.max(from, to)))
  return a > b ? null : [a, b]
}

/** On acaba la paraula a i comença la b, amb aire, sense trepitjar-se. */
function boundary(a: Word, b: Word): [number, number] {
  const gap = b.start - a.end
  if (gap >= 2 * AIR) return [a.end + AIR, b.start - AIR]
  const mid = (a.end + b.start) / 2
  return [mid, mid]
}

interface Label {
  keep: boolean
  kind: SegmentKind
  note?: string
  /** Identifica el rang d'origen perquè dos rangs llevats seguits no s'ajunten. */
  group: string
}

export function buildPlan(words: Word[], duration: number, claude: ClaudePlan): EditPlan {
  const n = words.length
  const labels: Label[] = words.map(() => ({ keep: false, kind: 'altres', group: 'none' }))

  claude.keep.forEach((r, k) => {
    const c = clampRange(r.from, r.to, n)
    if (!c) return
    for (let i = c[0]; i <= c[1]; i++) labels[i] = { keep: true, kind: 'contingut', group: `k${k}` }
  })
  // Si Claude marca una paraula com a llevada i també com a guardada, guanya llevar-la.
  claude.removed.forEach((r, k) => {
    const c = clampRange(r.from, r.to, n)
    if (!c) return
    for (let i = c[0]; i <= c[1]; i++) labels[i] = { keep: false, kind: r.kind, note: r.note, group: `r${k}` }
  })

  // Agrupa paraules seguides amb la mateixa etiqueta; els trams guardats es tallen en pauses llargues.
  const groups: { label: Label; from: number; to: number }[] = []
  for (let i = 0; i < n; i++) {
    const last = groups[groups.length - 1]
    const sameLabel = last && last.label.group === labels[i].group && last.to === i - 1
    const longPause = last && labels[i].keep && words[i].start - words[i - 1].end > MAX_PAUSE
    if (sameLabel && !longPause) last.to = i
    else groups.push({ label: labels[i], from: i, to: i })
  }

  const segments: Segment[] = groups.map((g, k) => {
    const first = words[g.from]
    const last = words[g.to]
    const prev = words[g.from - 1]
    const next = words[g.to + 1]
    const start = prev ? boundary(prev, first)[1] : Math.max(0, first.start - AIR)
    const end = next ? boundary(last, next)[0] : Math.min(duration, last.end + AIR)
    const seg: Segment = {
      id: `s${k}`,
      start: round3(start),
      end: round3(end),
      keep: g.label.keep,
      kind: g.label.kind,
      text: words
        .slice(g.from, g.to + 1)
        .map((w) => w.text)
        .join(' '),
    }
    if (g.label.note) seg.note = g.label.note
    return seg
  })

  const subtitles: Subtitle[] = []
  claude.subtitles.forEach((s) => {
    const c = clampRange(s.from, s.to, n)
    if (!c) return
    const joined = words
      .slice(c[0], c[1] + 1)
      .map((w) => w.text)
      .join(' ')
    subtitles.push({
      id: `t${subtitles.length}`,
      start: round3(words[c[0]].start),
      end: round3(words[c[1]].end),
      text: s.text.trim() || joined,
      highlight: s.highlight.trim(),
    })
  })

  return {
    segments,
    subtitles,
    hook: { line1: claude.hook.line1.trim(), line2: claude.hook.line2.trim() },
    summary: claude.summary,
    warnings: claude.warnings,
  }
}

/** Trams que es queden, ordenats i sense trepitjar-se. */
export function keptRanges(segments: Segment[]): Range[] {
  const sorted = segments
    .filter((s) => s.keep && s.end > s.start)
    .map((s) => ({ start: s.start, end: s.end }))
    .sort((a, b) => a.start - b.start)
  const out: Range[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end + 1e-6) last.end = Math.max(last.end, r.end)
    else out.push({ ...r })
  }
  return out
}

export function outputDuration(ranges: Range[]): number {
  return ranges.reduce((acc, r) => acc + (r.end - r.start), 0)
}

/** Instant de l'original → instant del vídeo tallat. null si cau en un tram llevat. */
export function toOutputTime(t: number, ranges: Range[]): number | null {
  let acc = 0
  for (const r of ranges) {
    if (t >= r.start - 1e-6 && t <= r.end + 1e-6) return acc + Math.max(0, t - r.start)
    acc += r.end - r.start
  }
  return null
}

export function mapSubtitles(subs: Subtitle[], ranges: Range[]): Subtitle[] {
  const out: Subtitle[] = []
  for (const s of subs) {
    let start = toOutputTime(s.start, ranges)
    if (start == null) {
      const next = ranges.find((r) => r.start > s.start && r.start < s.end)
      start = next ? toOutputTime(next.start, ranges) : null
    }
    let end = toOutputTime(s.end, ranges)
    if (end == null) {
      const prev = [...ranges].reverse().find((r) => r.end < s.end && r.end > s.start)
      end = prev ? toOutputTime(prev.end, ranges) : null
    }
    if (start == null || end == null || end - start < 0.05) continue
    out.push({ ...s, start: round3(start), end: round3(end) })
  }
  return out
}

const HDR_TONEMAP =
  'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p'

const AUDIO_CHAIN =
  'acompressor=threshold=0.0316:ratio=2:attack=5:release=100:knee=4,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000'

export interface FilterOptions {
  ranges: Range[]
  width: number
  height: number
  hdr: boolean
  /** Fitxer ASS relatiu al directori de treball d'ffmpeg. */
  assFile?: string
  fontsDir?: string
  /** El logo entra com a segona entrada ([1:v]). */
  logo?: { x: number; y: number; width: number }
}

/** Graf de filtres complet. Etiquetes d'eixida: [vout] i [aout]. */
export function buildFilterGraph(o: FilterOptions): string {
  if (o.ranges.length === 0) throw new Error('No hi ha cap tram per a muntar.')
  const n = o.ranges.length
  const f = (t: number) => t.toFixed(3)
  const lines: string[] = []

  const base = ['fps=30']
  if (o.hdr) base.push(HDR_TONEMAP)
  base.push(`scale=${o.width}:${o.height}:force_original_aspect_ratio=increase`, `crop=${o.width}:${o.height}`, 'setsar=1', 'format=yuv420p')
  const vSplit = o.ranges.map((_, i) => `[v${i}]`).join('')
  const aSplit = o.ranges.map((_, i) => `[a${i}]`).join('')
  lines.push(`[0:v]${base.join(',')},split=${n}${vSplit}`)
  lines.push(`[0:a]asplit=${n}${aSplit}`)

  o.ranges.forEach((r, i) => {
    lines.push(`[v${i}]trim=start=${f(r.start)}:end=${f(r.end)},setpts=PTS-STARTPTS[vs${i}]`)
    lines.push(`[a${i}]atrim=start=${f(r.start)}:end=${f(r.end)},asetpts=PTS-STARTPTS[as${i}]`)
  })
  const pairs = o.ranges.map((_, i) => `[vs${i}][as${i}]`).join('')
  lines.push(`${pairs}concat=n=${n}:v=1:a=1[vc][ac]`)

  let v = 'vc'
  if (o.assFile) {
    const fonts = o.fontsDir ? `:fontsdir='${o.fontsDir}'` : ''
    lines.push(`[${v}]ass='${o.assFile}'${fonts}[vt]`)
    v = 'vt'
  }
  if (o.logo) {
    lines.push(`[1:v]scale=${o.logo.width}:-1[lg]`)
    lines.push(`[${v}][lg]overlay=${o.logo.x}:${o.logo.y}[vo]`)
    v = 'vo'
  }
  lines.push(`[${v}]null[vout]`)
  lines.push(`[ac]${AUDIO_CHAIN}[aout]`)
  return lines.join(';\n')
}

export function hexToAss(hex: string, alpha = 0): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const rgb = m ? m[1] : 'FFFFFF'
  const [r, g, b] = [rgb.slice(0, 2), rgb.slice(2, 4), rgb.slice(4, 6)]
  const a = alpha.toString(16).padStart(2, '0')
  return `&H${a}${b}${g}${r}`.toUpperCase()
}

export function assTime(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

function escapeAss(text: string): string {
  return text.replace(/\\/g, '/').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\r?\n/g, '\\N')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text: string, word: string, brand: BrandProfile): string {
  const safe = escapeAss(text)
  const w = escapeAss(word.trim())
  if (!w) return safe
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegex(w)})(?=$|[^\\p{L}\\p{N}])`, 'iu')
  const italic = brand.subtitles.highlightStyle === 'cursiva' ? '\\i1' : ''
  return safe.replace(re, (_m, pre: string, hit: string) => `${pre}{\\c${hexToAss(brand.colors.highlight)}&\\b1${italic}}${hit}{\\r}`)
}

/** Posició vertical del logo i del ganxo en píxels sobre 1080×1920. */
export const LOGO_MARGIN = 40

export function logoPlacement(brand: BrandProfile, width = 1080, height = 1920) {
  const scale = width / 1080
  const size = Math.round(brand.logo.size * scale)
  const m = Math.round(LOGO_MARGIN * scale)
  const right = brand.logo.corner.endsWith('dreta')
  const bottom = brand.logo.corner.startsWith('inferior')
  return {
    width: size,
    x: right ? width - size - m : m,
    // L'altura real depén de la imatge; per a la cantonada inferior s'usa la mida com a aproximació.
    y: bottom ? height - size - m : m,
  }
}

function hookMarginV(brand: BrandProfile): number {
  switch (brand.hook.position) {
    case 'darrere-del-cap':
      return Math.round(1920 * 0.24)
    case 'centre':
      return Math.round(1920 * 0.42)
    default:
      return brand.logo.corner.startsWith('superior') && brand.logo.dataUrl
        ? LOGO_MARGIN + brand.logo.size + 32
        : Math.round(1920 * 0.06)
  }
}

export interface AssOptions {
  subtitles: Subtitle[]
  hook: { line1: string; line2: string }
  brand: BrandProfile
  duration: number
}

export function buildAss(o: AssOptions): string {
  const b = o.brand
  const c = b.colors
  const sub = b.subtitles
  const subStyle = [
    'Sub',
    b.fonts.body.family,
    sub.size,
    hexToAss(sub.color),
    hexToAss(sub.color),
    sub.box ? hexToAss(c.background) : hexToAss('#000000'),
    hexToAss('#000000', 0x80),
    -1,
    0,
    0,
    0,
    100,
    100,
    2,
    0,
    sub.box ? 3 : 1,
    sub.box ? 14 : 4,
    0,
    8,
    80,
    80,
    Math.round((1920 * sub.height) / 100),
    1,
  ].join(',')
  const hookStyle = [
    'Hook',
    b.fonts.title.family,
    b.hook.size,
    hexToAss(c.text),
    hexToAss(c.text),
    hexToAss(c.primary),
    hexToAss(c.primary),
    0,
    0,
    0,
    0,
    100,
    100,
    0,
    0,
    3,
    18,
    0,
    8,
    70,
    70,
    hookMarginV(b),
    1,
  ].join(',')

  const events: string[] = []
  const hookLines = [o.hook.line1, o.hook.line2].map((l) => escapeAss(l.trim())).filter(Boolean)
  if (hookLines.length > 0) {
    events.push(`Dialogue: 1,${assTime(0)},${assTime(Math.min(3, o.duration))},Hook,,0,0,0,,${hookLines.join('\\N')}`)
  }
  for (const s of o.subtitles) {
    // Durant el ganxo només hi ha un text gran: els subtítols comencen després.
    const start = hookLines.length > 0 ? Math.max(s.start, Math.min(3, o.duration)) : s.start
    if (s.end - start < 0.05) continue
    events.push(`Dialogue: 0,${assTime(start)},${assTime(s.end)},Sub,,0,0,0,,${highlightText(s.text, s.highlight, b)}`)
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${subStyle}
Style: ${hookStyle}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`
}

export function parseSilences(stderr: string, duration: number): Silence[] {
  const out: Silence[] = []
  let open: number | null = null
  for (const line of stderr.split(/\r?\n/)) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line)
    if (s) open = Math.max(0, Number(s[1]))
    const e = /silence_end:\s*([\d.]+)/.exec(line)
    if (e && open != null) {
      out.push({ start: open, end: Number(e[1]) })
      open = null
    }
  }
  if (open != null) out.push({ start: open, end: duration })
  return out
}
