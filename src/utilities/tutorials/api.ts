import { useEffect, useRef, useState } from 'react'
import { serverUrl } from '../reels/auto/api'
import type { Job } from '../reels/auto/types'
import type { GraphicInfo } from './catalog'
import type { CoverText, GenerateSettings, StyleTemplate, Storyboard, TtsEngineId, TutorialProject, VoiceOptions } from './types'

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
    /* sense JSON */
  }
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error || `El servidor ha respost amb l’error ${res.status}.`)
  return data as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export interface TutorialMeta {
  templates: StyleTemplate[]
  builtinIds: string[]
  graphics: GraphicInfo[]
  engines: Record<TtsEngineId, { ready: boolean; detail: string }>
  engineNames: Record<TtsEngineId, string>
  kokoroVoices: { id: string; name: string }[]
  f5Voices: string[]
  session: boolean
}

export const tutorialsApi = {
  meta: () => request<TutorialMeta>('/api/tutorials/meta'),
  list: () => request<TutorialProject[]>('/api/tutorials'),
  create: (input: { name: string; url: string; brief: string; useSession: boolean; maxMinutes: number }) =>
    request<Job>('/api/tutorials', json('POST', input)),
  get: (id: string) => request<{ project: TutorialProject; job: Job | null }>(`/api/tutorials/${id}`),
  patch: (id: string, change: Partial<Pick<TutorialProject, 'name' | 'brief' | 'useSession' | 'url'>> & { storyboard?: Storyboard; settings?: GenerateSettings }) =>
    request<TutorialProject>(`/api/tutorials/${id}`, json('PATCH', change)),
  remove: (id: string) => request<{ ok: true }>(`/api/tutorials/${id}`, { method: 'DELETE' }),
  script: (id: string, brief: string, maxMinutes: number) => request<Job>(`/api/tutorials/${id}/script`, json('POST', { brief, maxMinutes })),
  validate: (id: string) => request<Job>(`/api/tutorials/${id}/validate`, json('POST', {})),
  voice: (id: string, settings: GenerateSettings) => request<Job>(`/api/tutorials/${id}/voice`, json('POST', settings)),
  generate: (id: string, settings: GenerateSettings) => request<Job>(`/api/tutorials/${id}/generate`, json('POST', settings)),
  job: (id: string) => request<Job>(`/api/jobs/${id}`),
  saveTemplates: (templates: StyleTemplate[]) => request<StyleTemplate[]>('/api/tutorials/templates', json('PUT', { templates })),
  voiceSample: (voice: VoiceOptions, text?: string) => request<{ url: string; duration: number }>('/api/tutorials/voice-sample', json('POST', { voice, text })),
  elevenVoices: () => request<{ id: string; name: string; detail: string }[]>('/api/tutorials/elevenlabs/voices'),
  voicestudioVoices: () => request<{ id: string; name: string }[]>('/api/tutorials/voicestudio/voices'),
  uploadVoice: (name: string, text: string, file: File) => {
    const form = new FormData()
    form.append('name', name)
    form.append('text', text)
    form.append('file', file)
    return request<{ name: string }>('/api/tutorials/voices', { method: 'POST', body: form })
  },
  saveCover: (id: string, cover: CoverText | null) => request<TutorialProject>(`/api/tutorials/${id}/cover`, json('PUT', { cover })),
  uploadCoverImage: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<TutorialProject>(`/api/tutorials/${id}/cover-image`, { method: 'POST', body: form })
  },
  removeCoverImage: (id: string) => request<TutorialProject>(`/api/tutorials/${id}/cover-image`, { method: 'DELETE' }),
  coverStill: (id: string) => request<TutorialProject>(`/api/tutorials/${id}/cover-still`, { method: 'POST' }),
  login: (url: string) => request<{ ok: true }>('/api/tutorials/session', json('POST', { url })),
  logout: () => request<{ ok: true }>('/api/tutorials/session', { method: 'DELETE' }),
}

export function tutorialFileUrl(id: string, file: string, version?: string): string {
  return `${serverUrl()}/files/tutorials/${id}/${file.split('/').map(encodeURIComponent).join('/')}${version ? `?v=${encodeURIComponent(version)}` : ''}`
}

export function serverFileUrl(path: string): string {
  return `${serverUrl()}${path}`
}

/** Segueix un treball fins que acaba. */
export function useTutorialJob(onFinish: (job: Job) => void) {
  const [job, setJob] = useState<Job | null>(null)
  const finish = useRef(onFinish)
  finish.current = onFinish
  useEffect(() => {
    if (!job || job.status !== 'running') return
    const t = setInterval(async () => {
      try {
        const next = await tutorialsApi.job(job.id)
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
