import type { GraphicId, StyleTemplate } from './types'

export interface GraphicInfo {
  id: GraphicId
  name: string
  description: string
  /** On es pinta: damunt de la captura, o com a peça de pantalla completa. */
  layer: 'captura' | 'pantalla'
  /** Es pot activar o desactivar escena a escena. */
  perScene: boolean
}

/** Catàleg de motion graphics. L'ordre és el de la interfície. */
export const GRAPHICS: GraphicInfo[] = [
  { id: 'intro', name: 'Intro', description: 'Títol animat i resum del tutorial.', layer: 'pantalla', perScene: false },
  { id: 'chapter-card', name: 'Targeta de capítol', description: 'Número i títol del capítol a pantalla completa.', layer: 'pantalla', perScene: false },
  { id: 'summary', name: 'Resum final', description: 'Les idees clau en punts animats.', layer: 'pantalla', perScene: false },
  { id: 'outro', name: 'Tancament', description: 'Agraïment, títol i logotip.', layer: 'pantalla', perScene: false },
  { id: 'browser-frame', name: 'Marc de navegador', description: 'La pàgina dins d’una finestra amb ombra sobre un fons de la plantilla.', layer: 'captura', perScene: false },
  { id: 'zoom', name: 'Zoom automàtic', description: 'La càmera s’acosta a cada clic i a cada camp on s’escriu.', layer: 'captura', perScene: true },
  { id: 'cursor', name: 'Cursor suau', description: 'Cursor gran i nítid amb moviments corbats.', layer: 'captura', perScene: false },
  { id: 'click-ripple', name: 'Ona de clic', description: 'Un cercle que s’expandeix en cada clic.', layer: 'captura', perScene: true },
  { id: 'spotlight', name: 'Focus', description: 'Enfosqueix la resta de la pàgina al voltant de l’element important.', layer: 'captura', perScene: true },
  { id: 'highlight', name: 'Ressaltat', description: 'Un contorn que batega al voltant de l’element.', layer: 'captura', perScene: true },
  { id: 'callout', name: 'Bafarada', description: 'Un rètol curt al costat de l’element.', layer: 'captura', perScene: true },
  { id: 'keystrokes', name: 'Tecles', description: 'Mostra les tecles que es premen (Intro, Ctrl+S…).', layer: 'captura', perScene: true },
  { id: 'captions', name: 'Subtítols', description: 'Subtítols sincronitzats paraula a paraula.', layer: 'captura', perScene: false },
  { id: 'lower-third', name: 'Rètol inferior', description: 'Títol del capítol a la part de baix quan comença.', layer: 'captura', perScene: false },
  { id: 'step-counter', name: 'Comptador de passos', description: '«Pas 3 de 7» a la cantonada.', layer: 'captura', perScene: false },
  { id: 'progress', name: 'Barra de progrés', description: 'Barra amb els capítols al peu del vídeo.', layer: 'captura', perScene: false },
]

export const PER_SCENE_GRAPHICS = GRAPHICS.filter((g) => g.perScene).map((g) => g.id)

const ALL_CAPTURE: GraphicId[] = ['browser-frame', 'zoom', 'cursor', 'click-ripple', 'highlight', 'callout', 'keystrokes', 'captions']

