import { Clapperboard, MonitorPlay, type LucideIcon } from 'lucide-react'

/**
 * Totes les utilitats del hub. Per a afegir-ne una de nova:
 * crea la carpeta a src/utilities/<id>, afig-la ací i registra la ruta a App.tsx.
 */
export interface Utility {
  id: string
  name: string
  description: string
  path: string
  icon: LucideIcon
}

export const UTILITIES: Utility[] = [
  {
    id: 'reels',
    name: 'Edició de reels',
    description: 'Prepara els teus reels per a Claude Code: fitxa de marca, prompts d’edició, revisions i els 29 efectes.',
    path: '/reels',
    icon: Clapperboard,
  },
  {
    id: 'tutorials',
    name: 'Videotutorials',
    description: 'Dona una adreça web i obtín un videotutorial amb guió, veu, zooms i motion graphics.',
    path: '/tutorials',
    icon: MonitorPlay,
  },
]
