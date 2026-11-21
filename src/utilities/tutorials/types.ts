/** Tipus compartits entre el servidor (server/tutorials), la interfície i la composició (video/). */

/** Com trobar un element. Per ordre de preferència: testId, role+name, label, placeholder, text, css. */
export interface Locator {
  testId?: string
  role?: string
  name?: string
  label?: string
  placeholder?: string
  text?: string
  css?: string
}

export type ActionType = 'goto' | 'click' | 'type' | 'hover' | 'scroll' | 'select' | 'press' | 'wait'

export interface Action {
  type: ActionType
  target?: Locator
  /** Text a escriure, opció a triar, tecla a prémer o segons d'espera. */
  value?: string
  /** Només per a goto. */
  url?: string
}

export interface Scene {
  id: string
  /** Text que es llegirà en veu alta (castellà). */
  narration: string
  actions: Action[]
  /** Element on cal posar el focus visual (zoom, ressaltat, bafarada). */
  focus?: Locator
  /** Text curt per a la bafarada, si n'hi ha. */
  callout?: string
  /** Motion graphics d'aquesta escena (ids del catàleg). Buit = els de la plantilla. */
  graphics?: GraphicId[]
}

export interface Chapter {
  id: string
  title: string
  scenes: Scene[]
}

/** Textos de la miniatura (portada). Els proposa Claude i es poden editar. */
export interface CoverText {
  /** Títol curt i gran, per exemple el nom de l'eina («LEONARDO.AI»). */
  title: string
  /** Què es fa en el vídeo («REGISTRE I INTERFÍCIE D'USUARI»). */
  subtitle: string
  /** Marca de la cantonada inferior («DOCENTSTIC»). */
  brand: string
}

export interface Storyboard {
  title: string
  summary: string
  startUrl: string
  /** Punts clau per a la peça de resum final. */
  takeaways: string[]
  chapters: Chapter[]
  cover?: CoverText
}

// --- Anàlisi de la pàgina ---------------------------------------------------

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface PageElement {
  ref: string
  tag: string
  role: string
  name: string
  locator: Locator
  box: Box
  /** Està dins de la finestra visible sense fer scroll. */
  inViewport: boolean
}

export interface PageAnalysis {
  url: string
  title: string
  description: string
  headings: string[]
  elements: PageElement[]
  /** Fitxers de captura (relatius a la carpeta analysis/). */
  screenshots: string[]
  links: { text: string; href: string }[]
  analyzedAt: string
}

// --- Veu ----------------------------------------------------------------------

export type TtsEngineId = 'kokoro' | 'f5' | 'elevenlabs' | 'voicestudio'

export const TTS_ENGINES: TtsEngineId[] = ['kokoro', 'f5', 'elevenlabs', 'voicestudio']

export interface VoiceOptions {
  engine: TtsEngineId
  /** Kokoro: ef_dora, em_alex, em_santa. ElevenLabs: voice_id. F5: nom de la mostra. VoiceStudio: id del perfil de veu. */
  voice: string
  /** 0.8 – 1.2 */
  speed: number
}

export interface TimedWord {
  w: string
  start: number
  end: number
}

export interface SceneAudio {
  sceneId: string
  file: string
  duration: number
  words: TimedWord[]
  hash: string
}

// --- Captura ------------------------------------------------------------------

export type CaptureEventType = 'move' | 'click' | 'type' | 'press' | 'scroll' | 'navigate'

export interface CaptureEvent {
  /** Segons des de l'inici de la captura. */
  t: number
  /** Durada de l'acció (moviment del ratolí, escriptura…). */
  dur: number
  type: CaptureEventType
  /** Posició del ratolí en píxels CSS del viewport. */
  x: number
  y: number
  box?: Box
  value?: string
  sceneId: string
}

export interface SceneTiming {
  sceneId: string
  chapterId: string
  start: number
  end: number
}

export interface CaptureResult {
  file: string
  width: number
  height: number
  /** Mida del viewport en píxels CSS. */
  viewport: { width: number; height: number }
  fps: number
  duration: number
  events: CaptureEvent[]
  scenes: SceneTiming[]
  /** Caixa de l'element de focus de cada escena, si s'ha trobat. */
  focus: Record<string, Box | undefined>
}

// --- Plantilles i motion graphics ---------------------------------------------

