import { ImagePlus, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, DownloadButton, Field, Notice, PromptBlock, Section } from '../../../components/ui'
import { LOOK_PROMPT } from '../data/checklists'
import type { BrandProfile, Corner, HighlightStyle, HookPosition } from '../model'
import { buildMarcaMd } from '../prompts'
import { useBrand } from '../store'

const MAX_LOGO_BYTES = 400_000

/** Carrega la lletra de Google Fonts perquè la previsualització siga fidel. */
function useGoogleFont(family: string) {
  useEffect(() => {
    const name = family.trim()
    if (!name) return
    const id = `gf-${name.replace(/\s+/g, '-').toLowerCase()}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:ital,wght@0,400;0,700;0,900;1,700&display=swap`
    document.head.appendChild(link)
  }, [family])
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export function BrandPage() {
  const { brand, update, reset } = useBrand()
  const [frame, setFrame] = useState('')
  const [logoError, setLogoError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  useGoogleFont(brand.fonts.title.family)
  useGoogleFont(brand.fonts.body.family)

  const marca = buildMarcaMd(brand)

  return (
    <div className="space-y-6">
      <p className="max-w-[65ch] text-muted">
        La fitxa amb el teu estil. Claude la llig cada vegada que edita, així que tot ix igual. Pots dissenyar-la ací o demanar-li a
        Claude Code que te la proposen a partir dels reels que t’agraden.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Section title="Identitat">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de la marca">
                <input value={brand.name} onChange={(e) => update((d) => void (d.name = e.target.value))} />
              </Field>
              <Field label="Paraula per a comentar" hint="La que dius en el vídeo perquè et comenten.">
                <input value={brand.commentWord} onChange={(e) => update((d) => void (d.commentWord = e.target.value))} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="To">
                  <input value={brand.tone} onChange={(e) => update((d) => void (d.tone = e.target.value))} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Colors">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {(
                [
                  ['primary', 'Principal'],
                  ['secondary', 'Secundari'],
                  ['highlight', 'Destacat'],
                  ['text', 'Text'],
                  ['background', 'Fons de caixes'],
                ] as [keyof BrandProfile['colors'], string][]
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brand.colors[key]}
                      onChange={(e) => update((d) => void (d.colors[key] = e.target.value.toUpperCase()))}
                      aria-label={label}
                    />
                    <span className="font-mono text-xs text-muted">{brand.colors[key]}</span>
                  </div>
                </Field>
              ))}
            </div>
          </Section>

          <Section title="Lletres" intro="Només lletres gratuïtes de Google Fonts. Escriu el nom exacte.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Títols">
                <input
                  value={brand.fonts.title.family}
                  onChange={(e) => update((d) => void (d.fonts.title.family = e.target.value))}
                />
              </Field>
              <Field label="Fitxer dels títols" hint="Ruta on Claude la descarrega.">
                <input value={brand.fonts.title.file} onChange={(e) => update((d) => void (d.fonts.title.file = e.target.value))} />
              </Field>
              <Field label="Text i subtítols">
                <input value={brand.fonts.body.family} onChange={(e) => update((d) => void (d.fonts.body.family = e.target.value))} />
              </Field>
              <Field label="Fitxer del text">
                <input value={brand.fonts.body.file} onChange={(e) => update((d) => void (d.fonts.body.file = e.target.value))} />
              </Field>
            </div>
          </Section>

          <Section title="Títol del ganxo" intro="Dues línies grans en els 3 primers segons amb el que promet el vídeo.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Text d’exemple">
                <textarea rows={2} value={brand.hook.lines} onChange={(e) => update((d) => void (d.hook.lines = e.target.value))} />
              </Field>
              <div className="space-y-4">
                <Field label={`Mida: ${brand.hook.size} px`}>
                  <input
                    type="range"
                    min={60}
                    max={200}
                    value={brand.hook.size}
                    onChange={(e) => update((d) => void (d.hook.size = Number(e.target.value)))}
                  />
                </Field>
                <Field label="Lloc">
                  <select
                    value={brand.hook.position}
                    onChange={(e) => update((d) => void (d.hook.position = e.target.value as HookPosition))}
                  >
                    <option value="dalt">A dalt, damunt del cap</option>
                    <option value="darrere-del-cap">Darrere del cap</option>
                    <option value="centre">Al centre</option>
                  </select>
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Subtítols" intro="De 3 a 6 paraules per bloc, a l’altura del pit, amb la paraula forta destacada.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Frase d’exemple">
                <input value={brand.subtitles.sample} onChange={(e) => update((d) => void (d.subtitles.sample = e.target.value))} />
              </Field>
              <Field label="Paraula destacada">
                <input
                  value={brand.subtitles.highlightWord}
                  onChange={(e) => update((d) => void (d.subtitles.highlightWord = e.target.value))}
                />
              </Field>
              <Field label={`Mida: ${brand.subtitles.size} px`}>
                <input
                  type="range"
                  min={36}
                  max={110}
                  value={brand.subtitles.size}
                  onChange={(e) => update((d) => void (d.subtitles.size = Number(e.target.value)))}
                />
              </Field>
              <Field label={`Altura: ${brand.subtitles.height}% des de dalt`}>
                <input
                  type="range"
                  min={45}
                  max={85}
                  value={brand.subtitles.height}
                  onChange={(e) => update((d) => void (d.subtitles.height = Number(e.target.value)))}
                />
              </Field>
              <Field label="Com es destaca">
                <select
                  value={brand.subtitles.highlightStyle}
                  onChange={(e) => update((d) => void (d.subtitles.highlightStyle = e.target.value as HighlightStyle))}
                >
                  <option value="caixa">Caixa de color darrere</option>
                  <option value="color">Canvi de color</option>
                  <option value="cursiva">En cursiva</option>
                </select>
              </Field>
              <Field label="Color del text">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brand.subtitles.color}
                    onChange={(e) => update((d) => void (d.subtitles.color = e.target.value.toUpperCase()))}
                    aria-label="Color del text dels subtítols"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={brand.subtitles.box}
                      onChange={(e) => update((d) => void (d.subtitles.box = e.target.checked))}
                    />
                    Amb caixa de fons
                  </label>
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Logo">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Imatge PNG" hint="Es guarda en aquest navegador. Màxim 400 kB.">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-sm hover:border-accent">
                  <ImagePlus size={16} /> {brand.logo.dataUrl ? 'Canviar el logo' : 'Triar el logo'}
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      if (f.size > MAX_LOGO_BYTES) {
                        setLogoError('El logo pesa massa. Prova amb una versió de menys de 400 kB.')
                        return
                      }
                      setLogoError('')
                      const url = await readFile(f)
                      update((d) => void (d.logo.dataUrl = url))
                    }}
                  />
                </label>
              </Field>
              <Field label="Cantonada">
                <select value={brand.logo.corner} onChange={(e) => update((d) => void (d.logo.corner = e.target.value as Corner))}>
                  <option value="superior-esquerra">Superior esquerra</option>
                  <option value="superior-dreta">Superior dreta</option>
                  <option value="inferior-esquerra">Inferior esquerra</option>
                  <option value="inferior-dreta">Inferior dreta</option>
                </select>
              </Field>
              <Field label={`Mida: ${brand.logo.size} px`}>
                <input
                  type="range"
                  min={40}
                  max={240}
                  value={brand.logo.size}
                  onChange={(e) => update((d) => void (d.logo.size = Number(e.target.value)))}
                />
              </Field>
            </div>
            {logoError && (
              <div className="mt-3">
                <Notice>{logoError}</Notice>
              </div>
            )}
            {brand.logo.dataUrl && (
              <Button className="mt-3" onClick={() => update((d) => void (d.logo.dataUrl = ''))}>
                <Trash2 size={16} /> Llevar el logo
              </Button>
            )}
          </Section>

          <Section title="Ritme i so">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Transicions" hint="Cada quant canvia el pla, quins efectes sí i quins no.">
                <textarea rows={3} value={brand.transitions} onChange={(e) => update((d) => void (d.transitions = e.target.value))} />
              </Field>
              <Field label="So">
                <textarea rows={3} value={brand.sound} onChange={(e) => update((d) => void (d.sound = e.target.value))} />
              </Field>
            </div>
          </Section>

          <Section title="Regles fixes" intro="Les correccions que no vols tornar a fer també van ací.">
            <ul className="space-y-2">
              {brand.rules.map((rule, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    value={rule}
                    aria-label={`Regla ${i + 1}`}
                    onChange={(e) => update((d) => void (d.rules[i] = e.target.value))}
                  />
                  <button
                    type="button"
                    aria-label="Esborrar la regla"
                    className="rounded p-2 text-muted hover:text-take-red"
                    onClick={() => update((d) => void d.rules.splice(i, 1))}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <Button className="mt-3" onClick={() => update((d) => void d.rules.push(''))}>
              <Plus size={16} /> Afegir una regla
            </Button>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Preview brand={brand} frame={frame} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-ink">
            <ImagePlus size={16} />
            {frame ? 'Canviar el fotograma' : 'Provar sobre un fotograma teu'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) setFrame(await readFile(f))
              }}
            />
          </label>
          <p className="text-xs text-muted">El fotograma només es mostra ara. No es guarda.</p>
          <div className="flex flex-wrap gap-2">
            <DownloadButton filename="marca.md" text={marca} />
            {confirmReset ? (
              <Button
                variant="danger"
                onClick={() => {
                  reset()
                  setConfirmReset(false)
                }}
              >
                Sí, tornar als valors inicials
              </Button>
            ) : (
              <Button onClick={() => setConfirmReset(true)}>
                <RotateCcw size={16} /> Començar de nou
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">Desa marca.md a la carpeta Editor, al costat de Brutos.</p>
        </aside>
      </div>

      <Section title="marca.md" intro="El fitxer que llig la skill editor-reels.">
        <PromptBlock text={marca} filename="marca.md" />
      </Section>

      <Section
        title="O que te la propose Claude"
        intro="Deixa el logo i dos o tres reels que t’agraden a Referencias. Et farà tres mostres sobre un fotograma teu i escriurà marca.md amb la que tries."
      >
        <PromptBlock text={LOOK_PROMPT} />
      </Section>
    </div>
  )
}

const SCALE = 0.25 // 1080 px → 270 px

function Preview({ brand, frame }: { brand: BrandProfile; frame: string }) {
  const c = brand.colors
  const s = brand.subtitles
  const word = s.highlightWord.trim()
  const parts = word ? s.sample.split(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i')) : [s.sample]

  const corner: Record<Corner, string> = {
    'superior-esquerra': 'top-3 left-3',
    'superior-dreta': 'top-3 right-3',
    'inferior-esquerra': 'bottom-3 left-3',
    'inferior-dreta': 'bottom-3 right-3',
  }
  // El títol no ha de trepitjar el logo: si tots dos van a dalt, el títol comença davall.
  const logoOnTop = brand.logo.corner.startsWith('superior')
  const hookTop: Record<HookPosition, string> = {
    dalt: logoOnTop ? `${12 + brand.logo.size * SCALE + 8}px` : '6%',
    'darrere-del-cap': '24%',
    centre: '42%',
  }

  return (
    <figure>
      <div
        className="relative mx-auto aspect-[9/16] w-[270px] overflow-hidden rounded-[22px] border-[6px] border-ink bg-[#2a2e35]"
        role="img"
        aria-label="Previsualització del look sobre un vídeo vertical"
      >
        {frame ? (
          <img src={frame} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <svg viewBox="0 0 270 480" className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <linearGradient id="wall" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#c9c3b8" />
                <stop offset="1" stopColor="#8f8a82" />
              </linearGradient>
            </defs>
            <rect width="270" height="480" fill="url(#wall)" />
            <ellipse cx="135" cy="200" rx="44" ry="54" fill="#4b4038" />
            <path d="M40 480 C 45 330, 95 292, 135 292 C 175 292, 225 330, 230 480 Z" fill="#2f3a4f" />
          </svg>
        )}

        <div
          className="absolute inset-x-3 z-10 text-center"
          style={{
            top: hookTop[brand.hook.position],
            fontFamily: `"${brand.fonts.title.family}", sans-serif`,
            fontSize: brand.hook.size * SCALE,
            lineHeight: 1.3,
          }}
        >
          <span
            className="inline whitespace-pre-line px-1.5 py-0.5 [box-decoration-break:clone]"
            style={{ background: c.primary, color: c.text }}
          >
            {brand.hook.lines}
          </span>
        </div>

        <div
          className="absolute inset-x-4 z-10 text-center font-semibold"
          style={{
            top: `${s.height}%`,
            fontFamily: `"${brand.fonts.body.family}", sans-serif`,
            fontSize: s.size * SCALE,
            lineHeight: 1.2,
          }}
        >
          <span
            className="rounded px-2 py-1 [box-decoration-break:clone]"
            style={{ background: s.box ? c.background : 'transparent', color: s.color, textShadow: s.box ? 'none' : '0 1px 3px rgba(0,0,0,.7)' }}
          >
            {parts.map((part, i) =>
              part.toLowerCase() === word.toLowerCase() && word ? (
                <span
                  key={i}
                  style={
                    s.highlightStyle === 'caixa'
                      ? { background: c.highlight, color: c.background, padding: '0 3px', borderRadius: 3 }
                      : s.highlightStyle === 'color'
                        ? { color: c.highlight }
                        : { fontStyle: 'italic', color: c.highlight, fontFamily: 'Georgia, serif' }
                  }
                >
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </span>
        </div>

        <div className={`absolute z-20 ${corner[brand.logo.corner]}`} style={{ width: brand.logo.size * SCALE }}>
          {brand.logo.dataUrl ? (
            <img src={brand.logo.dataUrl} alt="Logo" className="w-full" />
          ) : (
            <div
              className="grid aspect-square w-full place-items-center rounded-full text-[9px] font-bold"
              style={{ background: c.primary, color: c.text }}
            >
              LOGO
            </div>
          )}
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted">Primer segon del reel, a escala 1:4</figcaption>
    </figure>
  )
}
