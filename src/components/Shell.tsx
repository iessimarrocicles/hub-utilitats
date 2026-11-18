import { HardDriveDownload, HardDriveUpload, Menu, Monitor, Moon, Sun, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { downloadText } from '../lib/download'
import { exportAll, importAll } from '../lib/storage'
import { useTheme, type Theme } from '../lib/theme'
import { UTILITIES } from '../utilities/registry'

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'Sistema', icon: Monitor },
  { id: 'light', label: 'Clar', icon: Sun },
  { id: 'dark', label: 'Fosc', icon: Moon },
]

export function Shell() {
  const [theme, setTheme] = useTheme()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-[15px] ${
      isActive ? 'bg-accent-soft font-semibold text-ink' : 'text-muted hover:text-ink'
    }`

  async function onImport(file: File) {
    try {
      const n = importAll(await file.text())
      setMessage(`Còpia restaurada: ${n} conjunts de dades. Recarregant…`)
      setTimeout(() => window.location.reload(), 900)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No s’ha pogut llegir la còpia.')
    }
  }

  const nav = (
    <nav className="flex h-full flex-col gap-6 p-4">
      <NavLink to="/" className="display block text-3xl" onClick={() => setOpen(false)}>
        Hub
      </NavLink>
      <div>
        <p className="mb-2 px-3 text-sm text-muted">Utilitats</p>
        <ul className="space-y-1">
          {UTILITIES.map((u) => (
            <li key={u.id}>
              <NavLink to={u.path} className={linkClass} onClick={() => setOpen(false)}>
                <u.icon size={18} />
                {u.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto space-y-4 text-sm">
        <div>
          <p className="mb-2 px-1 text-muted">Tema</p>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-sunken p-1" role="radiogroup" aria-label="Tema">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => setTheme(t.id)}
                className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 ${
                  theme === t.id ? 'bg-panel font-semibold shadow-sm' : 'text-muted'
                }`}
              >
                <t.icon size={14} />
                <span className="sr-only sm:not-sr-only">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 px-1 text-muted">Les dades es guarden en aquest navegador</p>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sunken"
              onClick={() => downloadText(`hub-copia-${new Date().toISOString().slice(0, 10)}.json`, exportAll(), 'application/json')}
            >
              <HardDriveDownload size={16} /> Fer una còpia
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sunken"
              onClick={() => fileRef.current?.click()}
            >
              <HardDriveUpload size={16} /> Restaurar una còpia
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImport(f)
                e.target.value = ''
              }}
            />
          </div>
          {message && <p className="mt-2 px-1 text-xs text-muted" role="status">{message}</p>}
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper px-4 py-3 md:hidden">
        <NavLink to="/" className="display text-2xl">
          Hub
        </NavLink>
        <button type="button" onClick={() => setOpen(true)} aria-label="Obrir el menú" className="rounded-md p-2 hover:bg-sunken">
          <Menu size={22} />
        </button>
      </header>

      <aside className="sticky top-0 hidden h-screen border-r border-line bg-panel md:block">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-panel">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tancar el menú"
              className="absolute right-3 top-3 rounded-md p-2 hover:bg-sunken"
            >
              <X size={20} />
            </button>
            {nav}
          </div>
        </div>
      )}

      <main key={location.pathname.split('/')[1]} className="min-w-0 px-4 py-6 md:px-10 md:py-10">
        <Outlet />
      </main>
    </div>
  )
}
