export interface CheckItem {
  id: string
  text: string
  hint?: string
}

export const REQUIREMENTS: CheckItem[] = [
  { id: 'claude-code', text: 'Claude Code a l’ordinador amb un pla de pagament', hint: 'Mac o Windows. No funciona en l’app del mòbil.' },
  { id: 'brut-vertical', text: 'El vídeo en brut, gravat en vertical' },
  { id: 'eines', text: 'ffmpeg, whisper i Pillow instal·lats', hint: 'Claude Code els instal·la la primera vegada i et demana permís.' },
  { id: 'logo-refs', text: 'El logo i dos o tres reels que t’agraden', hint: 'Serveixen per a dissenyar el teu look.' },
  { id: 'habitacio', text: 'Tres segons de l’habitació buida al final de la presa', hint: 'Només si vols desaparéixer del vídeo.' },
  { id: 'node', text: 'Node.js per als efectes', hint: 'Si no el tens, Claude Code el pot instal·lar.' },
]

export const WORKSPACE: CheckItem[] = [
  { id: 'app', text: 'Descarrega l’app d’escriptori de Claude i obri Claude Code', hint: 'Claude Code va amb un pla de pagament.' },
  { id: 'carpetes', text: 'Crea la carpeta Editor amb Brutos, Referencias i Exportados dins', hint: 'Brutos: vídeos tal com els graves. Referencias: reels que t’agraden i el logo. Exportados: on et deixa els vídeos editats.' },
  { id: 'instal', text: 'Obri Claude Code en Editor i demana-li que instal·le les eines', hint: 'Usa el prompt d’instal·lació d’ací baix.' },
  { id: 'skills', text: 'Instal·la les tres skills a ~/.claude/skills', hint: 'editor-reels, look-reels i efectos-reels. Ho tens a la pestanya Skills.' },
]

export const RECORDING: CheckItem[] = [
  { id: 'vertical', text: 'Vertical, amb llum de cara i la cara en el terç de dalt', hint: 'Una finestra davant va bé.' },
  { id: 'repeteix', text: 'Si t’equivoques, no pares: repeteix la frase sencera', hint: 'Claude es queda amb l’última presa bona.' },
  { id: 'silenci', text: 'Deixa un segon de silenci en començar i en acabar' },
  { id: 'buida', text: 'En acabar, ix del pla i grava tres segons l’habitació buida', hint: 'És el fons que usa Claude quan li demanes que desaparegues.' },
]

export const INSTALL_PROMPT =
  'Instal·la’m les eines gratuïtes que necessites per a editar els meus reels: Hyperframes per als gràfics, ffmpeg per als talls i whisper per als subtítols. Demana’m permís abans d’instal·lar cadascuna i digues-me quan estiguen llestes.'

export const SKILLS_INSTALL_PROMPT =
  'Instal·la les skills de Skills-EDITOR-Don-Pablo-AI, que està a la meua carpeta Descàrregues, a ~/.claude/skills.'

export const HYPERFRAMES_COMMAND = "npx skills add heygen-com/hyperframes -g -a claude-code -s '*' -y"

export const LOOK_PROMPT =
  'Dissenya el look dels meus reels amb la skill look-reels. En la carpeta Referencias tens el meu logo i els reels que m’agraden. Dona’m una fitxa amb el meu estil: colors, tipografia, talls, subtítols i música.'

export const MISTAKES: { title: string; text: string }[] = [
  { title: 'Esperar que isca perfecte a la primera.', text: 'Ix bé a força d’explicar-li el que vols, revisar i demanar canvis. Compta amb dos o tres voltes.' },
  { title: 'Parar de gravar quan t’equivoques.', text: 'Repeteix la frase sencera i continua. Claude es queda amb l’última presa bona.' },
  { title: 'Demanar «edita’l bonic» sense haver dissenyat el look.', text: 'Fes abans la fitxa de marca, amb reels que t’agraden de veritat.' },
  { title: 'No apuntar les correccions.', text: 'El que li corregeixes una vegada, a marca.md. Si no, t’ho torna a fer.' },
  { title: 'Demanar que desaparegues sense haver gravat l’habitació buida.', text: 'Sense eixe fons, no hi ha res per a posar darrere.' },
]

export const RULES: string[] = [
  'Grava la frase sencera una altra vegada si t’equivoques: l’edició ix molt més neta.',
  'No el deixes publicar res: et lliura el vídeo i el puges tu.',
  'La revisió del pas 10 de la skill és la que més se salta i la que més errors lleva. No la lleves.',
]
