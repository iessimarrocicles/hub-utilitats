import { Copy, Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button, Field, Notice, Section } from '../../../components/ui'
import { tutorialsApi, type TutorialMeta } from '../api'
import { FONT_FAMILIES } from '../catalog'
import type { GraphicId, StyleTemplate, VideoFormat } from '../types'

export function TemplatesPage() {
  const [meta, setMeta] = useState<TutorialMeta | null>(null)
  const [editing, setEditing] = useState<StyleTemplate | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const load = useCallback(async () => {
    try {
      setMeta(await tutorialsApi.meta())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => void load(), [load])

  if (!meta) return error ? <Notice>{error}</Notice> : <p className="text-muted">Carregant…</p>
  const custom = meta.templates.filter((t) => !meta.builtinIds.includes(t.id))

  async function persist(list: StyleTemplate[]) {
    try {
      await tutorialsApi.saveTemplates(list)
      await load()
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-6">
      {error && <Notice>{error}</Notice>}
      <Section title="Plantilles d’estil" intro="Una plantilla fixa colors, lletres, cursor, subtítols, transicions, zoom, format, veu i motion graphics per defecte. Duplica’n una per a fer la teua.">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meta.templates.map((t) => {
            const builtin = meta.builtinIds.includes(t.id)
            return (
              <li key={t.id} className="overflow-hidden rounded-lg border border-line">
                <div className="flex h-20 items-end gap-1 p-3" style={{ background: `linear-gradient(135deg, ${t.colors.background}, ${t.colors.background2})` }}>
                  {[t.colors.accent, t.colors.text, t.colors.surface, t.colors.muted].map((c) => (
                    <span key={c} className="h-6 w-6 rounded-full border border-black/10" style={{ background: c }} />
                  ))}
                </div>
                <div className="p-3">
                  <p className="font-semibold">
                    {t.name} {builtin && <span className="text-xs font-normal text-muted">· de sèrie</span>}
                  </p>
                  <p className="text-xs text-muted">{t.description}</p>
                  <div className="mt-2 flex gap-2">
                    <Button onClick={() => setEditing({ ...structuredClone(t), id: `meua-${Date.now().toString(36)}`, name: `${t.name} (còpia)` })}>
                      <Copy size={14} /> Duplicar
                    </Button>
                    {!builtin && (
                      <>
                        <Button onClick={() => setEditing(structuredClone(t))}>Editar</Button>
                        <Button variant="danger" onClick={() => confirm(`Esborrar «${t.name}»?`) && persist(custom.filter((x) => x.id !== t.id))}>
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Section>

      {editing && (
        <TemplateEditor
          t={editing}
          meta={meta}
          saved={saved}
          onChange={setEditing}
          onSave={() => persist([...custom.filter((x) => x.id !== editing.id), editing])}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function TemplateEditor({
  t,
  meta,
  saved,
  onChange,
  onSave,
  onClose,
}: {
  t: StyleTemplate
  meta: TutorialMeta
  saved: boolean
  onChange: (t: StyleTemplate) => void
  onSave: () => void
  onClose: () => void
}) {
  const set = (patch: Partial<StyleTemplate>) => onChange({ ...t, ...patch })
  const color = (k: keyof StyleTemplate['colors'], label: string) => (
    <label key={k} className="flex items-center gap-2 text-sm">
      <input type="color" value={t.colors[k]} onChange={(e) => set({ colors: { ...t.colors, [k]: e.target.value } })} />
      {label}
    </label>
  )
  const toggle = (g: GraphicId) => set({ graphics: t.graphics.includes(g) ? t.graphics.filter((x) => x !== g) : [...t.graphics, g] })

  return (
    <Section
      title={`Editant «${t.name}»`}
      aside={
        <div className="flex gap-2">
          <Button variant="primary" onClick={onSave}>
            <Save size={16} /> {saved ? 'Desada' : 'Desar'}
          </Button>
          <Button onClick={onClose}>Tancar</Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom">
          <input value={t.name} onChange={(e) => set({ name: e.target.value })} className="w-full rounded-md border border-line bg-sunken px-3 py-2" />
        </Field>
        <Field label="Descripció">
          <input value={t.description} onChange={(e) => set({ description: e.target.value })} className="w-full rounded-md border border-line bg-sunken px-3 py-2" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          {color('background', 'Fons')}
          {color('background2', 'Fons 2')}
          {color('accent', 'Accent')}
          {color('text', 'Text')}
          {color('surface', 'Superfície')}
          {color('muted', 'Secundari')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lletra dels títols">
            <select value={t.fonts.title} onChange={(e) => set({ fonts: { ...t.fonts, title: e.target.value } })} className="w-full rounded-md border border-line bg-sunken px-2 py-2">
              {FONT_FAMILIES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Lletra del text">
            <select value={t.fonts.body} onChange={(e) => set({ fonts: { ...t.fonts, body: e.target.value } })} className="w-full rounded-md border border-line bg-sunken px-2 py-2">
              {FONT_FAMILIES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Cursor">
            <select value={t.cursor} onChange={(e) => set({ cursor: e.target.value as StyleTemplate['cursor'] })} className="w-full rounded-md border border-line bg-sunken px-2 py-2">
              <option value="mac">Fletxa</option>
              <option value="dot">Punt</option>
              <option value="ring">Anell</option>
            </select>
          </Field>
          <Field label="Transició">
            <select value={t.transition} onChange={(e) => set({ transition: e.target.value as StyleTemplate['transition'] })} className="w-full rounded-md border border-line bg-sunken px-2 py-2">
              <option value="fade">Fosa</option>
              <option value="slide">Lliscar</option>
              <option value="zoom">Zoom</option>
              <option value="wipe">Cortina</option>
            </select>
          </Field>
          <Field label="Format per defecte">
            <select value={t.format} onChange={(e) => set({ format: e.target.value as VideoFormat })} className="w-full rounded-md border border-line bg-sunken px-2 py-2">
              <option value="1080p">16:9 · 1080p</option>
              <option value="4k">16:9 · 4K</option>
              <option value="vertical">9:16</option>
            </select>
          </Field>
          <Field label={`Zoom màxim: ${t.zoom.toFixed(1)}×`}>
            <input type="range" min={1.2} max={2.6} step={0.1} value={t.zoom} onChange={(e) => set({ zoom: Number(e.target.value) })} className="w-full" />
          </Field>
          <Field label={`Subtítols: ${t.captions.size}px`}>
            <input type="range" min={28} max={72} step={2} value={t.captions.size} onChange={(e) => set({ captions: { ...t.captions, size: Number(e.target.value) } })} className="w-full" />
          </Field>
          <Field label={`Arrodoniment: ${t.radius}px`}>
            <input type="range" min={0} max={32} value={t.radius} onChange={(e) => set({ radius: Number(e.target.value) })} className="w-full" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={t.captions.box} onChange={(e) => set({ captions: { ...t.captions, box: e.target.checked } })} />
          Subtítols amb caixa fosca
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!t.hyperframes} onChange={(e) => set({ hyperframes: e.target.checked })} />
          Intro i tancament amb HyperFrames (16:9 a 1080p)
        </label>
        <Field label="Logotip (opcional)" hint="Apareix a la intro i al tancament.">
          <input
            type="file"
            accept="image/png,image/svg+xml,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const r = new FileReader()
              r.onload = () => set({ logo: String(r.result) })
              r.readAsDataURL(f)
            }}
          />
        </Field>
      </div>
      <p className="mb-2 mt-5 text-sm font-semibold">Motion graphics per defecte</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {meta.graphics.map((g) => (
          <label key={g.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={t.graphics.includes(g.id)} onChange={() => toggle(g.id)} />
            {g.name}
          </label>
        ))}
      </div>
    </Section>
  )
}
