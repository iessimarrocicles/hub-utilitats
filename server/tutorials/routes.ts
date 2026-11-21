import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BUILTIN_TEMPLATES, GRAPHICS } from '../../src/utilities/tutorials/catalog.ts'
import { TTS_ENGINES, type CoverText, type GenerateSettings, type StyleTemplate, type TutorialProject, type VoiceOptions } from '../../src/utilities/tutorials/types.ts'
import { ELEVENLABS_API_KEY, PY_DIR, SESSION_FILE, TMP_DIR, TTS_PYTHON, TUTORIALS_DIR, VOICES_DIR } from '../config.ts'
import { latestJob, runningJob, startJob } from '../jobs.ts'
import { runOk } from '../lib/run.ts'
import { newId } from '../store.ts'
import { friendlyError, loginSession } from './browser.ts'
import { analyzeAndScript, generate, makeCoverStill, makeVoice } from './pipeline.ts'
import { dryRun } from './script.ts'
import { customTemplates, getTutorial, listTutorials, saveCustomTemplates, saveTutorial, tutorialDir, updateTutorial } from './store.ts'
import { ENGINE_NAMES, engineStatus, KOKORO_SPANISH_VOICES, synthesize, voicestudioVoices } from './tts.ts'

type Handler = (req: Request, res: Response) => Promise<unknown>
const wrap = (h: Handler) => (req: Request, res: Response, next: NextFunction) => h(req, res).catch(next)
const fail = (status: number, msg: string) => Object.assign(new Error(msg), { status })

async function project(req: Request): Promise<TutorialProject> {
  const id = String(req.params.id ?? '')
  tutorialDir(id) // valida l'id
  const p = await getTutorial(id)
  if (!p) throw fail(404, 'No existeix aquest tutorial.')
  return p
}

function validUrl(u: unknown): string {
  try {
    const url = new URL(String(u ?? '').trim())
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    return url.toString()
  } catch {
    throw fail(400, 'Escriu una adreça web completa (https://…).')
  }
}

function voiceFrom(v: Partial<VoiceOptions> | undefined): VoiceOptions {
  const engine = v?.engine && TTS_ENGINES.includes(v.engine) ? v.engine : 'kokoro'
  return { engine, voice: String(v?.voice || 'ef_dora'), speed: Math.min(1.25, Math.max(0.75, Number(v?.speed ?? 1))) }
}

function settingsFrom(body: Partial<GenerateSettings> | undefined): GenerateSettings {
  const ids = new Set(GRAPHICS.map((g) => g.id))
  return {
    templateId: String(body?.templateId || BUILTIN_TEMPLATES[0].id),
    format: body?.format && ['1080p', '4k', 'vertical'].includes(body.format) ? body.format : '1080p',
    voice: voiceFrom(body?.voice),
    graphics: (body?.graphics ?? []).filter((g) => ids.has(g)),
    coverInVideo: body?.coverInVideo !== false,
  }
}

function coverFrom(c: Partial<CoverText> | null | undefined): CoverText | undefined {
  if (!c) return undefined
  const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
  return { title: clip(c.title, 60), subtitle: clip(c.subtitle, 90), brand: clip(c.brand, 40) }
}

/** Una sola tasca alhora per tutorial. */
function startTutorialJob(
  res: Response,
  kind: Parameters<typeof startJob>[0],
  id: string,
  work: Parameters<typeof startJob>[2],
): void {
  if (runningJob(id)) throw fail(409, 'Aquest tutorial ja té una tasca en marxa.')
  // Errors llegibles: sense codis de color ni registres interns de Playwright.
  const safe: typeof work = async (ctx) => {
    try {
      await work(ctx)
    } catch (err) {
      throw new Error(friendlyError(err as Error))
    }
  }
  const job = startJob(kind, id, safe, async (err) => {
    await updateTutorial(id, (t) => {
      t.status = 'error'
      t.lastError = err.message
    }).catch(() => {})
  })
  res.json(job)
}

