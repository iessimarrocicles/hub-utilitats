import { newId } from '../../lib/storage'

export type StepId = 'video' | 'review' | 'phrases' | 'effects' | 'delivered'

export const STEPS: { id: StepId; label: string; short: string }[] = [
  { id: 'video', label: 'Passa-li el vídeo', short: 'Edició' },
  { id: 'review', label: 'Revisa i demana canvis', short: 'Revisió' },
  { id: 'phrases', label: 'Canvia amb una frase', short: 'Frases' },
  { id: 'effects', label: 'Efectes', short: 'Efectes' },
  { id: 'delivered', label: 'Publicat', short: 'Publicat' },
]

export interface Feedback {
  id: string
  time: string
  text: string
  resolved: boolean
  /** Si s'ha d'apuntar a marca.md perquè no es repetisca. */
  toBrand: boolean
}

export interface PhrasePick {
  id: string
  phraseId: string
  time: string
}

export interface EffectPick {
  id: string
  effectId: number
  /** Paraula o segon on va l'efecte. */
  anchor: string
}

export interface ReelProject {
  id: string
  name: string
  rawFile: string
  notes: string
  /** S'han gravat els tres segons d'habitació buida al final. */
  emptyRoom: boolean
  steps: Record<StepId, boolean>
  feedback: Feedback[]
  phrases: PhrasePick[]
  effects: EffectPick[]
  createdAt: string
  updatedAt: string
}

export function createProject(input: { name: string; rawFile: string }): ReelProject {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: input.name.trim() || 'Reel sense títol',
    rawFile: input.rawFile.trim(),
    notes: '',
    emptyRoom: false,
    steps: { video: false, review: false, phrases: false, effects: false, delivered: false },
    feedback: [],
    phrases: [],
    effects: [],
    createdAt: now,
    updatedAt: now,
  }
}

export type Corner = 'superior-esquerra' | 'superior-dreta' | 'inferior-esquerra' | 'inferior-dreta'
export type HighlightStyle = 'color' | 'caixa' | 'cursiva'
export type HookPosition = 'dalt' | 'darrere-del-cap' | 'centre'

export interface BrandProfile {
  name: string
  tone: string
  commentWord: string
  colors: { primary: string; secondary: string; highlight: string; text: string; background: string }
  fonts: {
    title: { family: string; file: string }
    body: { family: string; file: string }
  }
  hook: { size: number; position: HookPosition; lines: string }
  subtitles: {
    size: number
    color: string
    highlightStyle: HighlightStyle
    /** Altura del subtítol en % des de dalt del vídeo. */
    height: number
    box: boolean
    sample: string
    highlightWord: string
  }
  logo: { corner: Corner; size: number; dataUrl: string }
  transitions: string
  sound: string
  rules: string[]
}

export function defaultBrand(): BrandProfile {
  return {
    name: 'La meua marca',
    tone: 'Directe, de tu, sense floritures.',
    commentWord: 'REEL',
    colors: {
      primary: '#C21F1A',
      secondary: '#1B2340',
      highlight: '#FFC93C',
      text: '#FFFFFF',
      background: '#111111',
    },
    fonts: {
      title: { family: 'Anton', file: 'fonts/Anton-Regular.ttf' },
      body: { family: 'Inter', file: 'fonts/Inter-Variable.ttf' },
    },
    hook: { size: 120, position: 'dalt', lines: 'Els teus reels,\neditats per Claude' },
    subtitles: {
      size: 64,
      color: '#FFFFFF',
      highlightStyle: 'caixa',
      height: 64,
      box: true,
      sample: 'colors molt més càlids',
      highlightWord: 'càlids',
    },
    logo: { corner: 'superior-esquerra', size: 90, dataUrl: '' },
    transitions: 'Canvi de pla cada 3-4 segons. Talls secs i zoom suau. Res de transicions vistoses.',
    sound: 'Efectes suaus en les accions, mai un colp damunt d’una paraula. Sense música llevat que la demane.',
    rules: [
      'Res tapa la cara.',
      'Les lletres no trepitgen el logo.',
      'En els 3 primers segons, un sol text gran.',
    ],
  }
}
