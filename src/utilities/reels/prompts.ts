import { getEffect } from './data/effects'
import { getPhrase } from './data/phrases'
import type { BrandProfile, ReelProject } from './model'

/** Converteix «12» en «0:12» i «75» en «1:15». Deixa «1:05» o text lliure com està. */
export function normalizeTime(input: string): string {
  const t = input.trim()
  if (!t) return ''
  if (/^\d+$/.test(t)) {
    const total = Number(t)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return t
}

export function cleanFileName(rawFile: string): string {
  const base = rawFile.trim().replace(/\.[^./\\]+$/, '')
  return `${base || 'video'}-limpio.mp4`
}

function fileOf(project: ReelProject): string {
  return project.rawFile || 'EL_MEU_VIDEO.MOV'
}

export function buildEditPrompt(project: ReelProject): string {
  return [
    `Edita ${fileOf(project)}, que està a la carpeta Brutos, amb la skill editor-reels.`,
    'Abans de muntar, ensenya’m el storyboard.',
    'Abans d’exportar, la llista de talls i el full de fotogrames.',
    'Deixa el resultat a la carpeta Exportados.',
  ].join(' ')
}

export function buildFeedbackPrompt(project: ReelProject): string {
  const pending = project.feedback.filter((f) => !f.resolved && f.text.trim())
  if (pending.length === 0) return ''
  const lines = pending.map((f) => {
    const time = normalizeTime(f.time)
    return time ? `- ${time}: ${f.text.trim()}` : `- ${f.text.trim()}`
  })
  const toBrand = pending.filter((f) => f.toBrand)
  const out = [`He revisat ${fileOf(project)} editat. Canvia això:`, ...lines]
  if (toBrand.length > 0) {
    out.push(
      '',
      'Apunta a marca.md aquestes correccions perquè no es tornen a repetir:',
      ...toBrand.map((f) => `- ${f.text.trim()}`),
    )
  }
  out.push('', 'Quan acabes, torna a fer la revisió obligatòria del pas 10 de la skill.')
  return out.join('\n')
}

export function buildPhrasesPrompt(project: ReelProject): string {
  const items = project.phrases
    .map((p) => {
      const phrase = getPhrase(p.phraseId)
      if (!phrase) return null
      const time = normalizeTime(p.time)
      return time ? `- «${phrase.ask}» a partir del ${time}.` : `- «${phrase.ask}».`
    })
    .filter((x): x is string => x !== null)
  if (items.length === 0) return ''
  const needsRoom = project.phrases.some((p) => getPhrase(p.phraseId)?.needsEmptyRoom)
  const out = [`Amb la skill editor-reels, aplica aquests canvis a ${fileOf(project)}:`, ...items]
  if (needsRoom && !project.emptyRoom) {
    out.push('', 'Atenció: no vaig gravar els tres segons d’habitació buida. Digues-me si es pot fer igualment.')
  }
  out.push('Ensenya’m un abans i un després de cada canvi de color.')
  return out.join('\n')
}

export function buildEffectsPrompt(project: ReelProject): string {
  const items = project.effects
    .map((pick) => {
      const effect = getEffect(pick.effectId)
      if (!effect) return null
      const anchor = pick.anchor.trim()
      const where = !anchor
        ? 'on millor quede'
        : /^\d|^\d+:\d{2}$/.test(anchor)
          ? `en el ${normalizeTime(anchor)}`
          : `quan dic «${anchor}»`
      return `- ${effect.id}. ${effect.name}, ${where}: ${effect.phrase}`
    })
    .filter((x): x is string => x !== null)
  if (items.length === 0) return ''
  const out = [
    `Posa-li efectes al meu vídeo amb la skill efectos-reels. Usa la còpia neta ${cleanFileName(fileOf(project))}.`,
    ...items,
    '',
    'Abans d’exportar, ensenya’m un fotograma de cada efecte.',
  ]
  const needsRoom = project.effects.some((p) => getEffect(p.effectId)?.needsEmptyRoom)
  if (needsRoom && !project.emptyRoom) {
    out.push('Atenció: no vaig gravar els tres segons d’habitació buida que necessita «Que desaparega».')
  }
  return out.join('\n')
}

const POSITION_LABEL: Record<BrandProfile['hook']['position'], string> = {
  dalt: 'a dalt, damunt del cap',
  'darrere-del-cap': 'darrere del cap',
  centre: 'al centre',
}

const HIGHLIGHT_LABEL: Record<BrandProfile['subtitles']['highlightStyle'], string> = {
  color: 'canvi de color',
  caixa: 'caixa de color darrere',
  cursiva: 'en cursiva',
}

export function buildMarcaMd(brand: BrandProfile): string {
  const c = brand.colors
  const s = brand.subtitles
  return `# Marca: ${brand.name}

Tono: ${brand.tone}
Paraula per a comentar: ${brand.commentWord}

## Colors
- Principal: ${c.primary}
- Secundari: ${c.secondary}
- Destacat: ${c.highlight}
- Text: ${c.text}
- Fons de caixes: ${c.background}

## Lletres
- Títols: ${brand.fonts.title.family} (${brand.fonts.title.file})
- Text i subtítols: ${brand.fonts.body.family} (${brand.fonts.body.file})
- Només lletres gratuïtes (Google Fonts), descarregades a la carpeta indicada.

## Títol del ganxo
- Lletra: ${brand.fonts.title.family}, ${brand.hook.size} px sobre 1080×1920
- Colors: text ${c.text} sobre caixa ${c.primary}
- Lloc: ${POSITION_LABEL[brand.hook.position]}
- Dues línies amb el que promet el vídeo, només en els 3 primers segons.
- La crida a l’acció va en la mateixa caixa, mentre dic «${brand.commentWord}».

## Subtítols
- Lletra: ${brand.fonts.body.family}, ${s.size} px
- Color: ${s.color}${s.box ? `, amb caixa ${c.background}` : ', sense caixa'}
- Paraula destacada: ${HIGHLIGHT_LABEL[s.highlightStyle]} (${c.highlight})
- Altura: ${s.height}% des de dalt (a l’altura del pit)
- De 3 a 6 paraules per bloc, dues línies com a màxim.

## Logo
- Cantonada: ${brand.logo.corner}
- Mida: ${brand.logo.size} px d’ample

## Transicions
${brand.transitions}

## So
${brand.sound}

## Regles fixes
${brand.rules.map((r) => `- ${r}`).join('\n')}
`
}
