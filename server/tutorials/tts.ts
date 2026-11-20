import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SceneAudio, TimedWord, TtsEngineId, VoiceOptions } from '../../src/utilities/tutorials/types.ts'
import { ELEVENLABS_API_KEY, ELEVENLABS_MODEL, MODELS_DIR, PY_DIR, TTS_PYTHON, VOICES_DIR } from '../config.ts'
import { run, runOk } from '../lib/run.ts'
import { alignToText, charsToWords, proportionalWords } from './lib/words.ts'

const KOKORO_MODEL = path.join(MODELS_DIR, 'kokoro', 'kokoro-v1.0.onnx')
const KOKORO_VOICES = path.join(MODELS_DIR, 'kokoro', 'voices-v1.0.bin')
const F5_CKPT = process.env.HUB_F5_CKPT ?? path.join(MODELS_DIR, 'f5-spanish', 'model_1250000.safetensors')
const ALIGN_MODEL = process.env.HUB_ALIGN_MODEL ?? 'small'
const CACHE_VERSION = 'v1'

export const KOKORO_SPANISH_VOICES = [
  { id: 'ef_dora', name: 'Dora (dona)' },
  { id: 'em_alex', name: 'Àlex (home)' },
  { id: 'em_santa', name: 'Santa (home, greu)' },
]

export interface SceneText {
  sceneId: string
  text: string
}

export interface TtsProgress {
  stage: (s: string, p?: number | null) => void
  notice: (s: string) => void
}

export function audioHash(text: string, voice: VoiceOptions): string {
  return createHash('sha1')
    .update([CACHE_VERSION, voice.engine, voice.voice, voice.speed.toFixed(2), text.trim()].join('|'))
    .digest('hex')
    .slice(0, 16)
}

