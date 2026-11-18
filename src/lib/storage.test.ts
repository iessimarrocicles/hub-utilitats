import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageRepository, exportAll, importAll, loadValue, saveValue } from './storage'

type Item = { id: string; name: string }

describe('LocalStorageRepository', () => {
  beforeEach(() => localStorage.clear())

  it('desa, llista, obté i esborra elements', () => {
    const repo = new LocalStorageRepository<Item>('hub.test')
    repo.save({ id: 'a', name: 'A' })
    repo.save({ id: 'b', name: 'B' })
    expect(repo.list().map((i) => i.id)).toEqual(['a', 'b'])
    repo.save({ id: 'a', name: 'A2' })
    expect(repo.get('a')?.name).toBe('A2')
    expect(repo.list()).toHaveLength(2)
    repo.remove('a')
    expect(repo.get('a')).toBeUndefined()
  })

  it('torna una llista buida si les dades estan corruptes', () => {
    localStorage.setItem('hub.test', '{no json')
    expect(new LocalStorageRepository<Item>('hub.test').list()).toEqual([])
  })
})

describe('valors i còpia de seguretat', () => {
  beforeEach(() => localStorage.clear())

  it('carrega el valor per defecte quan no hi ha res', () => {
    expect(loadValue('hub.x', { a: 1 })).toEqual({ a: 1 })
    saveValue('hub.x', { a: 2 })
    expect(loadValue('hub.x', { a: 1 })).toEqual({ a: 2 })
  })

  it('exporta i importa només les claus del hub', () => {
    saveValue('hub.x', 1)
    localStorage.setItem('altra', 'z')
    const json = exportAll()
    localStorage.clear()
    expect(importAll(json)).toBe(1)
    expect(loadValue('hub.x', 0)).toBe(1)
    expect(localStorage.getItem('altra')).toBeNull()
  })
})
