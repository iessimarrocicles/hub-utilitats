import { Clapperboard, Film, Sparkles, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Notice, Section } from '../../../components/ui'
import { useBrand } from '../store'
import { api, referenceFileUrl, useJob, useServer } from './api'
import { JobProgress, ServerStatus, formatSeconds } from './components'
import { applyLook } from './look'
import type { Look, ProjectStatus, Reference, ServerProject } from './types'

const STATUS: Record<ProjectStatus, { label: string; tone: string }> = {
  nou: { label: 'Pujat', tone: 'bg-sunken text-muted' },
  processant: { label: 'Processant', tone: 'bg-take-amber text-black' },
  proposta: { label: 'Per revisar', tone: 'bg-accent text-accent-ink' },
  final: { label: 'Vídeo final', tone: 'bg-ok text-white' },
  error: { label: 'Error', tone: 'bg-take-red text-white' },
}

export function AutoPage() {
  const server = useServer()
  const online = server.state === 'online'

  return (
    <div className="space-y-6">
      <p className="max-w-[68ch] text-muted">
        Dona-li uns reels que t’agraden i el teu vídeo gravat. Claude Code el talla, posa subtítols i el ganxo amb el teu estil. Tu ho
        revises, retoques el que vulgues i generes el vídeo final.
      </p>
      <ServerStatus state={server.state} health={server.health} permission={server.permission} onRetry={() => void server.check()} />
      {online && (
        <>
          <ReferencesSection />
          <ProjectsSection />
        </>
      )}
    </div>
  )
}

