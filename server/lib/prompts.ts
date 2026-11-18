/**
 * Instruccions i esquemes per a Claude Code. Les regles venen de les skills
 * editor-reels i look-reels de la guia «Tus reels, editados por Claude».
 */
import type { BrandProfile } from '../../src/utilities/reels/model.ts'
import type { LookResult } from '../../src/utilities/reels/auto/types.ts'
import type { Silence, Word } from './edl.ts'

export type { LookResult }

const hex = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }

export const LOOK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'colors', 'titleFont', 'bodyFont', 'hook', 'subtitles', 'logoCorner', 'transitions', 'sound', 'notes'],
  properties: {
    summary: { type: 'string' },
    colors: {
      type: 'object',
      additionalProperties: false,
      required: ['primary', 'secondary', 'highlight', 'text', 'background'],
      properties: { primary: hex, secondary: hex, highlight: hex, text: hex, background: hex },
    },
    titleFont: { type: 'string' },
    bodyFont: { type: 'string' },
    hook: {
      type: 'object',
      additionalProperties: false,
      required: ['position', 'size'],
      properties: {
        position: { enum: ['dalt', 'darrere-del-cap', 'centre'] },
        size: { type: 'integer', minimum: 60, maximum: 200 },
      },
    },
    subtitles: {
      type: 'object',
      additionalProperties: false,
      required: ['size', 'color', 'highlightStyle', 'box', 'height'],
      properties: {
        size: { type: 'integer', minimum: 36, maximum: 110 },
        color: hex,
        highlightStyle: { enum: ['color', 'caixa', 'cursiva'] },
        box: { type: 'boolean' },
        height: { type: 'integer', minimum: 45, maximum: 85 },
      },
    },
    logoCorner: { enum: ['superior-esquerra', 'superior-dreta', 'inferior-esquerra', 'inferior-dreta'] },
    transitions: { type: 'string' },
    sound: { type: 'string' },
    notes: { type: 'array', items: { type: 'string' } },
  },
}

export function lookPrompt(refs: { name: string; frames: { file: string; t: number }[]; cutsPerSecond: number }[]): string {
  const list = refs
    .map(
      (r, k) =>
        `Referència ${k + 1}: «${r.name}». Canvis de pla per segon: ${r.cutsPerSecond.toFixed(2)}.\n` +
        r.frames.map((f) => `  - ${f.file} (segon ${f.t})`).join('\n'),
    )
    .join('\n')
  return `Ets un dissenyador de reels verticals. Estudia aquests fotogrames de reels de referència que agraden a l'usuari.
Llig cada imatge amb l'eina Read. Les rutes són relatives al directori actual.

${list}

Per a cada referència fixa't en: quina lletra usa (amb o sense serifa, gruixuda o fina), on van els títols (dalt, darrere del cap), com són els subtítols (mida, caixa, paraula destacada), quins colors manen, cada quant canvia el pla i quins gràfics ixen.

Després proposa UN look que combine el que funciona de les referències:
- Agafa l'estil, mai la marca d'un altre: ni logos ni lletres de pagament.
- Lletres: només de Google Fonts, amb el nom exacte (per exemple «Anton», «Inter», «Bebas Neue», «Playfair Display»).
- Colors en hexadecimal. «background» és el color de les caixes de text.
- Mides en píxels sobre un vídeo de 1080×1920. «height» dels subtítols és el % des de dalt (a l'altura del pit, normalment 60-70).
- Regles fixes: res tapa la cara, les lletres no trepitgen el logo i en els 3 primers segons hi ha un sol text gran.
- «transitions»: cada quant canvia el pla i quins efectes sí i quins no, segons els canvis de pla mesurats.
- «sound»: efectes suaus en les accions, mai un colp damunt d'una paraula, sense música llevat que la demane.
- «notes»: observacions concretes de les referències que siguen útils per a editar.
Escriu els textos en valencià.`
}

export const EDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['keep', 'removed', 'subtitles', 'hook', 'summary', 'warnings'],
  properties: {
    keep: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to'],
        properties: { from: { type: 'integer' }, to: { type: 'integer' } },
      },
    },
    removed: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'kind', 'note'],
        properties: {
          from: { type: 'integer' },
          to: { type: 'integer' },
          kind: { enum: ['equivocacio', 'repeticio', 'muletilla', 'altres'] },
          note: { type: 'string' },
        },
      },
    },
    subtitles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'text', 'highlight'],
        properties: {
          from: { type: 'integer' },
          to: { type: 'integer' },
          text: { type: 'string' },
          highlight: { type: 'string' },
        },
      },
    },
    hook: {
      type: 'object',
      additionalProperties: false,
      required: ['line1', 'line2'],
      properties: { line1: { type: 'string' }, line2: { type: 'string' } },
    },
    summary: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
}

export function editPrompt(o: {
  words: Word[]
  silences: Silence[]
  duration: number
  language: string
  brand: BrandProfile
  lookNotes: string[]
  instructions: string
}): string {
  const words = o.words.map((w) => `${w.i}|${w.start.toFixed(2)}|${w.end.toFixed(2)}|${w.text}`).join('\n')
  const silences = o.silences.map((s) => `${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join(', ') || 'cap'
  return `Ets l'editor d'un reel vertical gravat amb el mòbil d'una tirada, amb errors. L'usuari repeteix la frase sencera quan s'equivoca.
Decideix què es queda. No escrius cap ordre ni toques cap fitxer: només tornes la llista d'edició.

Durada: ${o.duration.toFixed(2)} s. Idioma detectat: ${o.language || 'desconegut'}.
Silencis mesurats amb ffmpeg (segons): ${silences}

Transcripció, una paraula per línia: índex|inici|final|paraula
${words}

Regles:
1. De cada frase, queda't amb l'última presa completa. Lleva els arrencades fallides, les frases repetides i les crosses («eh», «este», «bueno», «o siga»…) que no aporten res.
2. «keep» i «removed» són rangs d'índexs de paraula inclusius. Cobreix totes les paraules amb un dels dos. Mai partisques una paraula.
3. Les pauses i l'aire els calcula el programa: no et preocupes pels silencis.
4. Corregeix en els subtítols els noms que la transcripció escriu malament (Claude, ChatGPT, noms de marques i de persones), sense canviar el que es diu.
5. Subtítols: blocs de 3 a 6 paraules, dues línies com a màxim, només amb paraules que es queden. «highlight» és la paraula forta del bloc (el substantiu, la xifra o el verb clau), tal com apareix al teu «text». No poses punt final.
6. Ganxo: dues línies curtes amb el que promet el vídeo, en l'idioma del vídeo. Apareix en els 3 primers segons.
7. «summary»: què has tallat i per què, en valencià i en poques frases. Si no hi ha crosses, digues-ho.
8. «warnings»: el que no has pogut decidir bé (per exemple, una frase dubtosa o paraules que no s'entenen), en valencià.

Estil de la marca: ${o.brand.name}. To: ${o.brand.tone}. Paraula per a comentar: ${o.brand.commentWord}.
${o.lookNotes.length ? `Notes de les referències:\n${o.lookNotes.map((n) => `- ${n}`).join('\n')}\n` : ''}${o.instructions.trim() ? `Instruccions de l'usuari per a aquest vídeo: ${o.instructions.trim()}\n` : ''}`
}
