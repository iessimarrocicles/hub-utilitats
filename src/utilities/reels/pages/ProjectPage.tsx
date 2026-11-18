import { ArrowLeft, CheckCircle2, Circle, Plus, Search, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Field, Notice, PromptBlock, Section } from '../../../components/ui'
import { newId } from '../../../lib/storage'
import { TakeBar } from '../components/TakeBar'
import { EFFECTS, getEffect } from '../data/effects'
import { PHRASES, getPhrase } from '../data/phrases'
import { STEPS, type ReelProject, type StepId } from '../model'
import {
  buildEditPrompt,
  buildEffectsPrompt,
  buildFeedbackPrompt,
  buildPhrasesPrompt,
  cleanFileName,
  normalizeTime,
} from '../prompts'
import { useProject } from '../store'

type Update = (change: (draft: ReelProject) => void) => void

export function ProjectPage() {
  const { id } = useParams()
  const { project, update } = useProject(id)
  const [step, setStep] = useState<StepId>(() => {
    if (!project) return 'video'
    return STEPS.find((s) => !project.steps[s.id])?.id ?? 'delivered'
  })

  if (!project) {
    return (
      <div className="rounded-xl border border-dashed border-line p-10 text-center">
        <p className="headline text-2xl">No trobe aquest reel</p>
        <p className="mt-1 text-muted">Pot ser que l’hages esborrat o que les dades siguen d’un altre navegador.</p>
        <Link to="/reels" className="mt-4 inline-block font-semibold text-accent">
          Tornar a la llista de reels
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/reels" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Tots els reels
      </Link>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <Field label="Nom del reel">
          <input
            value={project.name}
            onChange={(e) => update((d) => void (d.name = e.target.value))}
            className="headline !text-2xl"
          />
        </Field>
        <Field label="Fitxer en brut" hint={`La còpia neta es dirà ${cleanFileName(project.rawFile)}.`}>
          <input value={project.rawFile} onChange={(e) => update((d) => void (d.rawFile = e.target.value))} />
        </Field>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={project.emptyRoom}
          onChange={(e) => update((d) => void (d.emptyRoom = e.target.checked))}
        />
        <span>
          He gravat tres segons de l’habitació buida al final
          <span className="block text-sm text-muted">Cal per a «Que desaparega». Sense aquest fons no hi ha res a posar darrere.</span>
        </span>
      </label>

      <TakeBar project={project} selected={step} onSelect={setStep} />

      <div role="tabpanel">
        {step === 'video' && <VideoStep project={project} update={update} />}
        {step === 'review' && <ReviewStep project={project} update={update} />}
        {step === 'phrases' && <PhrasesStep project={project} update={update} />}
        {step === 'effects' && <EffectsStep project={project} update={update} />}
        {step === 'delivered' && <DeliveredStep project={project} update={update} />}
      </div>

      <Section title="Notes">
        <textarea
          rows={3}
          value={project.notes}
          onChange={(e) => update((d) => void (d.notes = e.target.value))}
          placeholder="Guió, idees per al ganxo, la paraula per a comentar…"
        />
      </Section>
    </div>
  )
}

function StepDone({ project, update, step }: { project: ReelProject; update: Update; step: StepId }) {
  const done = project.steps[step]
  return (
    <Button
      variant={done ? 'ghost' : 'primary'}
      onClick={() => update((d) => void (d.steps[step] = !d.steps[step]))}
    >
      {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      {done ? 'Fet. Desmarcar' : 'Marcar com a fet'}
    </Button>
  )
}

function VideoStep({ project, update }: { project: ReelProject; update: Update }) {
  return (
    <Section
      title="Passa-li el vídeo"
      intro="Obri Claude Code a la carpeta Editor amb el vídeo ja dins de Brutos i enganxa aquest text."
      aside={<StepDone project={project} update={update} step="video" />}
    >
      <div className="space-y-4">
        <Notice>
          Abans, escriu <code className="font-mono">/model</code> i tria Opus 5.5. Després,{' '}
          <code className="font-mono">/effort max</code>. Només val per a eixa sessió. Si tarda massa, prova{' '}
          <code className="font-mono">/effort xhigh</code>.
        </Notice>
        <PromptBlock text={buildEditPrompt(project)} />
        <p className="text-sm text-muted">
          Mentre treballa veuràs la transcripció amb el que sobra marcat, els talls, el storyboard pla a pla i la revisió fotograma a
          fotograma. No munta res fins que li dius que sí al storyboard.
        </p>
      </div>
    </Section>
  )
}

function ReviewStep({ project, update }: { project: ReelProject; update: Update }) {
  const [time, setTime] = useState('')
  const [text, setText] = useState('')
  const [toBrand, setToBrand] = useState(false)

  function add(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    update((d) => {
      d.feedback.push({ id: newId(), time: normalizeTime(time), text: text.trim(), resolved: false, toBrand })
    })
    setTime('')
    setText('')
    setToBrand(false)
  }

  const prompt = buildFeedbackPrompt(project)

  return (
    <Section
      title="Revisa i demana canvis"
      intro="Mira el vídeo sencer i apunta el que no t’agrada amb el segon exacte. La primera vegada calen unes quantes voltes."
      aside={<StepDone project={project} update={update} step="review" />}
    >
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[7rem_1fr_auto] sm:items-end">
        <Field label="Segon">
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="0:12" inputMode="numeric" />
        </Field>
        <Field label="Què cal canviar">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Sobra la pausa" />
        </Field>
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          <Plus size={16} /> Afegir
        </Button>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" checked={toBrand} onChange={(e) => setToBrand(e.target.checked)} />
          Apuntar-ho també a marca.md perquè no torne a passar
        </label>
      </form>

      {project.feedback.length > 0 && (
        <ul className="mt-5 divide-y divide-line rounded-lg border border-line">
          {project.feedback.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={f.resolved}
                aria-label="Resolt"
                onChange={(e) =>
                  update((d) => {
                    const item = d.feedback.find((x) => x.id === f.id)
                    if (item) item.resolved = e.target.checked
                  })
                }
              />
              <span className="w-12 shrink-0 font-mono text-sm text-muted">{f.time || '—'}</span>
              <span className={`flex-1 ${f.resolved ? 'text-muted line-through' : ''}`}>
                {f.text}
                {f.toBrand && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs">marca.md</span>}
              </span>
              <button
                type="button"
                aria-label="Esborrar la correcció"
                className="rounded p-1 text-muted hover:text-take-red"
                onClick={() => update((d) => void (d.feedback = d.feedback.filter((x) => x.id !== f.id)))}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <PromptBlock text={prompt} empty="Quan afegisques correccions pendents, ací tindràs el text per a enviar-les totes juntes." />
      </div>
    </Section>
  )
}

function PhrasesStep({ project, update }: { project: ReelProject; update: Update }) {
  const selected = new Set(project.phrases.map((p) => p.phraseId))
  const needsRoom = project.phrases.some((p) => getPhrase(p.phraseId)?.needsEmptyRoom) && !project.emptyRoom

  function toggle(phraseId: string) {
    update((d) => {
      if (d.phrases.some((p) => p.phraseId === phraseId)) d.phrases = d.phrases.filter((p) => p.phraseId !== phraseId)
      else d.phrases.push({ id: newId(), phraseId, time: '' })
    })
  }

  return (
    <Section
      title="Canvia el vídeo amb una frase"
      intro="Quan el tall estiga bé, tria l’estil i el segon on el vols."
      aside={<StepDone project={project} update={update} step="phrases" />}
    >
      <div className="flex flex-wrap gap-2">
        {PHRASES.map((p) => {
          const on = selected.has(p.id)
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p.id)}
              title={p.result}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-panel hover:border-accent'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {project.phrases.length > 0 && (
        <ul className="mt-5 space-y-2">
          {project.phrases.map((pick) => {
            const phrase = getPhrase(pick.phraseId)
            if (!phrase) return null
            return (
              <li key={pick.id} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_8rem] sm:items-center">
                <div>
                  <p className="font-semibold">«{phrase.ask}»</p>
                  <p className="text-sm text-muted">{phrase.result}</p>
                </div>
                <input
                  aria-label={`Segon per a ${phrase.label}`}
                  placeholder="Des del segon"
                  value={pick.time}
                  onChange={(e) =>
                    update((d) => {
                      const item = d.phrases.find((x) => x.id === pick.id)
                      if (item) item.time = e.target.value
                    })
                  }
                />
              </li>
            )
          })}
        </ul>
      )}

      {needsRoom && (
        <div className="mt-4">
          <Notice>«Que desaparega» necessita la presa de l’habitació buida, i encara no l’has marcada com a gravada.</Notice>
        </div>
      )}

      <div className="mt-5">
        <PromptBlock text={buildPhrasesPrompt(project)} empty="Tria una o més frases per a generar el text." />
      </div>
    </Section>
  )
}

function EffectsStep({ project, update }: { project: ReelProject; update: Update }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const options = EFFECTS.filter((e) => !q || `${e.id} ${e.name} ${e.description}`.toLowerCase().includes(q))
  const cutout = project.effects.filter((p) => getEffect(p.effectId)?.needsCutout)
  const needsRoom = project.effects.some((p) => getEffect(p.effectId)?.needsEmptyRoom) && !project.emptyRoom

  return (
    <Section
      title="Efectes"
      intro={
        <>
          Van sobre la còpia neta <code className="font-mono text-sm">{cleanFileName(project.rawFile)}</code>, ja tallada i sense
          subtítols. Primer et retalla del fons: compta uns 6 minuts per cada minut de vídeo.
        </>
      }
      aside={<StepDone project={project} update={update} step="effects" />}
    >
      <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
        <div>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca un efecte"
              className="!pl-9"
              aria-label="Busca un efecte"
            />
          </div>
          <ul className="mt-2 max-h-[26rem] overflow-auto rounded-lg border border-line">
            {options.map((e) => (
              <li key={e.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => update((d) => void d.effects.push({ id: newId(), effectId: e.id, anchor: '' }))}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-sunken"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted">{e.id}</span>
                  <span className="flex-1 text-sm">{e.name}</span>
                  <Plus size={16} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          {project.effects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-center text-muted">
              Afig efectes de la llista. Si no saps quins, demana-li «posa-li els efectes que millor li queden i ensenya’m abans on
              van».
            </p>
          ) : (
            <ul className="space-y-2">
              {project.effects.map((pick) => {
                const e = getEffect(pick.effectId)
                if (!e) return null
                return (
                  <li key={pick.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {e.id}. {e.name}
                        </p>
                        <p className="text-sm text-muted">{e.description}</p>
                        {e.tip && <p className="mt-1 text-sm">{e.tip}</p>}
                      </div>
                      <button
                        type="button"
                        aria-label={`Llevar ${e.name}`}
                        className="rounded p-1 text-muted hover:text-take-red"
                        onClick={() => update((d) => void (d.effects = d.effects.filter((x) => x.id !== pick.id)))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <input
                      className="mt-2"
                      aria-label={`On va ${e.name}`}
                      placeholder="Paraula on va (Claude) o segon (0:25)"
                      value={pick.anchor}
                      onChange={(ev) =>
                        update((d) => {
                          const item = d.effects.find((x) => x.id === pick.id)
                          if (item) item.anchor = ev.target.value
                        })
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}

          {cutout.length > 0 && (
            <Notice>
              {cutout.length === 1 ? 'Un efecte depén' : `${cutout.length} efectes depenen`} de com de bé et retalla Hyperframes. Si
              sostens alguna cosa a la mà o et mous molt, mira’ls amb calma.
            </Notice>
          )}
          {needsRoom && <Notice>«Que desaparega» necessita la presa de l’habitació buida, i encara no l’has marcada com a gravada.</Notice>}

          <PromptBlock text={buildEffectsPrompt(project)} empty="Afig almenys un efecte per a generar el text." />
        </div>
      </div>
    </Section>
  )
}

function DeliveredStep({ project, update }: { project: ReelProject; update: Update }) {
  return (
    <Section
      title="Publicat"
      intro="Claude et lliura el vídeo a Exportados i el puges tu. No el deixes publicar res."
      aside={<StepDone project={project} update={update} step="delivered" />}
    >
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>MP4 H.264 a −14 LUFS, amb el resum del que ha tallat i per què.</li>
        <li>La còpia neta {cleanFileName(project.rawFile)} per si després vols efectes.</li>
        <li>Les correccions que vols conservar, apuntades a marca.md.</li>
      </ul>
    </Section>
  )
}
