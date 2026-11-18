/**
 * Capa d'emmagatzematge local. Tot passa per aquestes funcions perquè
 * més endavant es puga canviar localStorage per Supabase sense tocar la UI.
 */
export const HUB_PREFIX = 'hub.'

export interface Repository<T extends { id: string }> {
  list(): T[]
  get(id: string): T | undefined
  save(item: T): void
  remove(id: string): void
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* emmagatzematge no disponible o ple */
  }
}

export function loadValue<T>(key: string, fallback: T): T {
  const raw = read(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveValue<T>(key: string, value: T): void {
  write(key, JSON.stringify(value))
}

export class LocalStorageRepository<T extends { id: string }> implements Repository<T> {
  private readonly key: string

  constructor(key: string) {
    this.key = key
  }

  list(): T[] {
    const items = loadValue<unknown>(this.key, [])
    return Array.isArray(items) ? (items as T[]) : []
  }

  get(id: string): T | undefined {
    return this.list().find((i) => i.id === id)
  }

  save(item: T): void {
    const items = this.list()
    const idx = items.findIndex((i) => i.id === item.id)
    if (idx >= 0) items[idx] = item
    else items.push(item)
    saveValue(this.key, items)
  }

  remove(id: string): void {
    saveValue(
      this.key,
      this.list().filter((i) => i.id !== id),
    )
  }
}

/** Còpia de seguretat de totes les dades del hub en un JSON. */
export function exportAll(): string {
  const data: Record<string, unknown> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(HUB_PREFIX)) data[key] = loadValue(key, null)
    }
  } catch {
    /* sense accés */
  }
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
}

/** Importa una còpia. Torna quantes claus s'han restaurat. */
export function importAll(json: string): number {
  const parsed = JSON.parse(json) as { data?: Record<string, unknown> }
  if (!parsed || typeof parsed.data !== 'object' || parsed.data == null) {
    throw new Error('El fitxer no és una còpia del hub.')
  }
  let count = 0
  for (const [key, value] of Object.entries(parsed.data)) {
    if (!key.startsWith(HUB_PREFIX)) continue
    saveValue(key, value)
    count++
  }
  return count
}

export function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
}
