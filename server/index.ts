/**
 * Servidor local de l'editor automàtic de reels.
 * Arrancar: npm run server   (o npm start per a servidor + interfície)
 */
import express, { type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { rename } from 'node:fs/promises'
import path from 'node:path'
import type { BrandProfile } from '../src/utilities/reels/model.ts'
import type { EditPlan, ServerProject } from '../src/utilities/reels/auto/types.ts'
import { claudeVersion } from './claude.ts'
import { ALLOWED_ORIGINS, PORT, PROJECTS_DIR, REFERENCES_DIR, TMP_DIR, WORKSPACE } from './config.ts'
import { getJob, latestJob, runningJob, startJob } from './jobs.ts'
import { run } from './lib/run.ts'
import { extractFrame, probe, removeIfExists } from './media.ts'
import { analyzeLook, autoEdit, renderProject, sanitizePlan } from './pipeline.ts'
import {
  getLook,
  getProject,
  isSafeId,
  listProjects,
  listReferences,
  newId,
  projectDir,
  saveProject,
  saveReferences,
  updateProject,
} from './store.ts'

const app = express()
const upload = multer({ dest: TMP_DIR, limits: { fileSize: 4 * 1024 ** 3 } })
const VIDEO_EXT = /\.(mov|mp4|m4v|webm|mkv|avi)$/i

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.some((re) => re.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    // Permet que la versió publicada a GitHub Pages parle amb aquest servidor local.
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
  }
  if (req.method === 'OPTIONS') return void res.sendStatus(204)
  next()
})
app.use(express.json({ limit: '10mb' }))
app.use('/files/projects', express.static(PROJECTS_DIR, { dotfiles: 'deny' }))
app.use('/files/references', express.static(REFERENCES_DIR, { dotfiles: 'deny' }))

/** Multer llig els noms de fitxer com a Latin-1: «vídeo.mov» arriba com «vÃ­deo.mov». */
function fileName(f: Express.Multer.File): string {
  const decoded = Buffer.from(f.originalname, 'latin1').toString('utf8')
  return decoded.includes('�') ? f.originalname : decoded
}

type Handler =(req: Request, res: Response) => Promise<unknown>
const wrap = (h: Handler) => (req: Request, res: Response, next: NextFunction) => h(req, res).catch(next)

function idParam(req: Request): string {
  const id = String(req.params.id ?? '')
  if (!isSafeId(id)) throw Object.assign(new Error('Identificador no vàlid.'), { status: 400 })
  return id
}

function brandFrom(req: Request): BrandProfile {
  const brand = (req.body as { brand?: BrandProfile })?.brand
  if (!brand?.colors || !brand.fonts || !brand.subtitles) {
    throw Object.assign(new Error('Falta la fitxa de marca.'), { status: 400 })
  }
  return brand
}

// --- Estat ---------------------------------------------------------------

let toolsCache: { at: number; value: unknown } | null = null
app.get(
  '/api/health',
  wrap(async (_req, res) => {
    if (!toolsCache || Date.now() - toolsCache.at > 60_000) {
      const check = async (cmd: string, args: string[]) => {
        try {
          return (await run(cmd, args, { timeoutMs: 30_000 })).code === 0
        } catch {
          return false
        }
      }
      const [ffmpeg, whisper, claude] = await Promise.all([
        check('ffmpeg', ['-version']),
        check('python', ['-c', 'import whisper']),
        claudeVersion(),
      ])
      toolsCache = { at: Date.now(), value: { ffmpeg, whisper, claude: claude ?? false } }
    }
    res.json({ ok: true, workspace: WORKSPACE, tools: toolsCache.value })
  }),
)

app.get(
  '/api/jobs/:id',
  wrap(async (req, res) => {
    const job = getJob(String(req.params.id))
    if (!job) return res.status(404).json({ error: 'Aquest treball ja no existeix. Potser el servidor s’ha reiniciat.' })
    res.json(job)
  }),
)

// --- Referències i look --------------------------------------------------

app.get('/api/references', wrap(async (_req, res) => res.json(await listReferences())))

app.post(
  '/api/references',
  upload.array('files', 10),
  wrap(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? []
    const refs = await listReferences()
    const added = []
    for (const f of files) {
      if (!VIDEO_EXT.test(fileName(f))) {
        await removeIfExists(f.path)
        continue
      }
      const id = newId()
      const file = `${id}${path.extname(fileName(f)).toLowerCase()}`
      await rename(f.path, path.join(REFERENCES_DIR, file))
      const info = await probe(path.join(REFERENCES_DIR, file))
      const thumb = `${id}.jpg`
      await extractFrame(path.join(REFERENCES_DIR, file), Math.min(1.5, info.duration / 2), path.join(REFERENCES_DIR, thumb), 360)
      const ref = { id, name: fileName(f), file, thumb, duration: info.duration, addedAt: new Date().toISOString() }
      refs.push(ref)
      added.push(ref)
    }
    await saveReferences(refs)
    if (added.length === 0) return res.status(400).json({ error: 'Cap fitxer era un vídeo (mov, mp4, m4v, webm, mkv o avi).' })
    res.json(added)
  }),
)

