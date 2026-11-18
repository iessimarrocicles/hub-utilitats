import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { UTILITIES } from '../utilities/registry'
import { useProjects } from '../utilities/reels/store'
import { TakeBar } from '../utilities/reels/components/TakeBar'

export function Home() {
  const { projects } = useProjects()
  const active = projects.filter((p) => !p.steps.delivered)
  const recent = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="display text-6xl md:text-8xl">Les meues utilitats</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-muted">
        Eines per a la feina de cada dia. Tot funciona en aquest ordinador i les dades es guarden al navegador.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-[2fr_1fr]">
        {UTILITIES.map((u) => (
          <Link
            key={u.id}
            to={u.path}
            className="group rounded-xl border border-line bg-panel p-6 hover:border-accent"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-ink">
                <u.icon size={22} />
              </span>
              <h2 className="headline text-3xl">{u.name}</h2>
            </div>
            <p className="mt-3 max-w-[55ch] text-muted">{u.description}</p>

            {u.id === 'reels' && (
              <div className="mt-6">
                {recent.length === 0 ? (
                  <p className="text-sm text-muted">Encara no tens cap reel. Obri la utilitat per a crear-ne el primer.</p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-muted">
                      {active.length === 1 ? '1 reel en marxa' : `${active.length} reels en marxa`}
                    </p>
                    <ul className="space-y-3">
                      {recent.map((p) => (
                        <li key={p.id}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="font-semibold">{p.name}</span>
                            <span className="text-muted">{p.rawFile}</span>
                          </div>
                          <TakeBar project={p} size="sm" />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </Link>
        ))}

        <div className="flex flex-col justify-center rounded-xl border border-dashed border-line p-6 text-muted">
          <Plus size={22} />
          <p className="mt-2 font-semibold text-ink">La pròxima utilitat</p>
          <p className="mt-1 text-sm">
            Cada eina nova es registra a <code className="font-mono text-xs">src/utilities/registry.ts</code> i apareix ací.
          </p>
        </div>
      </div>
    </div>
  )
}
