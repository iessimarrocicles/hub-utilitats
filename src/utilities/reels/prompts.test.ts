import { describe, expect, it } from 'vitest'
import {
  buildEditPrompt,
  buildEffectsPrompt,
  buildFeedbackPrompt,
  buildMarcaMd,
  buildPhrasesPrompt,
  cleanFileName,
  normalizeTime,
} from './prompts'
import { createProject, defaultBrand } from './model'

describe('normalizeTime', () => {
  it('accepta segons, m:ss i text buit', () => {
    expect(normalizeTime('12')).toBe('0:12')
    expect(normalizeTime('75')).toBe('1:15')
    expect(normalizeTime('1:05')).toBe('1:05')
    expect(normalizeTime(' ')).toBe('')
    expect(normalizeTime('final')).toBe('final')
  })
})

describe('cleanFileName', () => {
  it('canvia l’extensió per -limpio.mp4', () => {
    expect(cleanFileName('IMG_0001.MOV')).toBe('IMG_0001-limpio.mp4')
    expect(cleanFileName('reel')).toBe('reel-limpio.mp4')
  })
})

describe('buildEditPrompt', () => {
  it('nomena el fitxer, la carpeta i les revisions', () => {
    const p = createProject({ name: 'Prova', rawFile: 'IMG_0001.MOV' })
    const text = buildEditPrompt(p)
    expect(text).toContain('IMG_0001.MOV')
    expect(text).toContain('editor-reels')
    expect(text).toContain('storyboard')
    expect(text).toContain('Exportados')
  })
})

describe('buildFeedbackPrompt', () => {
  it('inclou només les correccions pendents i les que van a marca.md', () => {
    const p = createProject({ name: 'P', rawFile: 'a.mov' })
    p.feedback = [
      { id: '1', time: '0:12', text: 'sobra la pausa', resolved: false, toBrand: false },
      { id: '2', time: '0:20', text: 'el títol tapa la cara', resolved: false, toBrand: true },
      { id: '3', time: '0:30', text: 'ja resolt', resolved: true, toBrand: false },
    ]
    const text = buildFeedbackPrompt(p)
    expect(text).toContain('0:12: sobra la pausa')
    expect(text).toContain('0:20: el títol tapa la cara')
    expect(text).not.toContain('ja resolt')
    expect(text).toContain('marca.md')
  })

  it('torna buit si no hi ha res pendent', () => {
    expect(buildFeedbackPrompt(createProject({ name: 'P', rawFile: 'a.mov' }))).toBe('')
  })
})

describe('buildPhrasesPrompt', () => {
  it('posa cada frase amb el seu segon', () => {
    const p = createProject({ name: 'P', rawFile: 'a.mov' })
    p.phrases = [{ id: 'x', phraseId: 'calid', time: '0:05' }]
    const text = buildPhrasesPrompt(p)
    expect(text).toContain('0:05')
    expect(text.toLowerCase()).toContain('alegre')
  })
})

describe('buildEffectsPrompt', () => {
  it('usa la còpia neta i cada efecte amb el seu ancoratge', () => {
    const p = createProject({ name: 'P', rawFile: 'IMG_9.MOV' })
    p.effects = [
      { id: 'a', effectId: 1, anchor: 'Claude' },
      { id: 'b', effectId: 4, anchor: 'diners' },
    ]
    const text = buildEffectsPrompt(p)
    expect(text).toContain('efectos-reels')
    expect(text).toContain('IMG_9-limpio.mp4')
    expect(text).toContain('«Claude»')
    expect(text).toContain('«diners»')
  })

  it('avisa si cal la presa de l’habitació buida i no està gravada', () => {
    const p = createProject({ name: 'P', rawFile: 'a.mov' })
    p.effects = [{ id: 'a', effectId: 27, anchor: '' }]
    p.emptyRoom = false
    expect(buildEffectsPrompt(p)).toContain('habitació buida')
  })
})

describe('buildMarcaMd', () => {
  it('genera totes les seccions de marca.md', () => {
    const md = buildMarcaMd(defaultBrand())
    for (const h of ['# Marca', '## Colors', '## Lletres', '## Títol del ganxo', '## Subtítols', '## Logo', '## Transicions', '## So', '## Regles fixes']) {
      expect(md).toContain(h)
    }
    expect(md).toMatch(/#[0-9A-Fa-f]{6}/)
  })
})
