import { Globe, LogIn, Plus, Trash2, Video } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Notice, Section } from '../../../components/ui'
import { useServer } from '../../reels/auto/api'
import { JobProgress, ServerStatus } from '../../reels/auto/components'
import { tutorialFileUrl, tutorialsApi, useTutorialJob, type TutorialMeta } from '../api'
import type { TutorialProject, TutorialStatus } from '../types'

export const STATUS: Record<TutorialStatus, { label: string; tone: string }> = {
  nou: { label: 'Nou', tone: 'bg-sunken text-muted' },
  analitzant: { label: 'Analitzant', tone: 'bg-take-amber text-black' },
  guio: { label: 'Guió per revisar', tone: 'bg-accent text-accent-ink' },
  generant: { label: 'Generant', tone: 'bg-take-amber text-black' },
  final: { label: 'Vídeo fet', tone: 'bg-ok text-white' },
  error: { label: 'Error', tone: 'bg-take-red text-white' },
}

export function ProjectsPage() {
  const server = useServer()
  return (
    <div className="space-y-6">
      <ServerStatus state={server.state} health={server.health} permission={server.permission} onRetry={() => void server.check()} />
      {server.state === 'online' && <Content />}
    </div>
  )
}

function Content() {
  const [list, setList] = useState<TutorialProject[]>([])
  const [meta, setMeta] = useState<TutorialMeta | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const [l, m] = await Promise.all([tutorialsApi.list(), tutorialsApi.meta()])
      setList(l)
      setMeta(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => void load(), [load])

  return (
    <>
      {error && <Notice>{error}</Notice>}
      <NewTutorial meta={meta} onSession={load} />
      <Section title="Els teus tutorials" intro="Cada tutorial guarda l’anàlisi, el guió, la veu, la captura i el vídeo final.">
        {list.length === 0 ? (
          <p className="text-muted">Encara no n’hi ha cap.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((p) => (
              <li key={p.id} className="flex overflow-hidden rounded-lg border border-line bg-sunken">
                <Link to={`/tutorials/${p.id}`} className="flex min-w-0 flex-1 gap-3 p-3 hover:bg-panel">
                  <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded bg-panel">
                    {p.final ? (
                      <img src={tutorialFileUrl(p.id, p.final.thumb, p.final.updatedAt)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Video className="text-muted" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.storyboard?.title ?? p.name}</p>
                    <p className="truncate text-sm text-muted">{p.url}</p>
                    <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold ${STATUS[p.status].tone}`}>{STATUS[p.status].label}</span>
                  </div>
                </Link>
                <button
                  type="button"
                  className="px-3 text-muted hover:text-take-red"
                  aria-label={`Esborrar ${p.name}`}
                  onClick={async () => {
                    if (!confirm(`Vols esborrar «${p.name}» i tots els seus fitxers?`)) return
                    try {
                      await tutorialsApi.remove(p.id)
                      await load()
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e))
                    }
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

function NewTutorial({ meta, onSession }: { meta: TutorialMeta | null; onSession: () => void }) {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [minutes, setMinutes] = useState(3)
  const [useSession, setUseSession] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const [job, setJob] = useTutorialJob((j) => {
    if (j.status === 'done' && created) navigate(`/tutorials/${created}`)
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const j = await tutorialsApi.create({ url, name, brief, useSession, maxMinutes: minutes })
      setCreated(j.projectId ?? null)
      setJob(j)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Section
      title="Nou tutorial"
      intro="Claude Code obri la pàgina, la mira i escriu un guió que explica com funciona. Després el prova a la pàgina real abans de donar-te’l."
    >
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <Field label="Adreça de la pàgina">
          <div className="flex items-center gap-2 rounded-md border border-line bg-sunken px-3">
            <Globe size={16} className="text-muted" />
            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-transparent py-2 outline-none"
            />
          </div>
        </Field>
        <Field label="Nom (opcional)">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-line bg-sunken px-3 py-2" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Què vols explicar?" hint="Per a qui és, què ha d’aprendre, quines parts ensenyar o evitar. Si ho deixes buit, explica l’ús principal.">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="Per exemple: alumnat de 1r d’ESO; com entregar una tasca i veure la nota."
              className="w-full rounded-md border border-line bg-sunken px-3 py-2"
            />
          </Field>
        </div>
        <Field label={`Durada màxima: ${minutes} min`}>
          <input type="range" min={1} max={8} step={0.5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full" />
        </Field>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useSession} onChange={(e) => setUseSession(e.target.checked)} />
            La pàgina necessita iniciar sessió
          </label>
          {useSession && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {meta?.session ? 'Hi ha una sessió desada.' : 'Encara no hi ha cap sessió desada.'}
              <Button
                disabled={!url}
                onClick={async () => {
                  try {
                    await tutorialsApi.login(url)
                    alert('S’ha obert un navegador. Inicia sessió i, quan acabes, tanca la finestra: la sessió es desarà.')
                    setTimeout(onSession, 5000)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err))
                  }
                }}
              >
                <LogIn size={16} /> Iniciar sessió
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit" variant="primary" disabled={job?.status === 'running'}>
            <Plus size={16} /> Analitzar i escriure el guió
          </Button>
          <span className="text-sm text-muted">El guió es prova de veritat: no l’uses en pàgines on una acció no es puga desfer.</span>
        </div>
      </form>
      {error && (
        <div className="mt-3">
          <Notice>{error}</Notice>
        </div>
      )}
      {job && (
        <div className="mt-4">
          <JobProgress job={job} />
        </div>
      )}
    </Section>
  )
}
