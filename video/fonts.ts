// Lletres empaquetades amb el projecte (Fontsource): el render no depén de la xarxa.
import '@fontsource/anton/latin-400.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import '@fontsource/merriweather/latin-400.css'
import '@fontsource/merriweather/latin-700.css'
import '@fontsource/merriweather/latin-900.css'
import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-700.css'
import '@fontsource/montserrat/latin-800.css'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-700.css'
import '@fontsource/source-sans-3/latin-800.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-700.css'
import { continueRender, delayRender } from 'remotion'

const WEIGHTS = ['400', '700', '800']
const loading = new Set<string>()

/**
 * Les @font-face només es descarreguen quan s'usen. Remotion espera que estiguen
 * llestes abans de fer la captura del fotograma, perquè no isca cap fotograma amb la lletra del sistema.
 */
export function loadTemplateFonts(names: string[]): void {
  if (typeof document === 'undefined') return
  for (const name of names) {
    if (loading.has(name)) continue
    loading.add(name)
    const handle = delayRender(`Carregant la lletra ${name}`)
    Promise.all(WEIGHTS.map((w) => document.fonts.load(`${w} 32px "${name}"`)))
      .catch(() => undefined)
      .finally(() => continueRender(handle))
  }
}

export function fontFamily(name: string): string {
  return `"${name}", system-ui, sans-serif`
}
