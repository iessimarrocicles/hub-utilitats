import { Search } from 'lucide-react'
import { useState } from 'react'
import { CopyButton } from '../../../components/ui'
import { EFFECTS } from '../data/effects'

type Filter = 'tots' | 'retall' | 'efectes' | 'canvis'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'tots', label: 'Tots' },
  { id: 'efectes', label: 'Del vídeo dels 20 efectes' },
  { id: 'canvis', label: 'Del vídeo dels 10 canvis' },
  { id: 'retall', label: 'Depenen del retall' },
]

export function EffectsPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('tots')
  const q = query.trim().toLowerCase()

  const list = EFFECTS.filter((e) => {
    if (filter === 'retall' && !e.needsCutout) return false
    if ((filter === 'efectes' || filter === 'canvis') && e.origin !== filter) return false
    return !q || `${e.name} ${e.description} ${e.phrase}`.toLowerCase().includes(q)
  })

  return (
    <div>
      <p className="max-w-[65ch] text-muted">
        Els 29 efectes de la skill efectos-reels, fets amb Hyperframes. Demana’ls amb la frase i la paraula on els vols. Per a
        afegir-los a un reel concret, obri el reel i ves al pas Efectes.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca: zoom, subtítols, logos…"
            className="!pl-9"
            aria-label="Busca un efecte"
          />
        </div>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Filtre">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                filter === f.id ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-panel hover:border-accent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted" role="status">
        {list.length === EFFECTS.length ? `${list.length} efectes` : `${list.length} de ${EFFECTS.length} efectes`}
      </p>

      {list.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line p-6 text-center text-muted">
          Cap efecte coincideix. Prova amb una altra paraula o lleva el filtre.
        </p>
      ) : (
        <ol className="mt-3 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <li key={e.id} className="flex flex-col bg-panel p-4">
              <div className="flex items-baseline gap-3">
                <span className="display text-3xl text-accent">{e.id}</span>
                <h3 className="headline text-xl">{e.name}</h3>
              </div>
              <p className="mt-2 text-sm text-muted">{e.description}</p>
              {e.tip && <p className="mt-1 text-sm">{e.tip}</p>}
              <p className="mt-3 flex-1 text-[15px]">«{e.phrase}»</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 text-xs">
                  {e.needsCutout && <span className="rounded bg-sunken px-1.5 py-0.5">Depén del retall</span>}
                  {e.needsEmptyRoom && <span className="rounded bg-warn-bg px-1.5 py-0.5 text-warn-ink">Habitació buida</span>}
                </div>
                <CopyButton text={e.phrase} label="Copiar la frase" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
