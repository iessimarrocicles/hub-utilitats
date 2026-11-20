import type { TimedWord } from '../../../src/utilities/tutorials/types.ts'

/** Paraules del text tal com s'han d'escriure als subtítols. */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).map((w) => w.trim()).filter(Boolean)
}

const norm = (w: string) =>
  w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')

/** Reparteix les paraules segons la seua llargària. Només quan no hi ha res millor. */
export function proportionalWords(text: string, duration: number, lead = 0.05): TimedWord[] {
  const words = tokenize(text)
  if (words.length === 0 || duration <= 0) return []
  const weights = words.map((w) => Math.max(2, norm(w).length) + 1.5)
  const total = weights.reduce((a, b) => a + b, 0)
  const span = Math.max(0.1, duration - lead * 2)
  let t = lead
  return words.map((w, i) => {
    const d = (weights[i] / total) * span
    const out = { w, start: round(t), end: round(t + d * 0.92) }
    t += d
    return out
  })
}

/**
 * Posa els temps del reconeixement de veu sobre les paraules del text original.
 * Emparella paraula a paraula (amb tolerància a diferències d'ortografia) i
 * interpola les que no s'han reconegut.
 */
export function alignToText(text: string, asr: TimedWord[], duration: number): TimedWord[] {
  const words = tokenize(text)
  if (words.length === 0) return []
  if (asr.length === 0) return proportionalWords(text, duration)

  const times: ({ start: number; end: number } | null)[] = words.map(() => null)
  let j = 0
  for (let i = 0; i < words.length && j < asr.length; i++) {
    const target = norm(words[i])
    // Busca la paraula reconeguda dins d'una finestra curta.
    let found = -1
    for (let k = j; k < Math.min(asr.length, j + 4); k++) {
      const a = norm(asr[k].w)
      if (a && (a === target || (a.length > 3 && (a.startsWith(target) || target.startsWith(a))))) {
        found = k
        break
      }
    }
    if (found >= 0) {
      times[i] = { start: asr[found].start, end: asr[found].end }
      j = found + 1
    }
  }

  // Interpola els buits entre les paraules ancorades.
  const anchors = times.map((t, i) => (t ? i : -1)).filter((i) => i >= 0)
  if (anchors.length === 0) {
    const first = asr[0].start
    const last = asr[asr.length - 1].end
    return proportionalWords(text, last - first + 0.1).map((w) => ({ ...w, start: round(w.start + first), end: round(w.end + first) }))
  }
  const out: TimedWord[] = []
  for (let i = 0; i < words.length; i++) {
    const t = times[i]
    if (t) {
      out.push({ w: words[i], start: round(t.start), end: round(t.end) })
      continue
    }
    const prev = [...anchors].reverse().find((a) => a < i)
    const next = anchors.find((a) => a > i)
    const from = prev != null ? times[prev]!.end : 0
    const to = next != null ? times[next]!.start : Math.max(from + 0.2, duration)
    const gapStart = prev != null ? prev + 1 : 0
    const gapEnd = next != null ? next : words.length
    const n = gapEnd - gapStart
    const k = i - gapStart
    const step = (to - from) / Math.max(1, n)
    out.push({ w: words[i], start: round(from + step * k), end: round(from + step * (k + 0.9)) })
  }
  return out
}

/** Les marques de temps per caràcter d'ElevenLabs, agrupades en paraules. */
export function charsToWords(
  text: string,
  alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] },
): TimedWord[] {
  const out: TimedWord[] = []
  let cur = ''
  let start = 0
  let end = 0
  alignment.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push({ w: cur, start: round(start), end: round(end) })
      cur = ''
      return
    }
    if (!cur) start = alignment.character_start_times_seconds[i]
    cur += ch
    end = alignment.character_end_times_seconds[i]
  })
  if (cur) out.push({ w: cur, start: round(start), end: round(end) })
  // Si el recompte coincideix, conserva l'ortografia del guió.
  const words = tokenize(text)
  return words.length === out.length ? out.map((o, i) => ({ ...o, w: words[i] })) : out
}

const round = (n: number) => Math.round(n * 1000) / 1000
