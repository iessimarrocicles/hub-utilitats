import { Player } from '@remotion/player'
import { ArrowDown, ArrowUp, CheckCircle2, Download, Play, RefreshCw, Save, Trash2, Volume2, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tutorial } from '../../../../video/Tutorial'
import { SIZES, buildTimeline, FPS, toFrames } from '../../../../video/lib/timeline'
import { Button, Field, Notice, Section } from '../../../components/ui'
import { JobProgress } from '../../reels/auto/components'
import { serverFileUrl, tutorialFileUrl, tutorialsApi, useTutorialJob, type TutorialMeta } from '../api'
import { PER_SCENE_GRAPHICS } from '../catalog'
import { TTS_ENGINES } from '../types'
import type { Action, CompositionInput, GenerateSettings, GraphicId, Scene, Storyboard, StyleTemplate, TtsEngineId, TutorialProject, VideoFormat } from '../types'
import { CoverPanel } from './CoverPanel'
import { STATUS } from './ProjectsPage'
import { projectCover } from '../../../../video/lib/cover'

const FORMATS: { id: VideoFormat; label: string }[] = [
  { id: '1080p', label: '16:9 · 1080p' },
  { id: '4k', label: '16:9 · 4K' },
  { id: 'vertical', label: '9:16 · vertical' },
]

const ACTION_LABEL: Record<Action['type'], string> = {
  goto: 'Obrir',
  click: 'Clic',
  type: 'Escriure',
  hover: 'Passar per damunt',
  scroll: 'Desplaçar',
  select: 'Triar',
  press: 'Tecla',
  wait: 'Esperar',
}

export function settingsForTemplate(t: StyleTemplate): GenerateSettings {
  return { templateId: t.id, format: t.format, voice: { ...t.voice }, graphics: [...t.graphics] }
}

export function TutorialPage() {
  const { id = '' } = useParams()
  const [project, setProject] = useState<TutorialProject | null>(null)
  const [meta, setMeta] = useState<TutorialMeta | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const [{ project: p, job }, m] = await Promise.all([tutorialsApi.get(id), tutorialsApi.meta()])
      setProject(p)
      setMeta(m)
      if (job?.status === 'running') setJob(job)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  const [job, setJob] = useTutorialJob(() => void load())
  useEffect(() => void load(), [load])

  if (error && !project) return <Notice>{error}</Notice>
  if (!project || !meta) return <p className="text-muted">Carregant…</p>
  const busy = job?.status === 'running'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/tutorials" className="text-sm text-muted hover:text-ink">
            ← Tots els tutorials
          </Link>
          <h2 className="headline mt-1 text-3xl">{project.storyboard?.title ?? project.name}</h2>
          <a href={project.url} target="_blank" rel="noreferrer" className="text-sm text-muted underline">
            {project.url}
          </a>
        </div>
        <span className={`rounded px-2 py-1 text-sm font-semibold ${STATUS[project.status].tone}`}>{STATUS[project.status].label}</span>
      </div>
      {error && <Notice>{error}</Notice>}
      {project.lastError && project.status === 'error' && !busy && <Notice>{project.lastError}</Notice>}
      {job && <JobProgress job={job} />}
      {project.notices?.map((n) => (
        <Notice key={n}>{n}</Notice>
      ))}

      {project.final && <FinalVideo project={project} />}

      {project.storyboard ? (
        <>
          <CoverPanel project={project} busy={busy} onSaved={setProject} />
          <GeneratePanel project={project} meta={meta} busy={busy} onJob={setJob} onError={setError} onSaved={setProject} />
          <ScriptEditor project={project} meta={meta} busy={busy} onJob={setJob} onError={setError} onSaved={setProject} />
        </>
      ) : (
        !busy && (
          <Section title="Sense guió" intro="Encara no s’ha pogut escriure el guió d’aquesta pàgina.">
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  setJob(await tutorialsApi.script(project.id, project.brief, 3))
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              <Wand2 size={16} /> Escriure el guió
            </Button>
          </Section>
        )
      )}
    </div>
  )
}

