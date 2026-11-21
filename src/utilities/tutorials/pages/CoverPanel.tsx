import { Thumbnail } from '@remotion/player'
import { Download, ImagePlus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Cover } from '../../../../video/components/Cover'
import { COVER_SECONDS, COVER_STILL_SECONDS, coverMinutes, estimateSeconds, minutesLabel, projectCover } from '../../../../video/lib/cover'
import { FPS, SIZES, toFrames } from '../../../../video/lib/timeline'
import { Button, Field, Notice, Section } from '../../../components/ui'
import { tutorialFileUrl, tutorialsApi } from '../api'
import type { CoverInput, CoverText, TutorialProject } from '../types'

function CoverFrame({ cover, seconds }: { cover: CoverInput; seconds: number }) {
  return <Cover cover={cover} seconds={seconds} />
}

/** Miniatura del vídeo: textos, imatge sense fons i la portada que obri el vídeo. */
export function CoverPanel({ project, busy, onSaved }: { project: TutorialProject; busy: boolean; onSaved: (p: TutorialProject) => void }) {
  const current = useMemo(() => projectCover(project), [project])
  const [text, setText] = useState<CoverText>(current)
  const [working, setWorking] = useState<'' | 'text' | 'image' | 'still'>('')
  const [error, setError] = useState('')
  useEffect(() => setText(current), [current])

  const dirty = text.title !== current.title || text.subtitle !== current.subtitle || text.brand !== current.brand
  const format = project.settings?.format ?? '1080p'
  const size = SIZES[format]
  const seconds = project.final?.duration ?? (project.storyboard ? estimateSeconds(project.storyboard) : 60)
  const preview: CoverInput = {
    ...text,
    image: project.coverImage ? tutorialFileUrl(project.id, project.coverImage.file, project.coverImage.updatedAt) : undefined,
    inVideo: false,
  }

  async function act(kind: typeof working, fn: () => Promise<TutorialProject>) {
    setWorking(kind)
    setError('')
    try {
      onSaved(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking('')
    }
  }

  const still = project.coverStill ?? (project.final ? { file: project.final.thumb, updatedAt: project.final.updatedAt } : undefined)

  return (
    <Section
      title="Miniatura"
      intro="La portada del vídeo amb la plantilla de DOCENTSTIC. Serveix per a pujar-la com a miniatura i, si vols, ix els primers segons del vídeo."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <div className="overflow-hidden rounded-lg border border-line bg-black" style={{ maxWidth: format === 'vertical' ? 340 : '100%' }}>
            <Thumbnail
              component={CoverFrame}
              inputProps={{ cover: preview, seconds }}
              compositionWidth={size.width}
              compositionHeight={size.height}
              durationInFrames={toFrames(COVER_SECONDS)}
              frameToDisplay={toFrames(COVER_STILL_SECONDS)}
              fps={FPS}
              style={{ width: '100%', aspectRatio: `${size.width} / ${size.height}` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Previsualització exacta. Els minuts ({minutesLabel(coverMinutes(seconds)).toLowerCase()}) es calculen
            {project.final ? ' de la durada del vídeo.' : ' a partir de la narració fins que generes el vídeo.'}
          </p>
        </div>

        <div className="space-y-4">
          <Field label="Títol" hint="Curt i gran: el nom de l’eina o del tema.">
            <input value={text.title} onChange={(e) => setText({ ...text, title: e.target.value })} placeholder="LEONARDO.AI" />
          </Field>
          <Field label="Subtítol" hint="Què s’aprén. Si és llarg es parteix sol en dues línies; també pots fer-ho tu amb Intro.">
            <textarea rows={2} value={text.subtitle} onChange={(e) => setText({ ...text, subtitle: e.target.value })} placeholder="Registre i interfície d’usuari" />
          </Field>
          <Field label="Marca">
            <input value={text.brand} onChange={(e) => setText({ ...text, brand: e.target.value })} placeholder="DOCENTSTIC" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant={dirty ? 'primary' : 'ghost'} disabled={!dirty || !!working} onClick={() => act('text', () => tutorialsApi.saveCover(project.id, text))}>
              <Save size={16} /> {working === 'text' ? 'Desant…' : 'Desar els textos'}
            </Button>
            {project.cover && (
              <Button disabled={!!working} onClick={() => act('text', () => tutorialsApi.saveCover(project.id, null))} title="Tornar als textos que va proposar Claude amb el guió">
                <RotateCcw size={16} /> Proposta de Claude
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-line p-3">
            <p className="text-sm font-semibold">Imatge de la dreta</p>
            <p className="mt-1 text-xs text-muted">
              Puja una il·lustració o una foto. El hub li lleva el fons al teu ordinador; si ja és un PNG transparent, la deixa tal qual.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold hover:border-accent ${working ? 'pointer-events-none opacity-50' : ''}`}>
                <ImagePlus size={16} />
                {working === 'image' ? 'Llevant el fons…' : project.coverImage ? 'Canviar la imatge' : 'Pujar una imatge'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void act('image', () => tutorialsApi.uploadCoverImage(project.id, f))
                  }}
                />
              </label>
              {project.coverImage && (
                <Button disabled={!!working} onClick={() => act('image', () => tutorialsApi.removeCoverImage(project.id))}>
                  <Trash2 size={16} /> Llevar-la
                </Button>
              )}
            </div>
            {working === 'image' && <p className="mt-2 text-xs text-muted">La primera vegada descarrega el model per a retallar (uns 180 MB).</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={!!working || busy || dirty}
              onClick={() => act('still', () => tutorialsApi.coverStill(project.id))}
              title={dirty ? 'Desa primer els textos' : undefined}
            >
              <Sparkles size={16} /> {working === 'still' ? 'Generant…' : 'Generar la miniatura'}
            </Button>
            {still && (
              <a href={tutorialFileUrl(project.id, still.file, still.updatedAt)} download={still.file}>
                <Button>
                  <Download size={16} /> Descarregar
                </Button>
              </a>
            )}
          </div>
          {dirty && <p className="text-xs text-muted">Desa els textos perquè la miniatura i el vídeo els usen.</p>}
          {error && <Notice>{error}</Notice>}
        </div>
      </div>
    </Section>
  )
}