app.delete(
  '/api/references/:id',
  wrap(async (req, res) => {
    const id = idParam(req)
    const refs = await listReferences()
    const ref = refs.find((r) => r.id === id)
    if (!ref) return res.status(404).json({ error: 'No existeix aquesta referència.' })
    await removeIfExists(path.join(REFERENCES_DIR, ref.file))
    await removeIfExists(path.join(REFERENCES_DIR, ref.thumb))
    await saveReferences(refs.filter((r) => r.id !== id))
    res.json({ ok: true })
  }),
)

app.get('/api/look', wrap(async (_req, res) => res.json(await getLook())))

app.post(
  '/api/look/analyze',
  wrap(async (_req, res) => {
    const running = runningJob(undefined, 'look')
    if (running) return res.json(running)
    res.json(startJob('look', undefined, analyzeLook))
  }),
)

// --- Projectes -----------------------------------------------------------

app.get('/api/projects', wrap(async (_req, res) => res.json(await listProjects())))

app.post(
  '/api/projects',
  upload.single('video'),
  wrap(async (req, res) => {
    const f = req.file
    if (!f) return res.status(400).json({ error: 'Falta el vídeo.' })
    if (!VIDEO_EXT.test(fileName(f))) {
      await removeIfExists(f.path)
      return res.status(400).json({ error: 'El fitxer no és un vídeo (mov, mp4, m4v, webm, mkv o avi).' })
    }
    const body = req.body as { name?: string; language?: string; instructions?: string }
    const id = newId()
    const rawFile = `raw${path.extname(fileName(f)).toLowerCase()}`
    const now = new Date().toISOString()
    const project: ServerProject = {
      id,
      name: (body.name ?? '').trim() || fileName(f),
      originalName: fileName(f),
      rawFile,
      language: (body.language ?? 'auto').trim(),
      instructions: (body.instructions ?? '').trim(),
      status: 'nou',
      createdAt: now,
      updatedAt: now,
    }
    await saveProject(project)
    await rename(f.path, path.join(projectDir(id), rawFile))
    res.json(project)
  }),
)

app.get(
  '/api/projects/:id',
  wrap(async (req, res) => {
    const id = idParam(req)
    const p = await getProject(id)
    if (!p) return res.status(404).json({ error: 'No existeix aquest projecte.' })
    res.json({ project: p, job: runningJob(id) ?? latestJob(id) ?? null })
  }),
)

app.patch(
  '/api/projects/:id',
  wrap(async (req, res) => {
    const id = idParam(req)
    const body = req.body as { name?: string; instructions?: string; language?: string }
    res.json(
      await updateProject(id, (p) => {
        if (typeof body.name === 'string' && body.name.trim()) p.name = body.name.trim()
        if (typeof body.instructions === 'string') p.instructions = body.instructions
        if (typeof body.language === 'string') p.language = body.language
      }),
    )
  }),
)

app.delete(
  '/api/projects/:id',
  wrap(async (req, res) => {
    const id = idParam(req)
    if (runningJob(id)) return res.status(409).json({ error: 'Aquest reel està processant-se. Espera que acabe.' })
    await removeIfExists(projectDir(id))
    res.json({ ok: true })
  }),
)

app.put(
  '/api/projects/:id/plan',
  wrap(async (req, res) => {
    const id = idParam(req)
    const plan = (req.body as { plan?: EditPlan }).plan
    if (!plan?.segments || !plan.subtitles) return res.status(400).json({ error: 'La proposta no és vàlida.' })
    res.json(
      await updateProject(id, (p) => {
        p.plan = sanitizePlan(plan, p.media?.duration ?? Number.MAX_SAFE_INTEGER)
      }),
    )
  }),
)

function startProjectJob(req: Request, res: Response, kind: 'auto' | 'preview' | 'final') {
  const id = idParam(req)
  const brand = brandFrom(req)
  const running = runningJob(id)
  if (running) return res.json(running)
  const work =
    kind === 'auto'
      ? (ctx: Parameters<typeof autoEdit>[2]) => autoEdit(id, brand, ctx)
      : (ctx: Parameters<typeof autoEdit>[2]) => renderProject(id, brand, kind, ctx)
  const job = startJob(kind, id, work, async (err) => {
    await updateProject(id, (p) => {
      p.status = p.plan ? 'proposta' : 'error'
      p.lastError = err.message
    })
  })
  res.json(job)
}

app.post('/api/projects/:id/auto', wrap(async (req, res) => startProjectJob(req, res, 'auto')))
app.post('/api/projects/:id/preview', wrap(async (req, res) => startProjectJob(req, res, 'preview')))
app.post('/api/projects/:id/final', wrap(async (req, res) => startProjectJob(req, res, 'final')))

app.get(
  '/api/projects/:id/download/:which',
  wrap(async (req, res) => {
    const id = idParam(req)
    const p = await getProject(id)
    const file = req.params.which === 'clean' ? p?.final?.clean : p?.final?.file
    if (!p || !file) return res.status(404).json({ error: 'Encara no hi ha vídeo final.' })
    res.download(path.join(projectDir(id), file), file)
  }),
)

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(err.status ?? 500).json({ error: err.message || 'Error inesperat al servidor.' })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor de reels a http://localhost:${PORT}`)
  console.log(`Fitxers a ${WORKSPACE}`)
})
