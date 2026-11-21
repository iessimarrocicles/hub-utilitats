import { describe, expect, it } from 'vitest'
import type { CompositionInput, Storyboard } from '../../src/utilities/tutorials/types.ts'
import { balanceLines, COVER_SECONDS, coverMinutes, coverText, estimateSeconds, fitSize, minutesLabel, projectCover } from './cover.ts'
import { buildTimeline } from './timeline.ts'

const board: Storyboard = {
  title: 'Cómo usar Leonardo.ai',
  summary: '',
  startUrl: 'https://leonardo.ai',
  takeaways: [],
  chapters: [{ id: 'c1', title: 'Registro', scenes: [{ id: 's1', narration: 'Hola', actions: [] }] }],
}

describe('minuts de la portada', () => {
  it('arredoneix i mai baixa d’un minut', () => {
    expect(coverMinutes(130)).toBe(2)
    expect(coverMinutes(420)).toBe(7)
    expect(coverMinutes(20)).toBe(1)
    expect(coverMinutes(0)).toBe(1)
  })

  it('escriu el singular i el plural en valencià', () => {
    expect(minutesLabel(1)).toBe('1 MINUT')
    expect(minutesLabel(7)).toBe('7 MINUTS')
  })
})

describe('coverText', () => {
  it('usa els textos del guió i hi posa la marca per defecte si falta', () => {
    expect(coverText({ ...board, cover: { title: 'LEONARDO.AI', subtitle: 'Registre', brand: '' } })).toEqual({
      title: 'LEONARDO.AI',
      subtitle: 'Registre',
      brand: 'DOCENTSTIC',
    })
  })

  it('sense textos al guió, el títol ix del títol del tutorial', () => {
    expect(coverText(board)).toEqual({ title: 'Cómo usar Leonardo.ai', subtitle: '', brand: 'DOCENTSTIC' })
  })
})

describe('projectCover', () => {
  it('prefereix els textos editats per l’usuari', () => {
    const p = { name: 'x', storyboard: { ...board, cover: { title: 'CLAUDE', subtitle: 'A', brand: 'B' } }, cover: { title: 'MEU', subtitle: 'S', brand: '' } }
    expect(projectCover(p)).toEqual({ title: 'MEU', subtitle: 'S', brand: 'DOCENTSTIC' })
  })

  it('sense edició, usa la proposta del guió; sense guió, el nom', () => {
    expect(projectCover({ name: 'x', storyboard: { ...board, cover: { title: 'CLAUDE', subtitle: 'A', brand: 'B' } } }).title).toBe('CLAUDE')
    expect(projectCover({ name: 'El meu tutorial' }).title).toBe('El meu tutorial')
  })
})

describe('estimateSeconds', () => {
  it('calcula a 140 paraules per minut', () => {
    const words = Array(140).fill('hola').join(' ')
    expect(estimateSeconds({ chapters: [{ id: 'c', title: '', scenes: [{ id: 's', narration: words, actions: [] }] }] })).toBe(60)
  })
})

describe('fitSize', () => {
  it('manté la mida base si el text cap i la reduïx si és llarg', () => {
    expect(fitSize('LEONARDO.AI', 1000, 190, 80)).toBe(190)
    const long = fitSize('UNA EINA AMB UN NOM MOLT LLARG', 1000, 190, 80)
    expect(long).toBeLessThan(190)
    expect(long).toBeGreaterThanOrEqual(80)
  })

  it('mira la línia més llarga i no baixa del mínim', () => {
    expect(fitSize('CURT\nCURT', 1000, 190, 80)).toBe(190)
    expect(fitSize('X'.repeat(200), 1000, 190, 80)).toBe(80)
  })
})

describe('balanceLines', () => {
  it('deixa en una línia els textos curts', () => {
    expect(balanceLines('SUBTITOL')).toBe('SUBTITOL')
  })

  it('parteix els llargs pel buit més centrat', () => {
    expect(balanceLines('REGISTRE I INTERFÍCIE D’USUARI')).toBe('REGISTRE I\nINTERFÍCIE D’USUARI')
  })

  it('respecta els salts que ja hi ha i les paraules soles', () => {
    expect(balanceLines('UNA\nDUES TRES')).toBe('UNA\nDUES TRES')
    expect(balanceLines('SUPERCALIFRAGILISTICOEXPIALIDOS')).toBe('SUPERCALIFRAGILISTICOEXPIALIDOS')
  })
})

describe('portada a la línia de temps', () => {
  const input: Pick<CompositionInput, 'storyboard' | 'capture' | 'audio' | 'graphics' | 'cover'> = {
    storyboard: board,
    capture: {
      file: 'c.mp4',
      width: 1920,
      height: 1080,
      viewport: { width: 1280, height: 720 },
      fps: 60,
      duration: 10,
      events: [],
      scenes: [{ sceneId: 's1', chapterId: 'c1', start: 1, end: 6 }],
      focus: {},
    },
    audio: [{ sceneId: 's1', file: 'a.wav', duration: 4, words: [], hash: 'h', src: 'a.wav' }],
    graphics: [],
  }

  it('sense portada, el vídeo comença directament', () => {
    const t = buildTimeline(input)
    expect(t.segments[0].kind).toBe('capture')
    expect(t.duration).toBe(5)
  })

  it('amb portada al vídeo, ocupa els primers segons i desplaça la veu', () => {
    const t = buildTimeline({ ...input, cover: { title: 'X', subtitle: '', brand: 'B', inVideo: true } })
    expect(t.segments[0]).toEqual({ kind: 'cover', from: 0, duration: COVER_SECONDS })
    expect(t.segments[1].from).toBe(COVER_SECONDS)
    expect(t.voices[0].at).toBeCloseTo(COVER_SECONDS + 0.15)
    expect(t.duration).toBe(5 + COVER_SECONDS)
  })

  it('si la portada només és per a la imatge, el vídeo no canvia', () => {
    const t = buildTimeline({ ...input, cover: { title: 'X', subtitle: '', brand: 'B', inVideo: false } })
    expect(t.segments[0].kind).toBe('capture')
  })
})
