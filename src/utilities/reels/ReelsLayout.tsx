import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/reels', label: 'Reels', end: true },
  { to: '/reels/preparacio', label: 'Preparació' },
  { to: '/reels/marca', label: 'Marca' },
  { to: '/reels/skills', label: 'Skills' },
  { to: '/reels/efectes', label: 'Efectes' },
  { to: '/reels/regles', label: 'Errors i regles' },
]

export function ReelsLayout() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="display text-5xl md:text-7xl">Edició de reels</h1>
        <p className="mt-2 max-w-[62ch] text-muted">
          Graves amb el mòbil, Claude Code edita. Ací prepares el que li demanes i portes el compte de cada reel.
        </p>
        <nav className="-mx-4 mt-6 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Seccions de reels">
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
