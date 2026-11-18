import { useCallback, useState } from 'react'
import { loadValue, saveValue } from './storage'

/** Estat de React que es desa sol a localStorage. */
export function usePersistent<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => loadValue(key, fallback))
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        saveValue(key, resolved)
        return resolved
      })
    },
    [key],
  )
  return [value, update] as const
}