export async function durationOf(file: string): Promise<number> {
  const r = await runOk('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
  return Number(r.stdout.trim()) || 0
}

/** Retalla els silencis dels extrems, neteja i normalitza la locució. */
async function polish(input: string, out: string): Promise<void> {
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05'
  await runOk('ffmpeg', [
    '-y', '-v', 'error', '-i', input,
    '-af', [trim, 'areverse', trim, 'areverse', 'highpass=f=70', 'deesser=i=0.25', 'loudnorm=I=-18:TP=-2:LRA=7', 'apad=pad_dur=0.15'].join(','),
    '-ar', '48000', '-ac', '1', out,
  ])
}

// --- Motors -------------------------------------------------------------------

async function kokoro(items: { text: string; raw: string }[], voice: VoiceOptions, workDir: string): Promise<void> {
  if (!existsSync(KOKORO_MODEL) || !existsSync(KOKORO_VOICES)) {
    throw new Error(`Falta el model de Kokoro a ${path.dirname(KOKORO_MODEL)}. Descarrega kokoro-v1.0.onnx i voices-v1.0.bin.`)
  }
  const job = path.join(workDir, `kokoro-${Date.now()}.json`)
  await writeFile(job, JSON.stringify(items.map((i) => ({ text: i.text, out: i.raw, voice: voice.voice, speed: voice.speed }))), 'utf8')
  await runOk(TTS_PYTHON, [path.join(PY_DIR, 'kokoro_tts.py'), KOKORO_MODEL, KOKORO_VOICES, job], { timeoutMs: 60 * 60_000 })
}

async function f5(items: { text: string; raw: string }[], voice: VoiceOptions, workDir: string): Promise<void> {
  const ref = path.join(VOICES_DIR, `${voice.voice}.wav`)
  const refText = path.join(VOICES_DIR, `${voice.voice}.txt`)
  if (!existsSync(ref) || !existsSync(refText)) {
    throw new Error(`Falta la mostra de veu «${voice.voice}». Puja-la a la pestanya Veus (10-15 s de veu neta).`)
  }
  const job = path.join(workDir, `f5-${Date.now()}.json`)
  await writeFile(job, JSON.stringify(items.map((i) => ({ text: i.text, out: i.raw, speed: voice.speed }))), 'utf8')
  await runOk(TTS_PYTHON, [path.join(PY_DIR, 'f5_synth.py'), ref, await readFile(refText, 'utf8'), job], { timeoutMs: 2 * 60 * 60_000 })
}

async function elevenlabs(text: string, voice: VoiceOptions, raw: string): Promise<TimedWord[]> {
  if (!ELEVENLABS_API_KEY) throw new Error('Falta ELEVENLABS_API_KEY al fitxer .env del hub.')
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voice)}/with-timestamps?output_format=mp3_44100_192`
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        language_code: 'es',
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: voice.speed },
      }),
    }).catch((e: Error) => ({ ok: false, status: 0, text: async () => e.message }) as unknown as Response)
    if (res.ok) {
      const data = (await res.json()) as {
        audio_base64: string
        alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }
      }
      await writeFile(raw, Buffer.from(data.audio_base64, 'base64'))
      return data.alignment ? charsToWords(text, data.alignment) : []
    }
    lastError = `${res.status} ${(await res.text()).slice(0, 300)}`
    if (res.status === 401 || res.status === 422) break
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
  }
  throw new Error(`ElevenLabs ha fallat: ${lastError}`)
}

async function alignBatch(items: { wav: string; text: string }[], workDir: string): Promise<TimedWord[][] | null> {
  const job = path.join(workDir, `align-${Date.now()}.json`)
  await writeFile(job, JSON.stringify(items), 'utf8')
  const r = await run(TTS_PYTHON, [path.join(PY_DIR, 'align.py'), ALIGN_MODEL, job], { timeoutMs: 60 * 60_000 })
  if (r.code !== 0) return null
  try {
    const out = JSON.parse(r.stdout) as { wav: string; words: TimedWord[] }[]
    return out.map((o) => o.words)
  } catch {
    return null
  }
}

// --- Entrada -------------------------------------------------------------------

/**
 * Genera la locució de cada escena. Reaprofita les que ja existeixen amb el mateix
 * text i la mateixa veu, de manera que editar una escena només en refà una.
 */
export async function synthesize(
  scenes: SceneText[],
  voice: VoiceOptions,
  audioDir: string,
  progress: TtsProgress,
): Promise<SceneAudio[]> {
  await mkdir(audioDir, { recursive: true })
  const result = new Map<string, SceneAudio>()
  const pending: (SceneText & { hash: string; raw: string; wav: string })[] = []

  for (const s of scenes) {
    const hash = audioHash(s.text, voice)
    const wav = path.join(audioDir, `${hash}.wav`)
    const meta = path.join(audioDir, `${hash}.json`)
    if (existsSync(wav) && existsSync(meta)) {
      const cached = JSON.parse(await readFile(meta, 'utf8')) as SceneAudio
      result.set(s.sceneId, { ...cached, sceneId: s.sceneId })
    } else {
      pending.push({ ...s, hash, wav, raw: path.join(audioDir, `${hash}.raw.${voice.engine === 'elevenlabs' ? 'mp3' : 'wav'}`) })
    }
  }

  if (pending.length) {
    const name = ENGINE_NAMES[voice.engine]
    progress.stage(`Generant la veu amb ${name} (${pending.length} escenes)`, 0.05)
    const known = new Map<string, TimedWord[]>()
    if (voice.engine === 'kokoro') await kokoro(pending, voice, audioDir)
    else if (voice.engine === 'f5') await f5(pending, voice, audioDir)
    else {
      for (const [k, p] of pending.entries()) {
        progress.stage(`ElevenLabs: escena ${k + 1} de ${pending.length}`, 0.05 + (0.5 * k) / pending.length)
        known.set(p.sceneId, await elevenlabs(p.text, voice, p.raw))
      }
    }

    progress.stage('Netejant i normalitzant la veu', 0.6)
    for (const p of pending) await polish(p.raw, p.wav)
    const durations = await Promise.all(pending.map((p) => durationOf(p.wav)))

    // ElevenLabs dona temps per caràcter, però el retall de silencis els desplaça: també s'alinea.
    progress.stage('Calculant el temps de cada paraula', 0.75)
    const aligned = await alignBatch(pending.map((p) => ({ wav: p.wav, text: p.text })), audioDir)
    if (!aligned) progress.notice('No s’ha pogut alinear la veu amb Whisper. Els subtítols van per estimació.')

    for (const [k, p] of pending.entries()) {
      const words = aligned ? alignToText(p.text, aligned[k], durations[k]) : proportionalWords(p.text, durations[k])
      const audio: SceneAudio = { sceneId: p.sceneId, file: path.basename(p.wav), duration: durations[k], words, hash: p.hash }
      await writeFile(path.join(audioDir, `${p.hash}.json`), JSON.stringify(audio), 'utf8')
      result.set(p.sceneId, audio)
    }
  }
  progress.stage('Veu preparada', 1)
  return scenes.map((s) => result.get(s.sceneId)!)
}

export const ENGINE_NAMES: Record<TtsEngineId, string> = {
  kokoro: 'Kokoro (local)',
  f5: 'F5-TTS (local, la teua veu)',
  elevenlabs: 'ElevenLabs',
}

/** Quins motors estan llestos en aquest ordinador. */
export async function engineStatus(): Promise<Record<TtsEngineId, { ready: boolean; detail: string }>> {
  const py = async (code: string) => (await run(TTS_PYTHON, ['-c', code], { timeoutMs: 60_000 }).catch(() => ({ code: 1 }))).code === 0
  const [kokoroPy, f5Py] = await Promise.all([
    py('import kokoro_onnx, soundfile'),
    py('import f5_tts, torch; assert torch.cuda.is_available()'),
  ])
  const kokoroFiles = existsSync(KOKORO_MODEL) && existsSync(KOKORO_VOICES)
  return {
    kokoro: {
      ready: kokoroPy && kokoroFiles,
      detail: !kokoroPy ? 'Falta kokoro-onnx a .venv' : !kokoroFiles ? 'Falta el model a workspace/models/kokoro' : 'Llest',
    },
    f5: {
      ready: f5Py && existsSync(F5_CKPT),
      detail: !f5Py ? 'Falta F5-TTS o PyTorch amb CUDA a .venv' : !existsSync(F5_CKPT) ? 'Falta el model en castellà a workspace/models/f5-spanish' : 'Llest (GPU)',
    },
    elevenlabs: { ready: !!ELEVENLABS_API_KEY, detail: ELEVENLABS_API_KEY ? 'Clau configurada' : 'Falta ELEVENLABS_API_KEY a .env' },
  }
}
