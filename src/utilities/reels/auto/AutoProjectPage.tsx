import { ArrowLeft, Download, Play, RefreshCw, Sparkles, Trash2, Undo2, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { keptRanges, outputDuration, toOutputTime } from '../../../../server/lib/edl.ts'
import { Button, Field, Notice, Section } from '../../../components/ui'
import { useBrand } from '../store'
import { api, downloadUrl, projectFileUrl, useJob } from './api'
import { JobProgress, formatSeconds } from './components'
import type { EditPlan, Job, Segment, SegmentKind, ServerProject } from './types'

const KIND: Record<SegmentKind, { label: string; bar: string; chip: string }> = {
  contingut: { label: 'Es queda', bar: 'bg-accent', chip: 'bg-accent-soft text-ink' },
  equivocacio: { label: 'Equivocació', bar: 'bg-take-red', chip: 'bg-take-red text-white' },
  repeticio: { label: 'Repetició', bar: 'bg-take-amber', chip: 'bg-take-amber text-black' },
  muletilla: { label: 'Crossa', bar: 'bg-take-amber', chip: 'bg-take-amber text-black' },
  silenci: { label: 'Silenci', bar: 'bg-take-grey', chip: 'bg-take-grey text-white' },
  altres: { label: 'Altres', bar: 'bg-take-grey', chip: 'bg-take-grey text-white' },
}

type Tab = 'talls' | 'subtitols' | 'ganxo' | 'resum'

export function AutoProjectPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { brand } = useBrand()
  const [project, setProject] = useState<ServerProject | null>(null)
  const [loadError, setLoadError] = useState('')
  const [draft, setDraft] = useState<EditPlan | null>(null)
  const [actionError, setActionError] = useState('')
  const [tab, setTab] = useState<Tab>('talls')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [instructions, setInstructions] = useState('')
  const video = useRef<HTMLVideoElement>(null)

  const load = useCallback(async () => {
    try {
      const { project: p, job: j } = await api.project(id)
      setProject(p)
      setDraft(p.plan ? structuredClone(p.plan) : null)
      setInstructions(p.instructions)
      return j
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [id])

  const [job, setJob] = useJob(() => void load())

  useEffect(() => {
    void load().then((j) => {
      if (j?.status === 'running') setJob(j)
    })
  }, [load, setJob])

  const dirty = useMemo(() => !!project?.plan && !!draft && JSON.stringify(project.plan) !== JSON.stringify(draft), [project, draft])
  const running = job?.status === 'running'

  const savedRanges = useMemo(() => (project?.plan ? keptRanges(project.plan.segments) : []), [project])
  const draftDuration = useMemo(() => (draft ? outputDuration(keptRanges(draft.segments)) : 0), [draft])

  async function act(start: () => Promise<Job>) {
    setActionError('')
    try {
      setJob(await start())
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  async function saveAndPreview() {
    if (!draft) return
    await act(async () => {
      await api.savePlan(id, draft)
      return api.preview(id, brand)
    })
  }

  async function makeFinal() {
    await act(async () => {
      if (dirty && draft) await api.savePlan(id, draft)
      return api.final(id, brand)
    })
  }

  async function redoAuto() {
    await act(async () => {
      await api.patchProject(id, { instructions })
      return api.autoEdit(id, brand)
    })
  }

  function seekTo(sourceTime: number) {
    const t = toOutputTime(sourceTime, savedRanges)
    if (t == null || !video.current) return
    video.current.currentTime = t
    void video.current.play().catch(() => undefined)
  }

  function editSegment(segId: string, change: (s: Segment) => void) {
    setDraft((d) => {
      if (!d) return d
      const next = structuredClone(d)
      const s = next.segments.find((x) => x.id === segId)
      if (s) change(s)
      return next
    })
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-dashed border-line p-10 text-center">
        <p className="headline text-2xl">No puc obrir aquest reel</p>
        <p className="mt-1 text-muted">{loadError}</p>
        <Link to="/reels/auto" className="mt-4 inline-block font-semibold text-accent">
          Tornar a l’editor automàtic
        </Link>
      </div>
    )
  }
  if (!project) return <p className="text-muted">Carregant…</p>

  const duration = project.media?.duration ?? 0

  return (
    <div className="space-y-6">
      <Link to="/reels/auto" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Editor automàtic
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="headline text-4xl">{project.name}</h2>
          <p className="text-muted">
            {project.originalName}
            {project.media && ` · ${formatSeconds(project.media.duration)} en brut`}
            {draft && ` · ${formatSeconds(draftDuration)} editat`}
          </p>
        </div>
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await api.deleteProject(id)
                  navigate('/reels/auto')
                } catch (e) {
                  setActionError(e instanceof Error ? e.message : String(e))
                  setConfirmDelete(false)
                }
              }}
            >
              Esborrar el reel i els seus vídeos
            </Button>
            <Button onClick={() => setConfirmDelete(false)}>Cancel·lar</Button>
          </div>
        ) : (
          <Button onClick={() => setConfirmDelete(true)} disabled={running}>
            <Trash2 size={16} /> Esborrar
          </Button>
        )}
      </div>

      {job && <JobProgress job={job} />}
      {!job && project.lastError && <Notice>L’últim intent ha fallat: {project.lastError}</Notice>}
      {actionError && <Notice>{actionError}</Notice>}

      {!project.plan && !running && (
        <Section title="Encara no hi ha proposta" intro="Llança l’edició automàtica per a tindre els talls, els subtítols i el ganxo.">
          <Button variant="primary" onClick={() => void redoAuto()}>
            <Wand2 size={16} /> Editar automàticament
          </Button>
        </Section>
      )}

      {project.plan && draft && (
        <>
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
              {project.preview ? (
                <video
                  ref={video}
                  key={project.preview.updatedAt}
                  src={projectFileUrl(project.id, project.preview.file, project.preview.updatedAt)}
                  controls
                  playsInline
                  className="mx-auto aspect-[9/16] w-full max-w-[300px] rounded-[18px] border-[5px] border-[#1d2330] bg-black"
                />
              ) : (
                <div className="grid aspect-[9/16] w-full place-items-center rounded-[18px] border-[5px] border-[#1d2330] bg-black text-sm text-white/70">
                  Sense previsualització
                </div>
              )}
              <p className="text-center text-xs text-muted">Previsualització a 540×960. El final ix a 1080×1920.</p>
              {dirty && (
                <Notice>Tens canvis sense aplicar. La previsualització encara mostra la versió anterior.</Notice>
              )}
              <div className="flex flex-col gap-2">
                <Button variant={dirty ? 'primary' : 'ghost'} onClick={() => void saveAndPreview()} disabled={running || !dirty}>
                  <RefreshCw size={16} /> Aplicar els canvis
                </Button>
                {dirty && (
                  <Button onClick={() => setDraft(structuredClone(project.plan!))} disabled={running}>
                    <Undo2 size={16} /> Descartar els canvis
                  </Button>
                )}
                <Button variant={dirty ? 'ghost' : 'primary'} onClick={() => void makeFinal()} disabled={running}>
                  <Sparkles size={16} /> Generar el vídeo final
                </Button>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <Timeline segments={draft.segments} duration={duration} onToggle={(sid) => editSegment(sid, (s) => void (s.keep = !s.keep))} />

              <div className="flex gap-1 border-b border-line" role="tablist">
                {(
                  [
                    ['talls', `Talls (${draft.segments.filter((s) => !s.keep).length} llevats)`],
                    ['subtitols', `Subtítols (${draft.subtitles.length})`],
                    ['ganxo', 'Ganxo'],
                    ['resum', `Resum${draft.warnings.length ? ` (${draft.warnings.length} avisos)` : ''}`],
                  ] as [Tab, string][]
                ).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-accent font-semibold' : 'border-transparent text-muted hover:text-ink'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'talls' && (
                <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
                  {draft.segments.map((s) => (
                    <li key={s.id} className={`grid gap-2 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-start ${s.keep ? '' : 'bg-sunken'}`}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={s.keep} onChange={(e) => editSegment(s.id, (x) => void (x.keep = e.target.checked))} />
                        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${s.keep ? KIND.contingut.chip : KIND[s.kind].chip}`}>
                          {s.keep ? 'Es queda' : KIND[s.kind].label}
                        </span>
                      </label>
                      <div className="min-w-0">
                        <p className={s.keep ? '' : 'text-muted line-through'}>{s.text}</p>
                        {s.note && <p className="text-sm text-muted">{s.note}</p>}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <TimeInput label="Inici" value={s.start} onChange={(v) => editSegment(s.id, (x) => void (x.start = v))} />
                        <span className="text-muted">–</span>
                        <TimeInput label="Final" value={s.end} onChange={(v) => editSegment(s.id, (x) => void (x.end = v))} />
                        <button
                          type="button"
                          aria-label="Reproduir aquest tram a la previsualització"
                          title="Reproduir a la previsualització"
                          disabled={toOutputTime(s.start + 0.01, savedRanges) == null}
                          onClick={() => seekTo(s.start + 0.01)}
                          className="rounded p-1.5 text-muted hover:text-accent disabled:opacity-30"
                        >
                          <Play size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {tab === 'subtitols' && (
                <ul className="space-y-2">
                  {draft.subtitles.map((sub, k) => {
                    const visible = toOutputTime(sub.start, keptRanges(draft.segments)) != null
                    return (
                      <li key={sub.id} className={`grid gap-2 rounded-lg border border-line bg-panel p-3 sm:grid-cols-[4rem_1fr_9rem_auto] sm:items-center ${visible ? '' : 'opacity-60'}`}>
                        <button
                          type="button"
                          onClick={() => seekTo(sub.start + 0.01)}
                          className="text-left font-mono text-xs text-muted hover:text-accent"
                          title="Reproduir a la previsualització"
                        >
                          {formatSeconds(sub.start)}
                        </button>
                        <input
                          aria-label={`Text del subtítol ${k + 1}`}
                          value={sub.text}
                          onChange={(e) =>
                            setDraft((d) => {
                              if (!d) return d
                              const next = structuredClone(d)
                              next.subtitles[k].text = e.target.value
                              return next
                            })
                          }
                        />
                        <input
                          aria-label={`Paraula destacada del subtítol ${k + 1}`}
                          placeholder="Paraula destacada"
                          value={sub.highlight}
                          onChange={(e) =>
                            setDraft((d) => {
                              if (!d) return d
                              const next = structuredClone(d)
                              next.subtitles[k].highlight = e.target.value
                              return next
                            })
                          }
                        />
                        <button
                          type="button"
                          aria-label="Esborrar el subtítol"
                          className="justify-self-end rounded p-1.5 text-muted hover:text-take-red"
                          onClick={() =>
                            setDraft((d) => (d ? { ...structuredClone(d), subtitles: d.subtitles.filter((x) => x.id !== sub.id) } : d))
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                        {!visible && <p className="text-xs text-muted sm:col-span-4">Cau en un tram llevat: no eixirà al vídeo.</p>}
                      </li>
                    )
                  })}
                </ul>
              )}

              {tab === 'ganxo' && (
                <Section title="Ganxo" intro="Dues línies grans en els 3 primers segons. Durant el ganxo no ixen subtítols.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Primera línia">
                      <input
                        value={draft.hook.line1}
                        onChange={(e) => setDraft((d) => (d ? { ...d, hook: { ...d.hook, line1: e.target.value } } : d))}
                      />
                    </Field>
                    <Field label="Segona línia">
                      <input
                        value={draft.hook.line2}
                        onChange={(e) => setDraft((d) => (d ? { ...d, hook: { ...d.hook, line2: e.target.value } } : d))}
                      />
                    </Field>
                  </div>
                </Section>
              )}

              {tab === 'resum' && (
                <div className="space-y-4">
                  <Section title="Què ha fet Claude">
                    <p className="max-w-[70ch]">{draft.summary}</p>
                    {draft.warnings.length > 0 && (
                      <>
                        <p className="mt-4 font-semibold">El que convé que revises</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                          {draft.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {project.notices && project.notices.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {project.notices.map((n, i) => (
                          <li key={i}>
                            <Notice>{n}</Notice>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                  <Section
                    title="Tornar a editar des de zero"
                    intro="Claude torna a decidir els talls, els subtítols i el ganxo. Perds els retocs que no hages aplicat."
                  >
                    <Field label="Indicacions per a Claude">
                      <textarea
                        rows={3}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="Per exemple: deixa la frase del final, el ganxo ha de parlar de temps"
                      />
                    </Field>
                    <Button className="mt-3" onClick={() => void redoAuto()} disabled={running}>
                      <Wand2 size={16} /> Tornar a editar automàticament
                    </Button>
                  </Section>
                </div>
              )}
            </div>
          </div>

          {project.final && (
            <Section
              title="Vídeo final"
              intro={`Generat el ${new Date(project.final.updatedAt).toLocaleString('ca-ES')}. Si canvies alguna cosa, torna a generar-lo.`}
            >
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <video
                  key={project.final.updatedAt}
                  src={projectFileUrl(project.id, project.final.file, project.final.updatedAt)}
                  controls
                  playsInline
                  className="aspect-[9/16] w-full rounded-xl bg-black"
                />
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Stat label="Durada" value={formatSeconds(project.final.duration)} />
                    <Stat label="Format" value="1080×1920 · 30 fps" />
                    <Stat label="Volum" value={project.final.lufs != null ? `${project.final.lufs} LUFS` : '—'} />
                    <Stat label="Pic real" value={project.final.truePeak != null ? `${project.final.truePeak} dB` : '—'} />
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <a href={downloadUrl(project.id, 'final')} className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink">
                      <Download size={16} /> Descarregar {project.final.file}
                    </a>
                    <a href={downloadUrl(project.id, 'clean')} className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold">
                      <Download size={16} /> Còpia neta per a efectes
                    </a>
                  </div>
                  <p className="text-sm text-muted">
                    La còpia neta és el mateix muntatge sense textos ni logo. És la que usa la skill efectos-reels per als 29 efectes.
                    No es publica res: el vídeo el puges tu.
                  </p>
                </div>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sunken p-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}

function TimeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      step={0.05}
      min={0}
      aria-label={label}
      value={Number(value.toFixed(2))}
      onChange={(e) => {
        const v = Number(e.target.value)
        if (Number.isFinite(v)) onChange(v)
      }}
      className="!w-[5.2rem] !px-2 !py-1 font-mono text-xs"
    />
  )
}

/** La presa sencera: cada tram amb el seu color. Fer clic activa o desactiva el tram. */
function Timeline({ segments, duration, onToggle }: { segments: Segment[]; duration: number; onToggle: (id: string) => void }) {
  if (duration <= 0) return null
  const kept = keptRanges(segments)
  return (
    <div className="rounded-xl bg-[#1d2330] p-3 text-white">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold">La presa sencera</span>
        <span className="font-mono text-white/70">
          {formatSeconds(duration)} → {formatSeconds(outputDuration(kept))}
        </span>
      </div>
      <div className="relative h-10 overflow-hidden rounded-md bg-white/10">
        {segments.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onToggle(s.id)}
            title={`${s.keep ? 'Es queda' : KIND[s.kind].label}: ${s.text}`}
            aria-label={`${s.keep ? 'Llevar' : 'Recuperar'} «${s.text}»`}
            className={`absolute inset-y-0 border-x border-[#1d2330] ${s.keep ? 'bg-white' : `${KIND[s.kind].bar} opacity-90`} hover:brightness-110`}
            style={{ left: `${(s.start / duration) * 100}%`, width: `${Math.max(0.4, ((s.end - s.start) / duration) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/80">
        <Legend className="bg-white" label="Es queda" />
        <Legend className="bg-take-red" label="Equivocacions" />
        <Legend className="bg-take-amber" label="Repeticions i crosses" />
        <Legend className="bg-white/10" label="Silencis" />
        <span className="ml-auto">Fes clic en un tram per a llevar-lo o recuperar-lo</span>
      </div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-3 rounded-sm ${className}`} /> {label}
    </span>
  )
}