export function registerTutorialRoutes(app: Express): void {
  const upload = multer({ dest: TMP_DIR, limits: { fileSize: 200 * 1024 ** 2 } })
  app.use('/files/tutorials', express.static(TUTORIALS_DIR, { dotfiles: 'deny' }))
  app.use('/files/voices', express.static(VOICES_DIR, { dotfiles: 'deny' }))

  // --- Dades per a la interfície ---------------------------------------------
  app.get(
    '/api/tutorials/meta',
    wrap(async (_req, res) => {
      const voices = existsSync(VOICES_DIR) ? (await readdir(VOICES_DIR)).filter((f) => f.endsWith('.wav')).map((f) => f.replace(/\.wav$/, '')) : []
      res.json({
        templates: [...BUILTIN_TEMPLATES, ...(await customTemplates())],
        builtinIds: BUILTIN_TEMPLATES.map((t) => t.id),
        graphics: GRAPHICS,
        engines: await engineStatus(),
        engineNames: ENGINE_NAMES,
        kokoroVoices: KOKORO_SPANISH_VOICES,
        f5Voices: voices,
        session: existsSync(SESSION_FILE),
      })
    }),
  )

  app.put(
    '/api/tutorials/templates',
    wrap(async (req, res) => {
      const list = (req.body as { templates?: StyleTemplate[] })?.templates
      if (!Array.isArray(list)) throw fail(400, 'Falten les plantilles.')
      const builtin = new Set(BUILTIN_TEMPLATES.map((t) => t.id))
      await saveCustomTemplates(list.filter((t) => t?.id && !builtin.has(t.id)))
      res.json(await customTemplates())
    }),
  )

  app.get(
    '/api/tutorials/elevenlabs/voices',
    wrap(async (_req, res) => {
      if (!ELEVENLABS_API_KEY) return res.json([])
      const r = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', { headers: { 'xi-api-key': ELEVENLABS_API_KEY } })
      if (!r.ok) throw fail(502, `ElevenLabs ha respost amb l’error ${r.status}.`)
      const data = (await r.json()) as { voices: { voice_id: string; name: string; labels?: Record<string, string> }[] }
      res.json(data.voices.map((v) => ({ id: v.voice_id, name: v.name, detail: Object.values(v.labels ?? {}).join(', ') })))
    }),
  )

  app.get(
    '/api/tutorials/voicestudio/voices',
    wrap(async (_req, res) => {
      res.json((await voicestudioVoices()) ?? [])
    }),
  )

  /** Una frase de prova amb la veu triada. */
  app.post(
    '/api/tutorials/voice-sample',
    wrap(async (req, res) => {
      const body = req.body as { voice?: VoiceOptions; text?: string }
      const voice = voiceFrom(body.voice)
      const text = String(body.text || 'Hola. Así sonará la narración de tus videotutoriales.').slice(0, 400)
      const [a] = await synthesize([{ sceneId: 'mostra', text }], voice, path.join(TUTORIALS_DIR, '_mostres'), { stage: () => {}, notice: () => {} })
      res.json({ url: `/files/tutorials/_mostres/${a.file}`, duration: a.duration })
    }),
  )

  /** Puja una mostra de la teua veu per a F5-TTS. */
  app.post(
    '/api/tutorials/voices',
    upload.single('file'),
    wrap(async (req, res) => {
      const f = req.file
      const name = String((req.body as { name?: string }).name ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .slice(0, 40)
      const text = String((req.body as { text?: string }).text ?? '').trim()
      if (!f || !name || !text) throw fail(400, 'Cal un nom, l’àudio i el text exacte que dius a la mostra.')
      const wav = path.join(VOICES_DIR, `${name}.wav`)
      // 24 kHz mono, sense silencis als extrems i com a molt 15 s: és el que espera F5-TTS.
      await runOk('ffmpeg', [
        '-y', '-v', 'error', '-i', f.path,
        '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-20',
        '-t', '15', '-ar', '24000', '-ac', '1', wav,
      ])
      await rm(f.path, { force: true })
      await writeFile(path.join(VOICES_DIR, `${name}.txt`), text, 'utf8')
      res.json({ name })
    }),
  )

  app.post(
    '/api/tutorials/session',
    wrap(async (req, res) => {
      const url = validUrl((req.body as { url?: string }).url)
      // No s'espera: l'usuari tanca la finestra quan ha acabat.
      loginSession(url).catch((err: Error) => console.error('[sessió]', err.message))
      res.json({ ok: true })
    }),
  )

  app.delete(
    '/api/tutorials/session',
    wrap(async (_req, res) => {
      await rm(SESSION_FILE, { force: true })
      res.json({ ok: true })
    }),
  )

  // --- Projectes ----------------------------------------------------------------
  app.get('/api/tutorials', wrap(async (_req, res) => res.json(await listTutorials())))

  app.post(
    '/api/tutorials',
    wrap(async (req, res) => {
      const body = req.body as { name?: string; url?: string; brief?: string; useSession?: boolean; maxMinutes?: number }
      const url = validUrl(body.url)
      const now = new Date().toISOString()
      const p: TutorialProject = {
        id: newId(),
        name: String(body.name || new URL(url).host).slice(0, 120),
        url,
        brief: String(body.brief ?? '').slice(0, 2000),
        status: 'nou',
        createdAt: now,
        updatedAt: now,
        useSession: !!body.useSession,
      }
      await saveTutorial(p)
      const maxMinutes = Math.min(10, Math.max(0.5, Number(body.maxMinutes ?? 3)))
      startTutorialJob(res, 'tut-script', p.id, (ctx) => analyzeAndScript(p.id, { maxMinutes }, ctx))
    }),
  )

  app.get(
    '/api/tutorials/:id',
    wrap(async (req, res) => {
      const p = await project(req)
      res.json({ project: p, job: runningJob(p.id) ?? latestJob(p.id) ?? null })
    }),
  )

  app.patch(
    '/api/tutorials/:id',
    wrap(async (req, res) => {
      const p = await project(req)
      const body = req.body as Partial<Pick<TutorialProject, 'name' | 'brief' | 'storyboard' | 'useSession' | 'url'>> & { settings?: GenerateSettings }
      const saved = await updateTutorial(p.id, (t) => {
        if (body.name != null) t.name = String(body.name).slice(0, 120)
        if (body.brief != null) t.brief = String(body.brief).slice(0, 2000)
        if (body.useSession != null) t.useSession = !!body.useSession
        if (body.url != null) t.url = validUrl(body.url)
        if (body.storyboard) {
          t.storyboard = body.storyboard
          t.validation = undefined
        }
        if (body.settings) t.settings = settingsFrom(body.settings)
      })
      res.json(saved)
    }),
  )

  app.delete(
    '/api/tutorials/:id',
    wrap(async (req, res) => {
      const p = await project(req)
      if (runningJob(p.id)) throw fail(409, 'Espera que acabe la tasca en marxa.')
      const trash = path.join(TMP_DIR, `esborrat-${p.id}`)
      await rename(tutorialDir(p.id), trash)
      await rm(trash, { recursive: true, force: true })
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/tutorials/:id/script',
    wrap(async (req, res) => {
      const p = await project(req)
      const body = req.body as { brief?: string; maxMinutes?: number }
      if (body.brief != null) await updateTutorial(p.id, (t) => (t.brief = String(body.brief).slice(0, 2000)))
      const maxMinutes = Math.min(10, Math.max(0.5, Number(body.maxMinutes ?? 3)))
      startTutorialJob(res, 'tut-script', p.id, (ctx) => analyzeAndScript(p.id, { maxMinutes }, ctx))
    }),
  )

  app.post(
    '/api/tutorials/:id/validate',
    wrap(async (req, res) => {
      const p = await project(req)
      if (!p.storyboard) throw fail(400, 'Encara no hi ha guió.')
      startTutorialJob(res, 'tut-script', p.id, async (ctx) => {
        ctx.stage('Provant el guió a la pàgina real')
        const errors = await dryRun(p.storyboard!, p.useSession)
        await updateTutorial(p.id, (t) => (t.validation = errors.map((e) => ({ sceneId: e.sceneId, error: e.error }))))
      })
    }),
  )

  app.post(
    '/api/tutorials/:id/voice',
    wrap(async (req, res) => {
      const p = await project(req)
      const settings = settingsFrom(req.body as Partial<GenerateSettings>)
      startTutorialJob(res, 'tut-voice', p.id, async (ctx) => {
        await makeVoice(p.id, settings, ctx)
      })
    }),
  )

  app.post(
    '/api/tutorials/:id/generate',
    wrap(async (req, res) => {
      const p = await project(req)
      if (!p.storyboard) throw fail(400, 'Encara no hi ha guió.')
      const settings = settingsFrom(req.body as Partial<GenerateSettings>)
      startTutorialJob(res, 'tut-generate', p.id, (ctx) => generate(p.id, settings, ctx))
    }),
  )

  // --- Miniatura -------------------------------------------------------------------

  /** Desa els textos de la miniatura. Amb cover: null, torna a la proposta del guió. */
  app.put(
    '/api/tutorials/:id/cover',
    wrap(async (req, res) => {
      const p = await project(req)
      const cover = coverFrom((req.body as { cover?: Partial<CoverText> | null }).cover)
      res.json(await updateTutorial(p.id, (t) => (t.cover = cover)))
    }),
  )

  /** Puja la imatge de la miniatura i li lleva el fons (si no és ja transparent). */
  app.post(
    '/api/tutorials/:id/cover-image',
    upload.single('file'),
    wrap(async (req, res) => {
      const p = await project(req)
      const f = req.file
      if (!f) throw fail(400, 'Falta la imatge.')
      if (!/^image\//.test(f.mimetype)) {
        await rm(f.path, { force: true })
        throw fail(400, 'El fitxer no és una imatge (PNG, JPG o WebP).')
      }
      const dir = path.join(tutorialDir(p.id), 'cover')
      await mkdir(dir, { recursive: true })
      const file = `cover/imatge-${Date.now()}.png`
      try {
        await runOk(TTS_PYTHON, [path.join(PY_DIR, 'cutout.py'), f.path, path.join(tutorialDir(p.id), file)], { timeoutMs: 10 * 60_000 })
      } catch (err) {
        throw fail(500, `No s’ha pogut llevar el fons de la imatge. Comprova que rembg està instal·lat a .venv. ${(err as Error).message.split('\n').slice(-1)[0]}`)
      } finally {
        await rm(f.path, { force: true })
      }
      const old = p.coverImage?.file
      const saved = await updateTutorial(p.id, (t) => (t.coverImage = { file, updatedAt: new Date().toISOString() }))
      if (old) await rm(path.join(tutorialDir(p.id), old), { force: true })
      res.json(saved)
    }),
  )

  app.delete(
    '/api/tutorials/:id/cover-image',
    wrap(async (req, res) => {
      const p = await project(req)
      if (p.coverImage) await rm(path.join(tutorialDir(p.id), p.coverImage.file), { force: true })
      res.json(await updateTutorial(p.id, (t) => (t.coverImage = undefined)))
    }),
  )

  /** Genera la miniatura com a imatge, sense fer el vídeo (uns segons). */
  app.post(
    '/api/tutorials/:id/cover-still',
    wrap(async (req, res) => {
      const p = await project(req)
      if (runningJob(p.id)) throw fail(409, 'Espera que acabe la tasca en marxa.')
      res.json(await makeCoverStill(p.id))
    }),
  )

  app.get(
    '/api/tutorials/:id/job',
    wrap(async (req, res) => {
      const p = await project(req)
      res.json(runningJob(p.id) ?? latestJob(p.id) ?? null)
    }),
  )
}
