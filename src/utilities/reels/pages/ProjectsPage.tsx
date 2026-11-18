import { CopyPlus, Film, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Section } from '../../../components/ui'
import { TakeBar } from '../components/TakeBar'
import { STEPS } from '../model'
import { useProjects } from '../store'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export function ProjectsPage() {
  const { projects, create, duplicate, remove } = useProjects()
  const [name, setName] = useState('')
  const [rawFile, setRawFile] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const navigate = useNavigate()

  const sorted = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!rawFile.trim()) return
    const p = create({ name: name || rawFile, rawFile })
    navigate(`/reels/projectes/${p.id}`)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-10 text-center">
            <Film className="mx-auto text-muted" size={32} />
            <p className="headline mt-3 text-2xl">Encara no hi ha cap reel</p>
            <p className="mx-auto mt-1 max-w-[45ch] text-muted">
              Copia el vídeo en brut a la carpeta Brutos i crea el reel ací amb el nom del fitxer.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((p) => {
              const next = STEPS.find((s) => !p.steps[s.id])
              return (
                <li key={p.id} className="rounded-xl border border-line bg-panel p-4 md:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link to={`/reels/projectes/${p.id}`} className="headline text-2xl hover:text-accent">
                      {p.name}
                    </Link>
                    <span className="text-sm text-muted">
                      {p.rawFile} · {formatDate(p.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <TakeBar project={p} size="sm" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-muted">{next ? `Següent pas: ${next.label}` : 'Publicat'}</span>
                    <div className="flex gap-2">
                      {confirming === p.id ? (
                        <>
                          <Button variant="danger" onClick={() => remove(p.id)}>
                            Esborrar definitivament
                          </Button>
                          <Button onClick={() => setConfirming(null)}>Cancel·lar</Button>
                        </>
                      ) : (
                        <>
                          <Button onClick={() => duplicate(p.id)} aria-label={`Duplicar ${p.name}`}>
                            <CopyPlus size={16} /> Duplicar
                          </Button>
                          <Button onClick={() => setConfirming(p.id)} aria-label={`Esborrar ${p.name}`}>
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Section title="Reel nou">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Fitxer en brut" hint="Tal com està a la carpeta Brutos.">
            <input value={rawFile} onChange={(e) => setRawFile(e.target.value)} placeholder="IMG_0001.MOV" required />
          </Field>
          <Field label="Nom del reel" hint="Opcional. Per a reconéixer-lo a la llista.">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Com edite amb Claude" />
          </Field>
          <Button type="submit" variant="primary" className="w-full justify-center" disabled={!rawFile.trim()}>
            Crear el reel
          </Button>
        </form>
      </Section>
    </div>
  )
}
