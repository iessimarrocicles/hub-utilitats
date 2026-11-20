import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { StyleTemplate, TutorialProject } from '../../src/utilities/tutorials/types.ts'
import { TUTORIALS_DIR, WORKSPACE } from '../config.ts'
import { isSafeId } from '../store.ts'

const TEMPLATES_FILE = path.join(WORKSPACE, 'tutorial-templates.json')

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await rename(tmp, file)
}

export function tutorialDir(id: string): string {
  if (!isSafeId(id)) throw new Error('Identificador no vàlid.')
  return path.join(TUTORIALS_DIR, id)
}

export async function listTutorials(): Promise<TutorialProject[]> {
  const dirs = await readdir(TUTORIALS_DIR, { withFileTypes: true })
  const out: TutorialProject[] = []
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    const p = await readJson<TutorialProject | null>(path.join(TUTORIALS_DIR, d.name, 'project.json'), null)
    if (p) out.push(p)
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getTutorial(id: string): Promise<TutorialProject | null> {
  const file = path.join(tutorialDir(id), 'project.json')
  if (!existsSync(file)) return null
  return readJson<TutorialProject | null>(file, null)
}

export async function saveTutorial(p: TutorialProject): Promise<TutorialProject> {
  p.updatedAt = new Date().toISOString()
  await mkdir(tutorialDir(p.id), { recursive: true })
  await writeJson(path.join(tutorialDir(p.id), 'project.json'), p)
  return p
}

export async function updateTutorial(id: string, change: (p: TutorialProject) => void): Promise<TutorialProject> {
  const p = await getTutorial(id)
  if (!p) throw new Error('No existeix aquest tutorial.')
  change(p)
  return saveTutorial(p)
}

/** Plantilles que l'usuari ha creat o modificat. Les de sèrie viuen al codi. */
export async function customTemplates(): Promise<StyleTemplate[]> {
  return readJson<StyleTemplate[]>(TEMPLATES_FILE, [])
}

export async function saveCustomTemplates(list: StyleTemplate[]): Promise<void> {
  await writeJson(TEMPLATES_FILE, list)
}