interface PanelProps {
  project: TutorialProject
  meta: TutorialMeta
  busy: boolean
  onJob: (j: Awaited<ReturnType<typeof tutorialsApi.generate>>) => void
  onError: (e: string) => void
  onSaved: (p: TutorialProject) => void
}

// --- Vídeo final -----------------------------------------------------------------

function FinalVideo({ project }: { project: TutorialProject }) {
  const f = project.final!
  const v = f.updatedAt
  return (
    <Section
      title="Vídeo final"
      intro={`${Math.round(f.duration)} s · ${f.lufs != null ? `${f.lufs.toFixed(1)} LUFS` : 'volum sense mesurar'} · amb capítols i subtítols a part.`}
    >
      <video controls src={tutorialFileUrl(project.id, f.file, v)} poster={tutorialFileUrl(project.id, f.thumb, v)} className="w-full rounded-lg bg-black">
        <track kind="subtitles" srcLang="es" label="Español" src={tutorialFileUrl(project.id, f.vtt, v)} />
      </video>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { file: f.file, label: 'Vídeo (MP4)' },
          { file: f.srt, label: 'Subtítols (SRT)' },
          { file: f.vtt, label: 'Subtítols (VTT)' },
          { file: f.thumb, label: 'Miniatura' },
        ].map((d) => (
          <a key={d.file} href={tutorialFileUrl(project.id, d.file, v)} download={d.file}>
            <Button>
              <Download size={16} /> {d.label}
            </Button>
          </a>
        ))}
      </div>
    </Section>
  )
}

// --- Generació -------------------------------------------------------------------

