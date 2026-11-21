import type { CompositionInput, GraphicId, SceneTiming, VideoFormat } from '../../src/utilities/tutorials/types.ts'
import { COVER_SECONDS } from './cover.ts'

export const FPS = 60

export const SIZES: Record<VideoFormat, { width: number; height: number; scale: number }> = {
  // Es compon a 1920×1080 i es renderitza amb scale 2 per al 4K: la captura ja és 3840×2160.
  '1080p': { width: 1920, height: 1080, scale: 1 },
  '4k': { width: 1920, height: 1080, scale: 2 },
  vertical: { width: 1080, height: 1920, scale: 1 },
}

export const DURATIONS = { intro: 4.2, chapterCard: 2.4, summary: 6.5, outro: 4.2, transition: 0.4 }
/** Retard de la veu respecte a l'inici de l'escena gravada. */
export const VOICE_DELAY = 0.15

export type Segment =
  | { kind: 'cover'; from: number; duration: number }
  | { kind: 'intro'; from: number; duration: number }
  | { kind: 'chapter-card'; from: number; duration: number; chapterIndex: number }
  | { kind: 'capture'; from: number; duration: number; chapterIndex: number; captureStart: number; scenes: SceneTiming[] }
  | { kind: 'summary'; from: number; duration: number }
  | { kind: 'outro'; from: number; duration: number }

export interface VoiceClip {
  sceneId: string
  src: string
  /** Segon del vídeo final on comença. */
  at: number
  duration: number
}

export interface Timeline {
  segments: Segment[]
  voices: VoiceClip[]
  duration: number
  /** Segon del vídeo final on comença cada escena. */
  sceneStart: Record<string, number>
  chapters: { title: string; from: number; to: number }[]
}

const has = (g: GraphicId[], id: GraphicId) => g.includes(id)

export function buildTimeline(input: Pick<CompositionInput, 'storyboard' | 'capture' | 'audio' | 'graphics' | 'cover'>): Timeline {
  const { storyboard, capture, audio, graphics } = input
  const segments: Segment[] = []
  const voices: VoiceClip[] = []
  const sceneStart: Record<string, number> = {}
  const chapters: Timeline['chapters'] = []
  const audioBy = new Map(audio.map((a) => [a.sceneId, a]))
  let t = 0

  // La miniatura obri el vídeo, abans de la intro.
  if (input.cover?.inVideo) {
    segments.push({ kind: 'cover', from: t, duration: COVER_SECONDS })
    t += COVER_SECONDS
  }

  if (has(graphics, 'intro')) {
    segments.push({ kind: 'intro', from: t, duration: DURATIONS.intro })
    t += DURATIONS.intro
  }

  storyboard.chapters.forEach((chapter, chapterIndex) => {
    const scenes = capture.scenes.filter((s) => s.chapterId === chapter.id)
    if (scenes.length === 0) return
    const chapterFrom = t
    if (has(graphics, 'chapter-card') && storyboard.chapters.length > 1) {
      segments.push({ kind: 'chapter-card', from: t, duration: DURATIONS.chapterCard, chapterIndex })
      t += DURATIONS.chapterCard
    }
    // El tram comença on comença la primera escena del capítol (el principi de la captura és l'obertura de la pàgina).
    const captureStart = scenes[0].start
    const captureEnd = scenes[scenes.length - 1].end
    const duration = captureEnd - captureStart
    segments.push({ kind: 'capture', from: t, duration, chapterIndex, captureStart, scenes })
    for (const s of scenes) {
      const at = t + (s.start - captureStart)
      sceneStart[s.sceneId] = at
      const a = audioBy.get(s.sceneId)
      if (a) voices.push({ sceneId: s.sceneId, src: a.src, at: at + VOICE_DELAY, duration: a.duration })
    }
    t += duration
    chapters.push({ title: chapter.title, from: chapterFrom, to: t })
  })

  if (has(graphics, 'summary') && storyboard.takeaways.length > 0) {
    segments.push({ kind: 'summary', from: t, duration: DURATIONS.summary })
    t += DURATIONS.summary
  }
  if (has(graphics, 'outro')) {
    segments.push({ kind: 'outro', from: t, duration: DURATIONS.outro })
    t += DURATIONS.outro
  }
  return { segments, voices, duration: t, sceneStart, chapters }
}

export const toFrames = (s: number) => Math.round(s * FPS)
