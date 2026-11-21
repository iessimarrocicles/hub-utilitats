import type { CoverText, Storyboard } from '../../src/utilities/tutorials/types.ts'

/** Segons que la miniatura ocupa al principi del vídeo. */
export const COVER_SECONDS = 3
/** Instant de la portada que es guarda com a imatge: quan ja ha acabat l'entrada. */
export const COVER_STILL_SECONDS = 1.4
export const DEFAULT_BRAND = 'DOCENTSTIC'

/** Colors de la plantilla de miniatura de DOCENTSTIC (mesurats de Plantilla.png). */
export const COVER_COLORS = {
  background: '#525050',
  title: '#FFFFFF',
  subtitle: '#FF3131',
  playFrom: '#F40707',
  playTo: '#D21C1E',
  minutes: '#FFDE59',
  brush: '#141414',
} as const

export const COVER_FONT = 'Anton'

export function coverMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60))
}

export function minutesLabel(n: number): string {
  return `${n} ${n === 1 ? 'MINUT' : 'MINUTS'}`
}

/** Textos de la portada: els del guió o, si no n'hi ha, el títol del tutorial. */
export function coverText(board: Pick<Storyboard, 'title' | 'cover'>): CoverText {
  return {
    title: board.cover?.title?.trim() || board.title,
    subtitle: board.cover?.subtitle?.trim() ?? '',
    brand: board.cover?.brand?.trim() || DEFAULT_BRAND,
  }
}

/** Textos que s'usen: els editats per l'usuari o, si no n'hi ha, la proposta del guió. */
export function projectCover(p: { name: string; cover?: CoverText; storyboard?: Pick<Storyboard, 'title' | 'cover'> }): CoverText {
  if (p.cover) return { ...p.cover, brand: p.cover.brand.trim() || DEFAULT_BRAND }
  return coverText(p.storyboard ?? { title: p.name })
}

/** Durada aproximada abans de generar el vídeo: 140 paraules per minut, com el guió. */
export function estimateSeconds(board: Pick<Storyboard, 'chapters'>): number {
  const words = board.chapters.flatMap((c) => c.scenes).reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0)
  return (words / 140) * 60
}

/**
 * Mida de lletra perquè la línia més llarga càpiga en maxWidth.
 * Anton és molt condensada: cada caràcter en majúscula ocupa unes 0,34 vegades la mida
 * (mesurat a Plantilla.png: «TITOL PRINCIPAL» fa 610 px amb lletra de 130 px).
 */
export function fitSize(text: string, maxWidth: number, base: number, min: number, em = 0.34): number {
  const longest = Math.max(1, ...text.split('\n').map((l) => l.trim().length))
  return Math.round(Math.max(min, Math.min(base, maxWidth / (longest * em))))
}

/**
 * Parteix un text llarg en dues línies semblants, pel buit més centrat.
 * Respecta els salts de línia que ja haja posat l'usuari.
 */
export function balanceLines(text: string, maxOneLine = 16): string {
  const clean = text.trim().replace(/[ \t]+/g, ' ')
  if (clean.includes('\n') || clean.length <= maxOneLine) return clean
  const spaces = [...clean.matchAll(/ /g)].map((m) => m.index!)
  if (spaces.length === 0) return clean
  const best = spaces.reduce((a, b) => (Math.abs(b - clean.length / 2) < Math.abs(a - clean.length / 2) ? b : a))
  return `${clean.slice(0, best)}\n${clean.slice(best + 1)}`
}
