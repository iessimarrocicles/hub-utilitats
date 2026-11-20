import { describe, expect, it } from 'vitest'
import { planScene } from './capture.ts'

describe('planScene', () => {
  it('sense accions, dura el que dura la veu més un poc d’aire', () => {
    const p = planScene([], 4)
    expect(p.gaps).toEqual([])
    expect(p.duration).toBeCloseTo(4.45)
  })

  it('reparteix les accions dins de la veu', () => {
    const p = planScene([1, 1], 8)
    expect(p.gaps[0]).toBeCloseTo(0.6)
    expect(p.gaps[1]).toBeGreaterThan(0.35)
    // Ni més curta que la veu ni molt més llarga.
    expect(p.duration).toBeGreaterThanOrEqual(8)
    expect(p.duration).toBeLessThan(9)
  })

  it('si les accions no hi caben, l’escena s’allarga en lloc de tallar-les', () => {
    const p = planScene([3, 3, 3], 4)
    expect(p.duration).toBeGreaterThan(9)
  })
})