function GeneratePanel({ project, meta, busy, onJob, onError, onSaved }: PanelProps) {
  const initial = useMemo(() => {
    if (project.settings) return project.settings
    return settingsForTemplate(meta.templates[0])
  }, [project.settings, meta.templates])
  const [s, setS] = useState<GenerateSettings>(initial)
  const [sample, setSample] = useState<{ url: string; loading: boolean }>({ url: '', loading: false })
  const [eleven, setEleven] = useState<{ id: string; name: string; detail: string }[]>([])
  const [studio, setStudio] = useState<{ id: string; name: string }[]>([])
  const template = meta.templates.find((t) => t.id === s.templateId) ?? meta.templates[0]

  useEffect(() => {
    if (s.voice.engine === 'elevenlabs' && meta.engines.elevenlabs.ready && eleven.length === 0) {
      tutorialsApi.elevenVoices().then(setEleven).catch((e) => onError(e instanceof Error ? e.message : String(e)))
    }
  }, [s.voice.engine, meta.engines.elevenlabs.ready, eleven.length, onError])

  useEffect(() => {
    if (s.voice.engine === 'voicestudio' && meta.engines.voicestudio.ready && studio.length === 0) {
      tutorialsApi.voicestudioVoices().then(setStudio).catch((e) => onError(e instanceof Error ? e.message : String(e)))
    }
  }, [s.voice.engine, meta.engines.voicestudio.ready, studio.length, onError])

  const setVoice = (v: Partial<GenerateSettings['voice']>) => setS((x) => ({ ...x, voice: { ...x.voice, ...v } }))

  // Les veus d'ElevenLabs i VoiceStudio arriben després de triar el motor: si la veu triada
  // no és a la llista (o està buida), s'agafa la primera. Si no, el botó de generar queda desactivat.
  const voiceIds = (s.voice.engine === 'elevenlabs' ? eleven : s.voice.engine === 'voicestudio' ? studio : []).map((v) => v.id)
  const firstVoice = voiceIds[0]
  const voiceMissing = voiceIds.length > 0 && !voiceIds.includes(s.voice.voice)
  useEffect(() => {
    if (voiceMissing && firstVoice) setS((x) => ({ ...x, voice: { ...x.voice, voice: firstVoice } }))
  }, [voiceMissing, firstVoice])
  const toggle = (g: GraphicId) =>
    setS((x) => ({ ...x, graphics: x.graphics.includes(g) ? x.graphics.filter((y) => y !== g) : [...x.graphics, g] }))

  const voicesFor = (engine: TtsEngineId) =>
    engine === 'kokoro'
      ? meta.kokoroVoices
      : engine === 'f5'
        ? meta.f5Voices.map((v) => ({ id: v, name: v }))
        : engine === 'voicestudio'
          ? studio
          : eleven.map((v) => ({ id: v.id, name: `${v.name}${v.detail ? ` · ${v.detail}` : ''}` }))

  async function listen() {
    setSample({ url: '', loading: true })
    try {
      const first = project.storyboard?.chapters[0]?.scenes[0]?.narration
      const r = await tutorialsApi.voiceSample(s.voice, first)
      setSample({ url: serverFileUrl(r.url), loading: false })
    } catch (e) {
      setSample({ url: '', loading: false })
      onError(e instanceof Error ? e.message : String(e))
    }
  }

  async function run() {
    onError('')
    try {
      onSaved(await tutorialsApi.patch(project.id, { settings: s }))
      onJob(await tutorialsApi.generate(project.id, s))
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    }
  }

  const engineReady = meta.engines[s.voice.engine].ready

  return (
    <Section
      title="Generar el vídeo"
      intro="Tria l’estil, els motion graphics i com es fa la veu. Si només canvies l’estil, la captura es reaprofita i va molt més ràpid."
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-semibold">Plantilla</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meta.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setS(settingsForTemplate(t))}
                className={`overflow-hidden rounded-lg border text-left transition-colors ${t.id === s.templateId ? 'border-accent ring-2 ring-accent' : 'border-line hover:border-accent'}`}
              >
                <TemplateSwatch t={t} />
                <div className="p-3">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-muted">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Format">
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <label key={f.id} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${s.format === f.id ? 'border-accent bg-accent/10 font-semibold' : 'border-line'}`}>
                  <input type="radio" className="sr-only" checked={s.format === f.id} onChange={() => setS((x) => ({ ...x, format: f.id }))} />
                  {f.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Com es genera la veu">
            <div className="flex flex-wrap gap-2">
              {TTS_ENGINES.map((e) => (
                <label
                  key={e}
                  title={meta.engines[e].detail}
                  className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${s.voice.engine === e ? 'border-accent bg-accent/10 font-semibold' : 'border-line'} ${meta.engines[e].ready ? '' : 'opacity-60'}`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={s.voice.engine === e}
                    onChange={() => setVoice({ engine: e, voice: voicesFor(e)[0]?.id ?? '' })}
                  />
                  {meta.engineNames[e]}
                </label>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Veu">
            <select value={s.voice.voice} onChange={(e) => setVoice({ voice: e.target.value })} className="w-full rounded-md border border-line bg-sunken px-3 py-2">
              {voicesFor(s.voice.engine).length === 0 && <option value="">(cap veu disponible)</option>}
              {voicesFor(s.voice.engine).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Velocitat: ${s.voice.speed.toFixed(2)}×`}>
            <input type="range" min={0.8} max={1.2} step={0.05} value={s.voice.speed} onChange={(e) => setVoice({ speed: Number(e.target.value) })} className="w-full" />
          </Field>
          <div className="flex items-end gap-2">
            <Button onClick={listen} disabled={!engineReady || sample.loading || !s.voice.voice}>
              <Volume2 size={16} /> {sample.loading ? 'Generant…' : 'Escoltar una mostra'}
            </Button>
          </div>
        </div>
        {sample.url && <audio controls autoPlay src={sample.url} className="w-full" />}
        {!engineReady && <Notice>{meta.engines[s.voice.engine].detail}. Configura-ho a la pestanya Veus.</Notice>}

        <div>
          <p className="mb-2 text-sm font-semibold">Motion graphics del vídeo</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {meta.graphics.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-line p-2 text-sm hover:border-accent">
                <input type="checkbox" className="mt-1" checked={s.graphics.includes(g.id)} onChange={() => toggle(g.id)} />
                <span>
                  <span className="font-semibold">{g.name}</span>
                  <span className="ml-1 text-xs text-muted">{g.layer === 'pantalla' ? '· pantalla completa' : g.perScene ? '· per escena' : ''}</span>
                  <span className="block text-xs text-muted">{g.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={s.coverInVideo !== false} onChange={(e) => setS((x) => ({ ...x, coverInVideo: e.target.checked }))} />
          <span>
            <span className="font-semibold">Començar el vídeo amb la miniatura</span>
            <span className="block text-xs text-muted">Ix els primers 3 segons, abans de la presentació. La miniatura com a imatge es genera igualment.</span>
          </span>
        </label>

        <LivePreview project={project} template={template} settings={s} />

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={run} disabled={busy || !engineReady || !s.voice.voice}>
            <Play size={16} /> {project.final ? 'Tornar a generar el vídeo' : 'Generar el vídeo'}
          </Button>
          <span className="text-sm text-muted">
            Veu → gravació de la pàgina → render a {s.format === '4k' ? '4K' : s.format === 'vertical' ? '1080×1920' : '1080p'} i 60 fps.
          </span>
        </div>
      </div>
    </Section>
  )
}

function TemplateSwatch({ t }: { t: StyleTemplate }) {
  return (
    <div className="relative h-24" style={{ background: `linear-gradient(135deg, ${t.colors.background}, ${t.colors.background2})` }}>
      <div
        className="absolute bottom-3 left-4 right-10 top-4 overflow-hidden"
        style={{ borderRadius: t.radius / 2, background: t.colors.surface, boxShadow: `0 8px 20px rgba(0,0,0,${t.shadow})` }}
      >
        <div className="h-3" style={{ background: '#eceff3' }} />
        <div className="m-2 h-2 w-1/2 rounded" style={{ background: t.colors.accent }} />
        <div className="mx-2 h-1.5 w-3/4 rounded bg-black/10" />
      </div>
      <span className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: t.colors.accent, color: '#fff', fontFamily: t.fonts.title }}>
        {t.format === 'vertical' ? '9:16' : '16:9'}
      </span>
    </div>
  )
}

/** Previsualització en directe amb Remotion: canvia la plantilla o els graphics i es veu al moment. */
function LivePreview({ project, template, settings }: { project: TutorialProject; template: StyleTemplate; settings: GenerateSettings }) {
  const input = useMemo<CompositionInput | null>(() => {
    if (!project.capture || !project.audio || !project.storyboard) return null
    return {
      storyboard: project.storyboard,
      capture: project.capture,
      captureSrc: tutorialFileUrl(project.id, project.capture.file),
      audio: project.audio.map((a) => ({ ...a, src: tutorialFileUrl(project.id, `audio/${a.file}`) })),
      template,
      graphics: settings.graphics,
      format: settings.format,
      cover: {
        ...projectCover(project),
        image: project.coverImage ? tutorialFileUrl(project.id, project.coverImage.file, project.coverImage.updatedAt) : undefined,
        inVideo: settings.coverInVideo !== false,
      },
    }
  }, [project, template, settings.graphics, settings.format, settings.coverInVideo])

  if (!input) {
    return (
      <p className="rounded-md bg-sunken p-3 text-sm text-muted">
        La previsualització en directe apareix quan ja s’ha gravat la pàgina una vegada (després de la primera generació).
      </p>
    )
  }
  const size = SIZES[input.format]
  const duration = Math.max(1, toFrames(buildTimeline(input).duration))
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Previsualització en directe</p>
      <div className="mx-auto overflow-hidden rounded-lg border border-line bg-black" style={{ maxWidth: input.format === 'vertical' ? 380 : '100%' }}>
        <Player
          component={Tutorial}
          inputProps={input}
          durationInFrames={duration}
          compositionWidth={size.width}
          compositionHeight={size.height}
          fps={FPS}
          controls
          style={{ width: '100%', aspectRatio: `${size.width} / ${size.height}` }}
          acknowledgeRemotionLicense
        />
      </div>
    </div>
  )
}

// --- Editor del guió --------------------------------------------------------------

function ScriptEditor({ project, meta, busy, onJob, onError, onSaved }: PanelProps) {
  const [board, setBoard] = useState<Storyboard>(project.storyboard!)
  const [dirty, setDirty] = useState(false)
  const [brief, setBrief] = useState(project.brief)
  const [minutes, setMinutes] = useState(3)
  useEffect(() => {
    setBoard(project.storyboard!)
    setDirty(false)
  }, [project.storyboard])

  const errors = new Map((project.validation ?? []).map((v) => [v.sceneId, v.error]))
  const words = board.chapters.flatMap((c) => c.scenes).reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0)
  const perScene = meta.graphics.filter((g) => PER_SCENE_GRAPHICS.includes(g.id))
  // Sense configuració desada, els de la primera plantilla (la que es tria per defecte).
  const defaults = project.settings?.graphics ?? meta.templates[0].graphics

  const change = (fn: (b: Storyboard) => void) => {
    setBoard((b) => {
      const copy = structuredClone(b)
      fn(copy)
      return copy
    })
    setDirty(true)
  }
  const updateScene = (ci: number, si: number, patch: Partial<Scene>) => change((b) => Object.assign(b.chapters[ci].scenes[si], patch))

  async function save() {
    try {
      onSaved(await tutorialsApi.patch(project.id, { storyboard: board }))
      setDirty(false)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Section
      title="Guió"
      intro={`${board.chapters.length} capítols · ${board.chapters.reduce((n, c) => n + c.scenes.length, 0)} escenes · ${words} paraules (≈ ${Math.max(1, Math.round(words / 140))} min de veu).`}
      aside={
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!dirty || busy} variant={dirty ? 'primary' : 'ghost'}>
            <Save size={16} /> Desar el guió
          </Button>
          <Button
            disabled={busy || dirty}
            onClick={async () => {
              try {
                onJob(await tutorialsApi.validate(project.id))
              } catch (e) {
                onError(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            <CheckCircle2 size={16} /> Provar a la pàgina
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Títol">
            <input value={board.title} onChange={(e) => change((b) => (b.title = e.target.value))} className="w-full rounded-md border border-line bg-sunken px-3 py-2" />
          </Field>
          <Field label="Resum (intro)">
            <input value={board.summary} onChange={(e) => change((b) => (b.summary = e.target.value))} className="w-full rounded-md border border-line bg-sunken px-3 py-2" />
          </Field>
        </div>
        <Field label="Idees clau (una per línia, per al resum final)">
          <textarea
            rows={3}
            value={board.takeaways.join('\n')}
            onChange={(e) => change((b) => (b.takeaways = e.target.value.split('\n').filter((x) => x.trim())))}
            className="w-full rounded-md border border-line bg-sunken px-3 py-2"
          />
        </Field>

        {board.chapters.map((c, ci) => (
          <div key={c.id} className="rounded-lg border border-line">
            <div className="flex items-center gap-2 border-b border-line bg-sunken px-3 py-2">
              <span className="font-mono text-sm text-muted">{String(ci + 1).padStart(2, '0')}</span>
              <input
                value={c.title}
                onChange={(e) => change((b) => (b.chapters[ci].title = e.target.value))}
                className="flex-1 bg-transparent font-semibold outline-none"
                aria-label="Títol del capítol"
              />
            </div>
            <ol className="divide-y divide-line">
              {c.scenes.map((s, si) => (
                <li key={s.id} className="space-y-2 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-8 shrink-0 font-mono text-xs text-muted">{s.id}</span>
                    <textarea
                      rows={2}
                      value={s.narration}
                      onChange={(e) => updateScene(ci, si, { narration: e.target.value })}
                      className="min-w-0 flex-1 rounded-md border border-line bg-sunken px-3 py-2"
                      aria-label="Narració"
                    />
                    <div className="flex flex-col gap-1">
                      <button type="button" aria-label="Pujar" className="text-muted hover:text-ink disabled:opacity-30" disabled={si === 0} onClick={() => change((b) => {
                        const sc = b.chapters[ci].scenes
                        ;[sc[si - 1], sc[si]] = [sc[si], sc[si - 1]]
                      })}>
                        <ArrowUp size={16} />
                      </button>
                      <button type="button" aria-label="Baixar" className="text-muted hover:text-ink disabled:opacity-30" disabled={si === c.scenes.length - 1} onClick={() => change((b) => {
                        const sc = b.chapters[ci].scenes
                        ;[sc[si + 1], sc[si]] = [sc[si], sc[si + 1]]
                      })}>
                        <ArrowDown size={16} />
                      </button>
                      <button type="button" aria-label="Esborrar l’escena" className="text-muted hover:text-take-red" onClick={() => change((b) => {
                        b.chapters[ci].scenes.splice(si, 1)
                        b.chapters = b.chapters.filter((x) => x.scenes.length > 0)
                      })}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="ml-10 flex flex-wrap items-center gap-2 text-xs">
                    {s.actions.map((a, ai) => (
                      <span key={ai} className="inline-flex items-center gap-1 rounded bg-sunken px-2 py-1">
                        <b>{ACTION_LABEL[a.type]}</b>
                        <span className="max-w-[22ch] truncate text-muted">
                          {a.value ?? a.target?.name ?? a.target?.label ?? a.target?.placeholder ?? a.target?.text ?? a.url ?? ''}
                        </span>
                        <button type="button" aria-label="Treure l’acció" className="text-muted hover:text-take-red" onClick={() => change((b) => b.chapters[ci].scenes[si].actions.splice(ai, 1))}>
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      value={s.callout ?? ''}
                      onChange={(e) => updateScene(ci, si, { callout: e.target.value || undefined })}
                      placeholder="Bafarada (opcional)"
                      className="w-44 rounded border border-line bg-sunken px-2 py-1"
                    />
                  </div>
                  <div className="ml-10 flex flex-wrap gap-1">
                    {perScene.map((g) => {
                      const active = (s.graphics ?? defaults).includes(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          title={`${g.description} Clic per a ${active ? 'llevar-lo' : 'posar-lo'} en aquesta escena.`}
                          onClick={() => {
                            const base = s.graphics ?? defaults.filter((x) => PER_SCENE_GRAPHICS.includes(x))
                            updateScene(ci, si, { graphics: active ? base.filter((x) => x !== g.id) : [...base, g.id] })
                          }}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${active ? 'border-accent bg-accent/10 text-ink' : 'border-line text-muted'} ${s.graphics ? '' : 'border-dashed'}`}
                        >
                          {g.name}
                        </button>
                      )
                    })}
                  </div>
                  {errors.get(s.id) && <p className="ml-10 text-xs text-take-red">No s’ha pogut fer: {errors.get(s.id)}</p>}
                </li>
              ))}
            </ol>
          </div>
        ))}

        <div className="rounded-lg border border-dashed border-line p-3">
          <p className="mb-2 text-sm font-semibold">Tornar a escriure el guió</p>
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Indicacions noves per a Claude Code" className="rounded-md border border-line bg-sunken px-3 py-2" />
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="rounded-md border border-line bg-sunken px-3 py-2">
              {[1, 2, 3, 4, 5, 6, 8].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
            <Button
              disabled={busy}
              onClick={async () => {
                if (dirty && !confirm('Perdràs els canvis que no has desat. Continuar?')) return
                try {
                  onJob(await tutorialsApi.script(project.id, brief, minutes))
                } catch (e) {
                  onError(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              <RefreshCw size={16} /> Reescriure
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}
