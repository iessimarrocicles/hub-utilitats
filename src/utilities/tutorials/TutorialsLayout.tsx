import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/tutorials', label: 'Tutorials', end: true },
  { to: '/tutorials/plantilles', label: 'Plantilles' },
  { to: '/tutorials/veus', label: 'Veus' },
]

export function TutorialsLayout() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="display text-5xl md:text-7xl">Videotutorials</h1>
        <p className="mt-2 max-w-[62ch] text-muted">
          Dona una adreça web. Claude Code l’analitza i escriu el guió, el navegador grava cada pas i el vídeo es munta amb veu, zooms i
          motion graphics.
        </p>
        <nav className="-mx-4 mt-6 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Seccions de videotutorials">
          <ul className="flex min-w-max gap-1 border-b border-line">
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `-mb-px block border-b-2 px-3 py-2 text-[15px] ${
                      isActive ? 'border-accent font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'
                    }`
                  }
                >
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
