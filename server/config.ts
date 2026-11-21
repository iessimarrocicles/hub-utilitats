import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Claus locals (ELEVENLABS_API_KEY…) en .env, fora de git.
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  /* sense .env */
}

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

// --- Videotutorials ---------------------------------------------------------
export const ROOT = root
export const TUTORIALS_DIR = path.join(WORKSPACE, 'tutorials')
export const MODELS_DIR = path.join(WORKSPACE, 'models')
export const VOICES_DIR = path.join(WORKSPACE, 'voices')
export const SESSION_FILE = path.join(WORKSPACE, 'browser-session.json')
export const PY_DIR = path.join(root, 'server', 'tutorials', 'py')
/** Python de l'entorn .venv (Kokoro, Whisper, F5-TTS). */
export const TTS_PYTHON =
  process.env.HUB_TTS_PYTHON ??
  (existsSync(path.join(root, '.venv', 'Scripts', 'python.exe'))
    ? path.join(root, '.venv', 'Scripts', 'python.exe')
    : existsSync(path.join(root, '.venv', 'bin', 'python'))
      ? path.join(root, '.venv', 'bin', 'python')
      : PYTHON)
export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? ''
export const ELEVENLABS_MODEL = process.env.HUB_ELEVENLABS_MODEL ?? 'eleven_multilingual_v2'
/** Format d'àudio. mp3_44100_128 funciona en tots els plans; 192 kbps demana Creator o superior. */
export const ELEVENLABS_FORMAT = process.env.HUB_ELEVENLABS_FORMAT ?? 'mp3_44100_128'
/** VoiceStudio local (API compatible amb OpenAI). «tts-1» = el motor actiu a l'aplicació. */
export const VOICESTUDIO_URL = (process.env.HUB_VOICESTUDIO_URL ?? 'http://127.0.0.1:3900').replace(/\/+$/, '')
export const VOICESTUDIO_MODEL = process.env.HUB_VOICESTUDIO_MODEL ?? 'tts-1'
/** Navegador per a capturar. Buit = el Chromium de Playwright. */
export const BROWSER_PATH = process.env.HUB_BROWSER_PATH ?? ''

/** Orígens que poden parlar amb el servidor. */
export const ALLOWED_ORIGINS = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, /^https:\/\/iessimarrocicles\.github\.io$/]

for (const dir of [WORKSPACE, REFERENCES_DIR, PROJECTS_DIR, FONTS_DIR, TMP_DIR, TUTORIALS_DIR, MODELS_DIR, VOICES_DIR]) mkdirSync(dir, { recursive: true })
