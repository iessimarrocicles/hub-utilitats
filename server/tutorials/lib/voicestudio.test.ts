import { describe, expect, it } from 'vitest'
import { parseVoices, speechRequest } from './voicestudio.ts'

describe('speechRequest', () => {
  it('demana WAV en castellà amb el motor actiu si no se’n tria cap', () => {
    expect(speechRequest({ text: 'Hola', voice: '', speed: 1.1, model: '' })).toEqual({
      model: 'tts-1',
      input: 'Hola',
      voice: 'default',
      speed: 1.1,
      response_format: 'wav',
      language: 'es',
    })
  })
})

describe('parseVoices', () => {
  it('accepta una llista directa, dins de voices o dins de data', () => {
    expect(parseVoices([{ id: 'a', name: 'Anna' }]).map((v) => v.id)).toEqual(['default', 'a'])
    expect(parseVoices({ voices: [{ voice_id: 'b' }] })).toContainEqual({ id: 'b', name: 'b' })
    expect(parseVoices({ data: ['c'] })).toContainEqual({ id: 'c', name: 'c' })
  })

  it('no duplica la veu per defecte i ignora entrades buides', () => {
    const v = parseVoices([{ id: 'default', name: 'Default' }, {}, { name: '' }])
    expect(v).toEqual([{ id: 'default', name: 'Default' }])
  })

  it('torna només la veu per defecte si la resposta no és reconeixible', () => {
    expect(parseVoices({ algo: 1 })).toEqual([{ id: 'default', name: 'Veu per defecte del motor actiu' }])
  })
})
