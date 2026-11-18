import { useEffect } from 'react'
import { usePersistent } from './usePersistent'

export type Theme = 'system' | 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = usePersistent<Theme>('hub.theme', 'system')
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])
  return [theme, setTheme] as const
}
