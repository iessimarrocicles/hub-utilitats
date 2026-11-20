import { describe, expect, it } from 'vitest'
import type { CaptureEvent } from '../../src/utilities/tutorials/types.ts'
import { buildShots, cameraTrack, cameraTransform, cursorAt } from './camera.ts'

const VP = { width: 1920, height: 1080 }
const ev = (e: Partial<CaptureEvent>): CaptureEvent => ({ t: 0, dur: 0, type: 'click', x: 0, y: 0, sceneId: 's1', ...e })

describe('buildShots', () => {
  it('s’acosta als clics sobre elements petits', () => {
    const shots = buildShots([ev({ t: 5, box: { x: 900, y: 500, width: 120, height: 40 } })], VP, 1.8)
    expect(shots).toHaveLength(1)
    expect(shots[0].start).toBeLessThan(5)
    expect(shots[0].target.z).toBeCloseTo(1.8)
    expect(shots[0].target.cx).toBe(960)
  })

  it('no fa zoom en elements que ja són grans', () => {
    expect(buildShots([ev({ t: 5, box: { x: 0, y: 0, width: 1500, height: 900 } })], VP, 1.8)).toHaveLength(0)
  })

  it('ajunta plans pròxims sense solapar-los', () => {
    const shots = buildShots(
      [ev({ t: 5, box: { x: 100, y: 100, width: 100, height: 30 } }), ev({ t: 6, box: { x: 800, y: 600, width: 100, height: 30 } })],
      VP,
      1.6,
    )
    expect(shots).toHaveLength(2)
    expect(shots[1].start).toBeGreaterThanOrEqual(shots[0].end - 0.0001)
  })
})

describe('buildShots amb el mateix element', () => {
  it('clicar i escriure en el mateix camp fa un sol pla, sense buits', () => {
    const box = { x: 685, y: 175, width: 550, height: 66 }
    const shots = buildShots(
      [
        ev({ type: 'click', t: 20.49, dur: 0.06, box }),
        ev({ type: 'type', t: 20.82, dur: 3.02, box }),
        ev({ type: 'click', t: 25.26, dur: 0.06, box }),
        ev({ type: 'type', t: 25.58, dur: 1.5, box }),
      ],
      VP,
      1.6,
    )
    expect(shots).toHaveLength(1)
    expect(shots[0].start).toBeLessThan(20.49)
    expect(shots[0].end).toBeGreaterThan(27)
  })

  it('entre elements diferents pròxims no hi ha cap buit', () => {
    const shots = buildShots(
      [ev({ t: 5, box: { x: 100, y: 100, width: 100, height: 30 } }), ev({ t: 6.5, box: { x: 800, y: 600, width: 100, height: 30 } })],
      VP,
      1.6,
    )
    expect(shots).toHaveLength(2)
    expect(shots[1].start).toBeCloseTo(shots[0].end)
  })
})

describe('cameraTrack', () => {
  it('arriba suaument a l’objectiu i torna a la vista general', () => {
    const overview = { cx: 960, cy: 540, z: 1 }
    const track = cameraTrack(10, 60, [{ start: 2, end: 6, target: { cx: 400, cy: 300, z: 2 } }], overview)
    expect(track[0].z).toBeCloseTo(1)
    expect(track[Math.round(5 * 60)].z).toBeGreaterThan(1.9)
    expect(track.at(-1)!.z).toBeLessThan(1.1)
    // Sense salts entre fotogrames.
    for (let i = 1; i < track.length; i++) expect(Math.abs(track[i].z - track[i - 1].z)).toBeLessThan(0.05)
  })
})

describe('cameraTransform', () => {
  it('a zoom 1 la pàgina cap sencera i centrada', () => {
    const tr = cameraTransform({ cx: 960, cy: 540, z: 1 }, VP, 1600, 900, 'contain')
    expect(tr.scale).toBeCloseTo(1600 / 1920)
    expect(tr.x).toBeCloseTo(0)
  })

  it('amb zoom no ensenya res de fora de la pàgina', () => {
    const tr = cameraTransform({ cx: 0, cy: 0, z: 2 }, VP, 1600, 900, 'contain')
    expect(tr.x).toBe(0)
    expect(tr.y).toBe(0)
  })
})

describe('cursorAt', () => {
  it('segueix el moviment i marca el clic', () => {
    const events = [ev({ type: 'move', t: 1, dur: 1, x: 100, y: 100 }), ev({ type: 'click', t: 2.2, x: 100, y: 100 })]
    const mid = cursorAt(1.5, events, { x: 0, y: 0 })
    expect(mid.x).toBeGreaterThan(0)
    expect(mid.x).toBeLessThan(100)
    const click = cursorAt(2.25, events, { x: 0, y: 0 })
    expect(click.x).toBe(100)
    expect(click.click).toBeGreaterThan(0.5)
  })
})
