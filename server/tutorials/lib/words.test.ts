import { describe, expect, it } from 'vitest'
import { alignToText, charsToWords, proportionalWords, tokenize } from './words.ts'

describe('tokenize', () => {
  it('separa per espais i descarta buits', () => {
    expect(tokenize('  Hola,  món ')).toEqual(['Hola,', 'món'])
  })
})

describe('proportionalWords', () => {
  it('cobreix la durada en ordre i sense solapaments', () => {
    const w = proportionalWords('Pulsa el botón Guardar', 2)
    expect(w).toHaveLength(4)
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBeGreaterThanOrEqual(w[i - 1].end)
    expect(w.at(-1)!.end).toBeLessThanOrEqual(2)
  })
})

describe('alignToText', () => {
  it('conserva l’ortografia del guió amb els temps del reconeixement', () => {
    const asr = [
      { w: 'pulsa', start: 0.1, end: 0.4 },
      { w: 'el', start: 0.45, end: 0.5 },
      { w: 'boton', start: 0.55, end: 0.9 },
    ]
    expect(alignToText('Pulsa el botón', asr, 1)).toEqual([
      { w: 'Pulsa', start: 0.1, end: 0.4 },
      { w: 'el', start: 0.45, end: 0.5 },
      { w: 'botón', start: 0.55, end: 0.9 },
    ])
  })

  it('interpola les paraules que no s’han reconegut', () => {
    const asr = [
      { w: 'abre', start: 0, end: 0.3 },
      { w: 'menú', start: 1.0, end: 1.3 },
    ]
    const out = alignToText('Abre el gran menú', asr, 1.5)
    expect(out.map((w) => w.w)).toEqual(['Abre', 'el', 'gran', 'menú'])
    expect(out[1].start).toBeGreaterThanOrEqual(0.3)
    expect(out[2].end).toBeLessThanOrEqual(1.0)
  })

  it('sense reconeixement, reparteix proporcionalment', () => {
    expect(alignToText('una dos', [], 1)).toHaveLength(2)
  })
})

describe('charsToWords', () => {
  it('agrupa els caràcters en paraules', () => {
    const chars = 'Hola món'.split('')
    const out = charsToWords('Hola món', {
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
    })
    expect(out).toEqual([
      { w: 'Hola', start: 0, end: 0.4 },
      { w: 'món', start: 0.5, end: 0.8 },
    ])
  })
})
