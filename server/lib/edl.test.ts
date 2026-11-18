import { describe, expect, it } from 'vitest'
import {
  assTime,
  buildAss,
  buildFilterGraph,
  buildPlan,
  hexToAss,
  keptRanges,
  mapSubtitles,
  outputDuration,
  parseSilences,
  toOutputTime,
  type ClaudePlan,
  type Word,
} from './edl.ts'
import { defaultBrand } from '../../src/utilities/reels/model.ts'

// "Hola hola a tots. [pausa llarga] Això és Claude."
const words: Word[] = [
  { i: 0, text: 'Hola', start: 1.0, end: 1.3 },
  { i: 1, text: 'hola', start: 1.5, end: 1.8 },
  { i: 2, text: 'a', start: 1.85, end: 1.9 },
  { i: 3, text: 'tots.', start: 1.95, end: 2.3 },
  { i: 4, text: 'Això', start: 4.0, end: 4.3 },
  { i: 5, text: 'és', start: 4.35, end: 4.5 },
  { i: 6, text: 'Claude.', start: 4.55, end: 5.0 },
]

const claude: ClaudePlan = {
  keep: [{ from: 1, to: 6 }],
  removed: [{ from: 0, to: 0, kind: 'repeticio', note: 'Primera presa de «hola»' }],
  subtitles: [
    { from: 1, to: 3, text: 'Hola a tots', highlight: 'tots' },
    { from: 4, to: 6, text: 'Això és Claude', highlight: 'Claude' },
  ],
  hook: { line1: 'Edita reels', line2: 'amb Claude' },
  summary: 'He llevat la primera presa.',
  warnings: [],
}

describe('buildPlan', () => {
  const plan = buildPlan(words, 6, claude)

  it('divideix els trams que es queden on hi ha pauses de més de 0,4 s', () => {
    const kept = plan.segments.filter((s) => s.keep)
    expect(kept).toHaveLength(2)
    expect(kept[0].text).toBe('hola a tots.')
    expect(kept[1].text).toBe('Això és Claude.')
  })

  it('deixa 0,1 s d’aire i no talla mai dins d’una paraula', () => {
    const kept = plan.segments.filter((s) => s.keep)
    expect(kept[0].start).toBeCloseTo(1.4)
    expect(kept[0].end).toBeCloseTo(2.4)
    expect(kept[1].start).toBeCloseTo(3.9)
    expect(kept[1].end).toBeCloseTo(5.1)
    const removed = plan.segments.find((s) => !s.keep)!
    expect(removed.kind).toBe('repeticio')
    expect(removed.end).toBeLessThanOrEqual(kept[0].start)
  })

  it('marca com a «altres» les paraules que Claude no ha classificat', () => {
    const p = buildPlan(words, 6, { ...claude, keep: [{ from: 1, to: 3 }], removed: [] })
    const others = p.segments.filter((s) => s.kind === 'altres')
    expect(others.map((s) => s.text)).toEqual(['Hola', 'Això és Claude.'])
    expect(others.every((s) => !s.keep)).toBe(true)
  })

  it('calcula els subtítols en temps de l’original', () => {
    expect(plan.subtitles[0]).toMatchObject({ start: 1.5, end: 2.3, text: 'Hola a tots', highlight: 'tots' })
  })

  it('ignora índexs fora de rang', () => {
    const p = buildPlan(words, 6, { ...claude, keep: [{ from: 5, to: 99 }], subtitles: [{ from: 50, to: 60, text: 'x', highlight: '' }] })
    expect(p.segments.filter((s) => s.keep).map((s) => s.text)).toEqual(['és Claude.'])
    expect(p.subtitles).toHaveLength(0)
  })
})

describe('temps de sortida', () => {
  const ranges = [
    { start: 1.4, end: 2.4 },
    { start: 3.9, end: 5.1 },
  ]

  it('fusiona els trams que es trepitgen', () => {
    expect(
      keptRanges([
        { id: 'a', start: 0, end: 1, keep: true, kind: 'contingut', text: '' },
        { id: 'b', start: 0.9, end: 2, keep: true, kind: 'contingut', text: '' },
        { id: 'c', start: 3, end: 4, keep: false, kind: 'silenci', text: '' },
      ]),
    ).toEqual([{ start: 0, end: 2 }])
  })

  it('converteix un instant de l’original al vídeo tallat', () => {
    expect(toOutputTime(1.4, ranges)).toBeCloseTo(0)
    expect(toOutputTime(2.0, ranges)).toBeCloseTo(0.6)
    expect(toOutputTime(4.0, ranges)).toBeCloseTo(1.1)
    expect(toOutputTime(3.0, ranges)).toBeNull()
    expect(outputDuration(ranges)).toBeCloseTo(2.2)
  })

  it('trasllada els subtítols i descarta els que cauen en trams llevats', () => {
    const subs = mapSubtitles(
      [
        { id: '1', start: 1.5, end: 2.3, text: 'Hola a tots', highlight: 'tots' },
        { id: '2', start: 2.6, end: 3.5, text: 'llevat', highlight: '' },
        { id: '3', start: 4.0, end: 5.0, text: 'Això és Claude', highlight: 'Claude' },
      ],
      ranges,
    )
    expect(subs.map((s) => s.text)).toEqual(['Hola a tots', 'Això és Claude'])
    expect(subs[0].start).toBeCloseTo(0.1)
    expect(subs[1].start).toBeCloseTo(1.1)
    expect(subs[1].end).toBeCloseTo(2.1)
  })
})

