import { useCallback, useState } from 'react'
import { LocalStorageRepository, newId } from '../../lib/storage'
import { usePersistent } from '../../lib/usePersistent'
import { createProject, defaultBrand, type BrandProfile, type ReelProject } from './model'

export const projectRepo = new LocalStorageRepository<ReelProject>('hub.reels.projects')

export function useProjects() {
  const [projects, setProjects] = useState<ReelProject[]>(() => projectRepo.list())

  const refresh = useCallback(() => setProjects(projectRepo.list()), [])

  const create = useCallback(
    (input: { name: string; rawFile: string }) => {
      const p = createProject(input)
      projectRepo.save(p)
      refresh()
      return p
    },
    [refresh],
  )

  const duplicate = useCallback(
    (id: string) => {
      const src = projectRepo.get(id)
      if (!src) return
      const now = new Date().toISOString()
      const copy: ReelProject = {
        ...structuredClone(src),
        id: newId(),
        name: `${src.name} (còpia)`,
        steps: { video: false, review: false, phrases: false, effects: false, delivered: false },
        feedback: [],
        createdAt: now,
        updatedAt: now,
      }
      projectRepo.save(copy)
      refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    (id: string) => {
      projectRepo.remove(id)
      refresh()
    },
    [refresh],
  )

  return { projects, create, duplicate, remove }
}

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<ReelProject | undefined>(() => (id ? projectRepo.get(id) : undefined))

  const update = useCallback((change: (draft: ReelProject) => void) => {
    setProject((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      change(next)
      next.updatedAt = new Date().toISOString()
      projectRepo.save(next)
      return next
    })
  }, [])

  return { project, update }
}

/** Completa una fitxa desada amb els valors per defecte que li falten. */
export function completeBrand(stored: Partial<BrandProfile>): BrandProfile {
  const base = defaultBrand()
  return structuredClone({
    ...base,
    ...stored,
    colors: { ...base.colors, ...stored.colors },
    fonts: { ...base.fonts, ...stored.fonts },
    hook: { ...base.hook, ...stored.hook },
    subtitles: { ...base.subtitles, ...stored.subtitles },
    logo: { ...base.logo, ...stored.logo },
    rules: stored.rules ?? base.rules,
  })
}

/** Fitxa de marca persistent. */
export function useBrand() {
  const [stored, setStored] = usePersistent<Partial<BrandProfile>>('hub.reels.brand', defaultBrand())
  const brand = completeBrand(stored)
  const update = useCallback(
    (change: (draft: BrandProfile) => void) => {
      setStored((prev) => {
        const draft = completeBrand(prev)
        change(draft)
        return draft
      })
    },
    [setStored],
  )
  const reset = useCallback(() => setStored(defaultBrand()), [setStored])
  return { brand, update, reset }
}