function ReferencesSection() {
  const { brand, update } = useBrand()
  const [refs, setRefs] = useState<Reference[]>([])
  const [look, setLook] = useState<Look | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [keepColors, setKeepColors] = useState(true)
  const [applied, setApplied] = useState(false)

  const load = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([api.references(), api.look()])
      setRefs(r)
      setLook(l)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => void load(), [load])

  const [job, setJob] = useJob(() => void load())

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setUploading(0)
    try {
      await api.uploadReferences([...files], setUploading)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(null)
    }
  }

  async function analyze() {
    setError('')
    setApplied(false)
    try {
      setJob(await api.analyzeLook())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const running = job?.status === 'running'

  return (
    <Section
      title="Les teues referències"
      intro="Dos o tres reels que t’agraden. Claude n’estudia les lletres, els colors, els subtítols i el ritme, i et proposa un estil."
      aside={
        <Button variant="primary" onClick={() => void analyze()} disabled={refs.length === 0 || running}>
          <Sparkles size={16} /> {look ? 'Tornar a estudiar l’estil' : 'Estudiar l’estil'}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {refs.map((r) => (
          <figure key={r.id} className="group relative overflow-hidden rounded-lg border border-line bg-sunken">
            <img src={referenceFileUrl(r.thumb)} alt="" className="aspect-[9/16] w-full object-cover" />
            <figcaption className="p-2 text-xs">
              <span className="block truncate font-semibold" title={r.name}>
                {r.name}
              </span>
              <span className="text-muted">{formatSeconds(r.duration)}</span>
            </figcaption>
            {confirming === r.id ? (
              <div className="absolute inset-x-1 top-1 flex flex-col gap-1">
                <Button
                  variant="danger"
                  className="justify-center !px-2 !py-1 text-xs"
                  onClick={async () => {
                    await api.deleteReference(r.id).catch((e: Error) => setError(e.message))
                    setConfirming(null)
                    void load()
                  }}
                >
                  Esborrar
                </Button>
                <Button className="justify-center !px-2 !py-1 text-xs" onClick={() => setConfirming(null)}>
                  Cancel·lar
                </Button>
              </div>
            ) : (
              <button
                type="button"
                aria-label={`Esborrar ${r.name}`}
                onClick={() => setConfirming(r.id)}
                className="absolute right-1 top-1 rounded bg-black/55 p-1.5 text-white opacity-80 hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            )}
          </figure>
        ))}
        <label className="flex aspect-[9/16] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line p-3 text-center text-sm text-muted hover:border-accent hover:text-ink">
          <Upload size={20} />
          {uploading != null ? `Pujant… ${Math.round(uploading * 100)}%` : 'Afegir reels'}
          <input
            type="file"
            accept="video/*,.mov,.mp4,.m4v"
            multiple
            className="hidden"
            disabled={uploading != null}
            onChange={(e) => {
              void onFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {error && (
        <div className="mt-4">
          <Notice>{error}</Notice>
        </div>
      )}
      {job && <div className="mt-4"><JobProgress job={job} /></div>}

      {look && !running && (
        <div className="mt-5 rounded-lg border border-line p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-[65ch]">
              <p className="headline text-xl">L’estil proposat</p>
              <p className="mt-1 text-sm text-muted">{look.summary}</p>
            </div>
            <div className="flex gap-1" aria-label="Colors proposats">
              {Object.entries(look.colors).map(([k, c]) => (
                <span key={k} title={`${k}: ${c}`} className="size-8 rounded border border-line" style={{ background: c }} />
              ))}
            </div>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Lletres</dt>
              <dd>
                {look.titleFont} per als títols, {look.bodyFont} per als subtítols
              </dd>
            </div>
            <div>
              <dt className="text-muted">Ritme</dt>
              <dd>{look.transitions}</dd>
            </div>
          </dl>
          {look.notes.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold">Observacions de les referències</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                {look.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={() => {
                update((d) => Object.assign(d, applyLook(d, look, keepColors)))
                setApplied(true)
              }}
            >
              Aplicar a la meua marca
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={keepColors} onChange={(e) => setKeepColors(e.target.checked)} />
              Mantindre els meus colors
            </label>
            {applied && (
              <span className="text-sm text-ok" role="status">
                Aplicat. <Link to="/reels/marca" className="underline">Revisa-ho a Marca</Link>.
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            Ara la teua marca usa {brand.fonts.title.family} i {brand.fonts.body.family}.
          </p>
        </div>
      )}
    </Section>
  )
}

const LANGUAGES = [
  { id: 'auto', label: 'Detectar-lo' },
  { id: 'ca', label: 'Valencià / català' },
  { id: 'es', label: 'Castellà' },
  { id: 'en', label: 'Anglés' },
]

function ProjectsSection() {
  const { brand } = useBrand()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ServerProject[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('auto')
  const [instructions, setInstructions] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.projects().then(setProjects, (e: Error) => setError(e.message))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setError('')
    setProgress(0)
    try {
      const p = await api.createProject({ file, name, language, instructions }, setProgress)
      await api.autoEdit(p.id, brand)
      navigate(`/reels/auto/${p.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setProgress(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Section title="Els teus reels">
        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-8 text-center text-muted">
            <Film className="mx-auto" size={28} />
            <p className="mt-2">Encara no has pujat cap vídeo. Puja el primer amb el formulari.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/reels/auto/${p.id}`} className="flex items-center gap-3 py-3 hover:text-accent">
                  <Clapperboard size={18} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="text-sm text-muted">
                      {p.originalName}
                      {p.media && ` · ${formatSeconds(p.media.duration)}`}
                      {p.final && ` → ${formatSeconds(p.final.duration)}`}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${STATUS[p.status].tone}`}>
                    {STATUS[p.status].label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Vídeo nou">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line p-5 text-center text-sm hover:border-accent">
            <Upload size={20} className="text-muted" />
            {file ? <span className="font-semibold">{file.name}</span> : <span className="text-muted">Tria el vídeo en brut, gravat en vertical</span>}
            <input
              type="file"
              accept="video/*,.mov,.mp4,.m4v"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !name) setName(f.name.replace(/\.[^.]+$/, ''))
              }}
            />
          </label>
          <Field label="Nom">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Com edite amb Claude" />
          </Field>
          <Field label="Idioma del vídeo">
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Indicacions per a Claude" hint="Opcional. Per exemple: «Que el ganxo parle de l’estalvi de temps».">
            <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </Field>
          {error && <Notice>{error}</Notice>}
          <Button type="submit" variant="primary" className="w-full justify-center" disabled={!file || progress != null}>
            {progress == null ? 'Pujar i editar automàticament' : `Pujant… ${Math.round(progress * 100)}%`}
          </Button>
          <p className="text-xs text-muted">
            Usa la fitxa de marca actual: {brand.fonts.title.family} i {brand.fonts.body.family}.
          </p>
        </form>
      </Section>
    </div>
  )
}