describe('buildFilterGraph', () => {
  const ranges = [
    { start: 1.4, end: 2.4 },
    { start: 3.9, end: 5.1 },
  ]

  it('retalla, ajunta i passa a 1080×1920 a 30 fps', () => {
    const g = buildFilterGraph({ ranges, width: 1080, height: 1920, hdr: false })
    expect(g).toContain('fps=30')
    expect(g.indexOf('fps=30')).toBeLessThan(g.indexOf('trim='))
    expect(g).toContain('trim=start=1.400:end=2.400')
    expect(g).toContain('atrim=start=3.900:end=5.100')
    expect(g).toContain('concat=n=2:v=1:a=1')
    expect(g).toContain('scale=1080:1920')
    expect(g).toContain('loudnorm=I=-14')
    expect(g).toContain('[vout]')
    expect(g).toContain('[aout]')
    expect(g).not.toContain('zscale')
    expect(g).not.toContain('ass=')
  })

  it('afegeix tonemap per a HDR, subtítols i logo quan cal', () => {
    const g = buildFilterGraph({
      ranges,
      width: 540,
      height: 960,
      hdr: true,
      assFile: 'subs.ass',
      fontsDir: 'fonts',
      logo: { x: 20, y: 20, width: 90 },
    })
    expect(g).toContain('tonemap=tonemap=hable')
    expect(g).toContain("ass='subs.ass':fontsdir='fonts'")
    expect(g).toContain('[1:v]scale=90:-1')
    expect(g).toContain('overlay=20:20')
  })
})

describe('subtítols ASS', () => {
  it('converteix colors i temps', () => {
    expect(hexToAss('#C21F1A')).toBe('&H001A1FC2')
    expect(assTime(3.456)).toBe('0:00:03.46')
    expect(assTime(75)).toBe('0:01:15.00')
  })

  it('posa el ganxo en els 3 primers segons i destaca la paraula', () => {
    const brand = defaultBrand()
    const ass = buildAss({
      subtitles: [{ id: '1', start: 4, end: 5, text: 'colors molt més càlids', highlight: 'càlids' }],
      hook: { line1: 'Edita reels', line2: 'amb Claude' },
      brand,
      duration: 10,
    })
    expect(ass).toContain('PlayResX: 1080')
    expect(ass).toContain('Style: Hook,Anton')
    expect(ass).toContain('Dialogue: 1,0:00:00.00,0:00:03.00,Hook,,0,0,0,,Edita reels\\Namb Claude')
    expect(ass).toContain('{\\c&H003CC9FF&\\b1}càlids{\\r}')
  })

  it('durant el ganxo no hi ha subtítols: un sol text gran', () => {
    const ass = buildAss({
      subtitles: [
        { id: '1', start: 0.2, end: 1.5, text: 'tapat pel ganxo', highlight: '' },
        { id: '2', start: 2.5, end: 4, text: 'comença en acabar', highlight: '' },
      ],
      hook: { line1: 'Títol', line2: '' },
      brand: defaultBrand(),
      duration: 10,
    })
    expect(ass).not.toContain('tapat pel ganxo')
    expect(ass).toContain('Dialogue: 0,0:00:03.00,0:00:04.00,Sub,,0,0,0,,comença en acabar')
  })

  it('escapa les claus del text', () => {
    const ass = buildAss({
      subtitles: [{ id: '1', start: 0, end: 1, text: 'a {b} c', highlight: '' }],
      hook: { line1: '', line2: '' },
      brand: defaultBrand(),
      duration: 1,
    })
    expect(ass).toContain('a (b) c')
    expect(ass).not.toContain('Hook,,0,0,0,,\\N')
  })
})

describe('parseSilences', () => {
  it('llig l’eixida de silencedetect', () => {
    const out = `[silencedetect @ 0x1] silence_start: 2.31
[silencedetect @ 0x1] silence_end: 3.95 | silence_duration: 1.64
[silencedetect @ 0x1] silence_start: 5.5`
    expect(parseSilences(out, 6)).toEqual([
      { start: 2.31, end: 3.95 },
      { start: 5.5, end: 6 },
    ])
  })
})
