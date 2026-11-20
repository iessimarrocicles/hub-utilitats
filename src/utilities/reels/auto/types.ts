/** Tipus compartits entre el servidor local (server/) i la interfície. */

import type { TutorialJobKind } from '../../tutorials/types'

export type RemovedKind = 'equivocacio' | 'repeticio' | 'muletilla' | 'silenci' | 'altres'
export type SegmentKind = 'contingut' | RemovedKind

export interface Segment {
  id: string
  /** Segons en el vídeo original. */
  start: number
  end: number
  keep: boolean
  kind: SegmentKind
  text: string
  note?: string
}

export interface Subtitle {
  id: string
  start: number
  end: number
  text: string
  highlight: string
}

export interface EditPlan {
  segments: Segment[]
  subtitles: Subtitle[]
  hook: { line1: string; line2: string }
  summary: string
  warnings: string[]
}

export interface LookResult {
  summary: string
  colors: { primary: string; secondary: string; highlight: string; text: string; background: string }
  titleFont: string
  bodyFont: string
  hook: { position: 'dalt' | 'darrere-del-cap' | 'centre'; size: number }
  subtitles: { size: number; color: string; highlightStyle: 'color' | 'caixa' | 'cursiva'; box: boolean; height: number }
  logoCorner: 'superior-esquerra' | 'superior-dreta' | 'inferior-esquerra' | 'inferior-dreta'
  transitions: string
  sound: string
  notes: string[]
}

export interface Look extends LookResult {
  analyzedAt: string
  references: string[]
}

export interface Reference {
  id: string
  name: string
  file: string
  thumb: string
  duration: number
  addedAt: string
}

export interface Word {
  i: number
  text: string
  start: number
  end: number
}

export type ProjectStatus = 'nou' | 'processant' | 'proposta' | 'final' | 'error'

export interface ServerProject {
  id: string
  name: string
  originalName: string
  /** Nom del fitxer en brut dins de la carpeta del projecte. */
  rawFile: string
  language: string
  instructions: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  media?: { duration: number; width: number; height: number; hdr: boolean }
  transcript?: { language: string; words: Word[] }
  plan?: EditPlan
  preview?: { file: string; updatedAt: string; duration: number }
  final?: { file: string; clean: string; updatedAt: string; duration: number; lufs: number | null; truePeak: number | null }
  lastError?: string
  /** Avisos de la cadena (lletres que no s'han trobat, etc.). */
  notices?: string[]
}

export type JobKind = 'look' | 'auto' | 'preview' | 'final' | TutorialJobKind

export interface Job {
  id: string
  kind: JobKind
  projectId?: string
  status: 'running' | 'done' | 'error'
  stage: string
  /** 0-1, o null si no se sap. */
  progress: number | null
  startedAt: string
  finishedAt?: string
  error?: string
}
