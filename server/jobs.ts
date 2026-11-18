import type { Job, JobKind } from '../src/utilities/reels/auto/types.ts'
import { newId } from './store.ts'

const jobs = new Map<string, Job>()

export interface JobContext {
  stage: (text: string, progress?: number | null) => void
  progress: (p: number) => void
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id)
}

/** El treball en marxa d'un projecte, o de l'anàlisi d'estil. */
export function runningJob(projectId?: string, kind?: JobKind): Job | undefined {
  for (const j of jobs.values()) {
    if (j.status !== 'running') continue
    if (projectId && j.projectId === projectId) return j
    if (!projectId && kind && j.kind === kind) return j
  }
  return undefined
}

export function latestJob(projectId: string): Job | undefined {
  return [...jobs.values()].filter((j) => j.projectId === projectId).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

/** Llança una tasca llarga en segon pla i en torna el seguiment de seguida. */
export function startJob(
  kind: JobKind,
  projectId: string | undefined,
  work: (ctx: JobContext) => Promise<void>,
  onError?: (err: Error) => Promise<void>,
): Job {
  const job: Job = {
    id: newId(),
    kind,
    projectId,
    status: 'running',
    stage: 'Començant…',
    progress: null,
    startedAt: new Date().toISOString(),
  }
  jobs.set(job.id, job)
  const ctx: JobContext = {
    stage: (text, progress = null) => {
      job.stage = text
      job.progress = progress
      console.log(`[${kind}${projectId ? ` ${projectId}` : ''}] ${text}`)
    },
    progress: (p) => {
      job.progress = Math.max(0, Math.min(1, p))
    },
  }
  work(ctx)
    .then(() => {
      job.status = 'done'
      job.stage = 'Fet'
      job.progress = 1
    })
    .catch(async (err: Error) => {
      job.status = 'error'
      job.error = err.message
      console.error(`[${kind}] ${err.message}`)
      await onError?.(err).catch(() => undefined)
    })
    .finally(() => {
      job.finishedAt = new Date().toISOString()
    })
  return job
}