export type GraphicId =
  | 'zoom'
  | 'cursor'
  | 'click-ripple'
  | 'spotlight'
  | 'callout'
  | 'highlight'
  | 'keystrokes'
  | 'step-counter'
  | 'progress'
  | 'captions'
  | 'lower-third'
  | 'browser-frame'
  | 'intro'
  | 'chapter-card'
  | 'summary'
  | 'outro'

export type VideoFormat = '1080p' | '4k' | 'vertical'

export interface StyleTemplate {
  id: string
  name: string
  description: string
  colors: { background: string; background2: string; accent: string; text: string; surface: string; muted: string }
  fonts: { title: string; body: string }
  radius: number
  /** Ombra del marc del navegador (0-1). */
  shadow: number
  cursor: 'mac' | 'dot' | 'ring'
  captions: { size: number; position: 'bottom' | 'top'; box: boolean }
  transition: 'fade' | 'slide' | 'zoom' | 'wipe'
  /** Zoom màxim de la càmera en els clics. */
  zoom: number
  graphics: GraphicId[]
  format: VideoFormat
  voice: VoiceOptions
  /** Logotip opcional (data URI). */
  logo?: string
  /** Peces de pantalla completa amb HyperFrames (si no, les fa Remotion). */
  hyperframes?: boolean
}

// --- Projecte -----------------------------------------------------------------

export type TutorialStatus = 'nou' | 'analitzant' | 'guio' | 'generant' | 'final' | 'error'

export interface GenerateSettings {
  templateId: string
  format: VideoFormat
  voice: VoiceOptions
  graphics: GraphicId[]
  /** Mostra la miniatura els primers segons del vídeo. Per defecte, sí. */
  coverInVideo?: boolean
}

export interface TutorialProject {
  id: string
  name: string
  url: string
  /** Indicacions de l'usuari per al guió (públic, què vol explicar…). */
  brief: string
  status: TutorialStatus
  createdAt: string
  updatedAt: string
  /** Es fa servir la sessió desada (pàgines amb inici de sessió). */
  useSession: boolean
  analysis?: PageAnalysis
  storyboard?: Storyboard
  /** Errors de la validació en sec, per escena. */
  validation?: { sceneId: string; error: string }[]
  settings?: GenerateSettings
  audio?: SceneAudio[]
  capture?: CaptureResult
  final?: { file: string; srt: string; vtt: string; thumb: string; duration: number; lufs: number | null; updatedAt: string }
  /** Textos de la miniatura editats per l'usuari. Si no n'hi ha, s'usa la proposta del guió. */
  cover?: CoverText
  /** Imatge de la miniatura, ja sense fons (relativa a la carpeta del tutorial). */
  coverImage?: { file: string; updatedAt: string }
  /** Última miniatura generada a part del vídeo. */
  coverStill?: { file: string; updatedAt: string }
  lastError?: string
  notices?: string[]
}

export type TutorialJobKind = 'tut-script' | 'tut-voice' | 'tut-generate'

/**
 * Tot el que necessita la composició per a pintar el vídeo.
 * És un àlies de tipus (no una interfície) perquè Remotion demana props assignables a Record<string, unknown>.
 */
export type CompositionInput = {
  storyboard: Storyboard
  capture: CaptureResult
  /** URL del vídeo capturat (servidor local o file://). */
  captureSrc: string
  audio: (SceneAudio & { src: string })[]
  template: StyleTemplate
  graphics: GraphicId[]
  format: VideoFormat
  /** Clips de pantalla completa fets amb HyperFrames, si n'hi ha. */
  clips?: { intro?: string; outro?: string }
  /** Miniatura: textos, imatge sense fons i si ix a l'inici del vídeo. */
  cover?: CoverInput
}

/** Dades de la composició «Cover» (la miniatura com a imatge fixa). */
export type CoverStillInput = {
  cover: CoverInput
  format: VideoFormat
  /** Durada del vídeo, per a «X MINUTS». */
  seconds: number
}

export type CoverInput = CoverText & {
  /** URL de la imatge sense fons, si n'hi ha. */
  image?: string
  /** La miniatura ocupa els primers segons del vídeo. */
  inVideo: boolean
  /** Durada del vídeo per a «X MINUTS». Si falta, es calcula de la línia de temps. */
  seconds?: number
}
