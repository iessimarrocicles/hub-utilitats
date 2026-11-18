import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const PORT = Number(process.env.HUB_PORT ?? 8787)
export const WORKSPACE = path.resolve(process.env.HUB_WORKSPACE ?? path.join(root, 'workspace'))
export const REFERENCES_DIR = path.join(WORKSPACE, 'references')
export const PROJECTS_DIR = path.join(WORKSPACE, 'projects')
export const FONTS_DIR = path.join(WORKSPACE, 'fonts')
export const TMP_DIR = path.join(WORKSPACE, 'tmp')
export const PY_TRANSCRIBE = path.join(root, 'server', 'py', 'transcribe.py')

/** Model de Whisper: tiny, base, small, medium. small és un bon equilibri en CPU. */
export const WHISPER_MODEL = process.env.HUB_WHISPER_MODEL ?? 'small'
/** Model de Claude Code. Buit = el que tinga configurat l'usuari. */
export const CLAUDE_MODEL = process.env.HUB_CLAUDE_MODEL ?? ''
export const PYTHON = process.env.HUB_PYTHON ?? 'python'

/** Orígens que poden parlar amb el servidor. */
export const ALLOWED_ORIGINS = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, /^https:\/\/iessimarrocicles\.github\.io$/]

for (const dir of [WORKSPACE, REFERENCES_DIR, PROJECTS_DIR, FONTS_DIR, TMP_DIR]) mkdirSync(dir, { recursive: true })
