import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Look, Reference, ServerProject } from '../src/utilities/reels/auto/types.ts'
import { PROJECTS_DIR, REFERENCES_DIR, WORKSPACE } from './config.ts'

const REFS_INDEX = path.join(REFERENCES_DIR, 'index.json')
const LOOK_FILE = path.join(WORKSPACE, 'look.json')

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

/** Escriu primer en un fitxer temporal perquè un tall no deixe el JSON a mitges. */
async function writeJson(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await rename(tmp, file)
}

export const newId = () => randomUUID().slice(0, 8)

/** Només ids que hem generat nosaltres: evita eixir de la carpeta. */
export function isSafeId(id: string): boolean {
  return /^[a-f0-9-]{6,40}$/i.test(id)
}

export function projectDir(id: string): string {
  if (!isSafeId(id)) throw new Error('Identificador no vàlid.')
  return path.join(PROJECTS_DIR, id)
}

export async function listReferences(): Promise<Reference[]> {
  return readJson<Reference[]>(REFS_INDEX, [])
}

export async function saveReferences(refs: Reference[]): Promise<void> {
  await writeJson(REFS_INDEX, refs)
}

export async function getLook(): Promise<Look | null> {
  return readJson<Look | null>(LOOK_FILE, null)
}

export async function saveLook(look: Look): Promise<void> {
  await writeJson(LOOK_FILE, look)
}

export async function listProjects(): Promise<ServerProject[]> {
  const dirs = await readdir(PROJECTS_DIR, { withFileTypes: true })
  const out: ServerProject[] = []
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    const p = await readJson<ServerProject | null>(path.join(PROJECTS_DIR, d.name, 'project.json'), null)
    if (p) out.push(p)
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getProject(id: string): Promise<ServerProject | null> {
  const file = path.join(projectDir(id), 'project.json')
  if (!existsSync(file)) return null
  return readJson<ServerProject | null>(file, null)
}

export async function saveProject(p: ServerProject): Promise<ServerProject> {
  p.updatedAt = new Date().toISOString()
  await mkdir(projectDir(p.id), { recursive: true })
  await writeJson(path.join(projectDir(p.id), 'project.json'), p)
  return p
}

/** Llig, modifica i desa un projecte. */
export async function updateProject(id: string, change: (p: ServerProject) => void): Promise<ServerProject> {
  const p = await getProject(id)
  if (!p) throw new Error('No existeix aquest projecte.')
  change(p)
  return saveProject(p)
}
