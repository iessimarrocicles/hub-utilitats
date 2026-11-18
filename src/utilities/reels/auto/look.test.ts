import { describe, expect, it } from 'vitest'
import { defaultBrand } from '../model'
import { applyLook } from './look'
import type { LookResult } from './types'

const look: LookResult = {
  summary: '',
  colors: { primary: '#000001', secondary: '#000002', highlight: '#000003', text: '#000004', background: '#000005' },
  titleFont: 'Bebas Neue',
  bodyFont: 'Inter',
  hook: { position: 'darrere-del-cap', size: 150 },
  subtitles: { size: 70, color: '#000006', highlightStyle: 'color', box: false, height: 66 },
  logoCorner: 'superior-dreta',
  transitions: 'Talls cada 2 s',
  sound: 'Sense música',
  notes: [],
}

describe('applyLook', () => {
  it('copia l’estil de les referències a la fitxa', () => {
    const b = applyLook(defaultBrand(), look, false)
    expect(b.colors.primary).toBe('#000001')
    expect(b.fonts.title).toEqual({ family: 'Bebas Neue', file: 'fonts/BebasNeue.ttf' })
    expect(b.hook).toMatchObject({ position: 'darrere-del-cap', size: 150 })
    expect(b.subtitles).toMatchObject({ size: 70, color: '#000006', box: false, height: 66 })
    expect(b.logo.corner).toBe('superior-dreta')
  })

  it('pot mantindre els colors propis i no toca el nom, el to ni el logo', () => {
    const base = defaultBrand()
    base.logo.dataUrl = 'data:image/png;base64,AAA'
    const b = applyLook(base, look, true)
    expect(b.colors).toEqual(base.colors)
    expect(b.subtitles.color).toBe(base.subtitles.color)
    expect(b.name).toBe(base.name)
    expect(b.tone).toBe(base.tone)
    expect(b.logo.dataUrl).toBe('data:image/png;base64,AAA')
  })
})
