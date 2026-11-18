import { usePersistent } from '../lib/usePersistent'

export interface ChecklistItem {
  id: string
  text: string
  hint?: string
}

/** Llista de comprovació que recorda el que has marcat. */
export function Checklist({
  storageKey,
  items,
  resettable,
}: {
  storageKey: string
  items: ChecklistItem[]
  resettable?: boolean
}) {
  const [checked, setChecked] = usePersistent<Record<string, boolean>>(storageKey, {})
  const done = items.filter((i) => checked[i.id]).length

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-sm text-muted">
        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <div className="bg-ok transition-[width]" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        <span>
          {done} de {items.length}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-3 py-3">
              <input
                type="checkbox"
                className="mt-1 shrink-0"
                checked={!!checked[item.id]}
                onChange={(e) => setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))}
              />
              <span>
                <span className={checked[item.id] ? 'text-muted line-through' : ''}>{item.text}</span>
                {item.hint && <span className="block text-sm text-muted">{item.hint}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {resettable && done > 0 && (
        <button type="button" onClick={() => setChecked({})} className="mt-2 text-sm font-semibold text-accent hover:underline">
          Desmarcar-ho tot per a la pròxima gravació
        </button>
      )}
    </div>
  )
}
