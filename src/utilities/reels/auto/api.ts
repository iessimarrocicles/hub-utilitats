import { useCallback, useEffect, useRef, useState } from 'react'
import { loadValue, saveValue } from '../../../lib/storage'
import type { BrandProfile } from '../model'
import type { EditPlan, Job, Look, Reference, ServerProject } from './types'

const SERVER_KEY = 'hub.reels.server'
export const DEFAULT_SERVER = 'http://localhost:8787'

export function serverUrl(): string {
  return loadValue(SERVER_KEY, DEFAULT_SERVER).replace(/\/+$/, '')
}

export function setServerUrl(url: string): void {
  saveValue(SERVER_KEY, url.trim() || DEFAULT_SERVER)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${serverUrl()}${path}`, init)
  } catch {
    throw new Error('No hi ha connexió amb el servidor local. Comprova que està en marxa.')
  }
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* resposta sense JSON */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error
    throw new Error(msg || `El servidor ha respost amb l’error ${res.status}.`)
  }
  return data as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** Pujada amb progrés (fetch no en dona). */
function upload<T>(path: string, form: FormData, onProgress?: (p: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${serverUrl()}${path}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onerror = () => reject(new Error('No hi ha connexió amb el servidor local. Comprova que està en marxa.'))
    xhr.onload = () => {
      let data: unknown = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        /* sense JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T)
      else reject(new Error((data as { error?: string } | null)?.error || `El servidor ha respost amb l’error ${xhr.status}.`))
    }
    xhr.send(form)
  })
}

export interface Health {
  ok: boolean
  workspace: string
  tools: { ffmpeg: boolean; whisper: boolean; claude: string | false }
}

export const api = {
  // Amb límit: si Chrome espera el permís de xarxa local, la petició no acaba mai sola.
  health: () => request<Health>('/api/health', { signal: AbortSignal.timeout(15_000) }),
  references: () => request<Reference[]>('/api/references'),
  uploadReferences: (files: File[], onProgress?: (p: number) => void) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return upload<Reference[]>('/api/references', form, onProgress)
  },
  deleteReference: (id: string) => request<{ ok: true }>(`/api/references/${id}`, { method: 'DELETE' }),
  look: () => request<Look | null>('/api/look'),
  analyzeLook: () => request<Job>('/api/look/analyze', { method: 'POST' }),
  projects: () => request<ServerProject[]>('/api/projects'),
  createProject: (
    input: { file: File; name: string; language: string; instructions: string },
    onProgress?: (p: number) => void,
  ) => {
    const form = new FormData()
    form.append('name', input.name)
    form.append('language', input.language)
    form.append('instructions', input.instructions)
    form.append('video', input.file)
    return upload<ServerProject>('/api/projects', form, onProgress)
  },
  project: (id: string) => request<{ project: ServerProject; job: Job | null }>(`/api/projects/${id}`),
  patchProject: (id: string, change: { name?: string; instructions?: string; language?: string }) =>
    request<ServerProject>(`/api/projects/${id}`, json('PATCH', change)),
  deleteProject: (id: string) => request<{ ok: true }>(`/api/projects/${id}`, { method: 'DELETE' }),
  savePlan: (id: string, plan: EditPlan) => request<ServerProject>(`/api/projects/${id}/plan`, json('PUT', { plan })),
  autoEdit: (id: string, brand: BrandProfile) => request<Job>(`/api/projects/${id}/auto`, json('POST', { brand })),
  preview: (id: string, brand: BrandProfile) => request<Job>(`/api/projects/${id}/preview`, json('POST', { brand })),
  final: (id: string, brand: BrandProfile) => request<Job>(`/api/projects/${id}/final`, json('POST', { brand })),
  job: (id: string) => request<Job>(`/api/jobs/${id}`),
}

export function projectFileUrl(projectId: string, file: string, version?: string): string {
  return `${serverUrl()}/files/projects/${projectId}/${encodeURIComponent(file)}${version ? `?v=${encodeURIComponent(version)}` : ''}`
}

export function referenceFileUrl(file: string): string {
  return `${serverUrl()}/files/references/${encodeURIComponent(file)}`
}

export function downloadUrl(projectId: string, which: 'final' | 'clean'): string {
  return `${serverUrl()}/api/projects/${projectId}/download/${which}`
}

export type LocalNetworkPermission = 'granted' | 'prompt' | 'denied' | 'unknown'

/** Permís de Chrome perquè una web pública parle amb localhost. */
async function localNetworkPermission(): Promise<LocalNetworkPermission> {
  try {
    const status = await navigator.permissions.query({ name: 'local-network-access' as PermissionName })
    return status.state
  } catch {
    return 'unknown'
  }
}

/** La pàgina s'ha obert des d'Internet (per exemple GitHub Pages) i no des de l'ordinador. */
export const isPublicOrigin = () => !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)

/** Estat del servidor local, consultat cada pocs segons. */
export function useServer() {
  const [health, setHealth] = useState<Health | null>(null)
  const [state, setState] = useState<'checking' | 'online' | 'offline'>('checking')
  const [permission, setPermission] = useState<LocalNetworkPermission>('unknown')

  const check = useCallback(async () => {
    if (isPublicOrigin()) setPermission(await localNetworkPermission())
    try {
      const h = await api.health()
      setHealth(h)
      setState('online')
    } catch {
      setState('offline')
    }
    if (isPublicOrigin()) setPermission(await localNetworkPermission())
  }, [])

  useEffect(() => {
    void check()
    const t = setInterval(() => void check(), state === 'online' ? 30_000 : 4_000)
    return () => clearInterval(t)
  }, [check, state])

  return { health, state, check, permission }
}

/** Segueix un treball fins que acaba. */
export function useJob(onFinish: (job: Job) => void) {
  const [job, setJob] = useState<Job | null>(null)
  const finish = useRef(onFinish)
  finish.current = onFinish

  useEffect(() => {
    if (!job || job.status !== 'running') return
    const t = setInterval(async () => {
      try {
        const next = await api.job(job.id)
        setJob(next)
        if (next.status !== 'running') finish.current(next)
      } catch (e) {
        const failed: Job = { ...job, status: 'error', error: e instanceof Error ? e.message : String(e) }
        setJob(failed)
        finish.current(failed)
      }
    }, 1500)
    return () => clearInterval(t)
  }, [job])

  return [job, setJob] as const
}