/** Plantilles de sèrie. L'usuari en pot duplicar i modificar. */
export const BUILTIN_TEMPLATES: StyleTemplate[] = [
  {
    id: 'minimal-clar',
    name: 'Minimal clar',
    description: 'Net i lluminós, com la documentació d’un producte. Funciona amb qualsevol web.',
    colors: { background: '#eef1f6', background2: '#dfe6f1', accent: '#2563eb', text: '#0f172a', surface: '#ffffff', muted: '#64748b' },
    fonts: { title: 'Inter', body: 'Inter' },
    radius: 18,
    shadow: 0.35,
    cursor: 'mac',
    captions: { size: 40, position: 'bottom', box: true },
    transition: 'fade',
    zoom: 1.7,
    graphics: ['intro', 'chapter-card', 'summary', 'outro', ...ALL_CAPTURE, 'progress'],
    format: '1080p',
    voice: { engine: 'kokoro', voice: 'ef_dora', speed: 1 },
    hyperframes: true,
  },
  {
    id: 'tech-fosc',
    name: 'Tech fosc',
    description: 'Fons fosc amb degradat i accent neó suau. Per a eines de desenvolupament i apps tècniques.',
    colors: { background: '#0b1020', background2: '#1b1446', accent: '#22d3ee', text: '#e2e8f0', surface: '#111827', muted: '#94a3b8' },
    fonts: { title: 'Space Grotesk', body: 'Inter' },
    radius: 14,
    shadow: 0.7,
    cursor: 'ring',
    captions: { size: 38, position: 'bottom', box: true },
    transition: 'zoom',
    zoom: 1.8,
    graphics: ['intro', 'chapter-card', 'summary', 'outro', ...ALL_CAPTURE, 'spotlight', 'step-counter', 'progress'],
    format: '1080p',
    voice: { engine: 'kokoro', voice: 'em_alex', speed: 1 },
    hyperframes: true,
  },
  {
    id: 'docent',
    name: 'Docent / IES',
    description: 'Sobri i molt llegible: subtítols grans, ritme pausat i comptador de passos. Per a l’alumnat.',
    colors: { background: '#f7f3ea', background2: '#efe6d2', accent: '#b45309', text: '#1f2937', surface: '#ffffff', muted: '#6b7280' },
    fonts: { title: 'Merriweather', body: 'Source Sans 3' },
    radius: 12,
    shadow: 0.25,
    cursor: 'mac',
    captions: { size: 46, position: 'bottom', box: true },
    transition: 'slide',
    zoom: 1.6,
    graphics: ['intro', 'chapter-card', 'summary', 'outro', ...ALL_CAPTURE, 'step-counter', 'lower-third', 'progress'],
    format: '1080p',
    voice: { engine: 'kokoro', voice: 'ef_dora', speed: 0.95 },
    hyperframes: true,
  },
  {
    id: 'corporatiu',
    name: 'Corporatiu',
    description: 'Elegant i contingut, amb el logotip i els colors de la marca. Per a presentacions formals.',
    colors: { background: '#0f2a43', background2: '#123a5c', accent: '#f59e0b', text: '#f8fafc', surface: '#ffffff', muted: '#cbd5e1' },
    fonts: { title: 'Montserrat', body: 'Inter' },
    radius: 10,
    shadow: 0.5,
    cursor: 'mac',
    captions: { size: 36, position: 'bottom', box: true },
    transition: 'wipe',
    zoom: 1.6,
    graphics: ['intro', 'chapter-card', 'summary', 'outro', ...ALL_CAPTURE, 'lower-third', 'progress'],
    format: '1080p',
    voice: { engine: 'kokoro', voice: 'em_santa', speed: 1 },
    hyperframes: true,
  },
  {
    id: 'dinamic-xarxes',
    name: 'Dinàmic xarxes',
    description: 'Vertical 9:16, zoom marcat i subtítols grans. Per a reels i shorts.',
    colors: { background: '#111111', background2: '#3b0764', accent: '#facc15', text: '#ffffff', surface: '#1f1f1f', muted: '#a3a3a3' },
    fonts: { title: 'Poppins', body: 'Poppins' },
    radius: 26,
    shadow: 0.6,
    cursor: 'dot',
    captions: { size: 58, position: 'bottom', box: false },
    transition: 'zoom',
    zoom: 2.2,
    graphics: ['intro', 'outro', 'zoom', 'cursor', 'click-ripple', 'highlight', 'callout', 'keystrokes', 'captions', 'progress'],
    format: 'vertical',
    voice: { engine: 'kokoro', voice: 'em_alex', speed: 1.05 },
  },
]

export const FONT_FAMILIES = ['Inter', 'Space Grotesk', 'Merriweather', 'Source Sans 3', 'Montserrat', 'Poppins'] as const
