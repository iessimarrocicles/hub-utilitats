import { useMemo } from 'react'
import { AbsoluteFill, Html5Audio, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CompositionInput } from '../src/utilities/tutorials/types.ts'
import { CaptureSegment } from './components/CaptureSegment.tsx'
import { ChapterCard, Intro, Outro, Summary } from './components/Cards.tsx'
import { Cover } from './components/Cover.tsx'
import { fontFamily, loadTemplateFonts } from './fonts.ts'
import { buildTimeline, toFrames, type Timeline } from './lib/timeline.ts'

/** El videotutorial complet: peces de pantalla completa, trams de captura, veu i barra de progrés. */
export function Tutorial(input: CompositionInput) {
  const timeline = useMemo(() => buildTimeline(input), [input])
  const t = input.template
  loadTemplateFonts([t.fonts.title, t.fonts.body])
  return (
    <AbsoluteFill style={{ background: t.colors.background }}>
      {timeline.segments.map((s, i) => (
        <Sequence key={i} from={toFrames(s.from)} durationInFrames={Math.max(1, toFrames(s.duration))} premountFor={30}>
          <Transition kind={t.transition} duration={s.duration} first={i === 0}>
            {s.kind === 'cover' && input.cover && <Cover cover={input.cover} seconds={input.cover.seconds ?? timeline.duration} />}
            {s.kind === 'intro' &&
              (input.clips?.intro ? <OffthreadVideo src={input.clips.intro} muted /> : <Intro t={t} board={input.storyboard} duration={s.duration} />)}
            {s.kind === 'chapter-card' && (
              <ChapterCard t={t} index={s.chapterIndex} title={input.storyboard.chapters[s.chapterIndex].title} duration={s.duration} />
            )}
            {s.kind === 'capture' && (
              <CaptureSegment
                input={input}
                captureStart={s.captureStart}
                duration={s.duration}
                scenes={s.scenes}
                chapterTitle={input.storyboard.chapters[s.chapterIndex].title}
              />
            )}
            {s.kind === 'summary' && <Summary t={t} board={input.storyboard} duration={s.duration} />}
            {s.kind === 'outro' &&
              (input.clips?.outro ? <OffthreadVideo src={input.clips.outro} muted /> : <Outro t={t} board={input.storyboard} duration={s.duration} />)}
          </Transition>
        </Sequence>
      ))}

      {timeline.voices.map((v) => (
        <Sequence key={v.sceneId} from={toFrames(v.at)} durationInFrames={Math.max(1, toFrames(v.duration) + 6)}>
          <Html5Audio src={v.src} />
        </Sequence>
      ))}

      {input.graphics.includes('progress') && <Progress timeline={timeline} input={input} />}
    </AbsoluteFill>
  )
}

/** Entrada de cada tram segons la transició de la plantilla. */
function Transition({ kind, duration, first, children }: { kind: string; duration: number; first: boolean; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()
  const d = Math.round(0.4 * fps)
  const p = first ? 1 : interpolate(frame, [0, d], [0, 1], { extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3) })
  const out = interpolate(frame, [toFrames(duration) - Math.round(0.2 * fps), toFrames(duration)], [1, 0.0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  let style: React.CSSProperties = { opacity: Math.min(p, Math.max(out, 0.0)) }
  if (kind === 'slide') style = { ...style, transform: `translateX(${(1 - p) * width * 0.06}px)` }
  if (kind === 'zoom') style = { ...style, transform: `scale(${1.04 - 0.04 * p})` }
  if (kind === 'wipe') style = { opacity: Math.max(out, 0), clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>
}

function Progress({ timeline, input }: { timeline: Timeline; input: CompositionInput }) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const t = input.template
  const now = frame / fps
  const total = timeline.duration
  const vertical = height > width
  const inCapture = timeline.segments.some((s) => s.kind === 'capture' && now >= s.from && now < s.from + s.duration)
  if (!inCapture) return null
  const current = timeline.chapters.find((c) => now >= c.from && now < c.to)
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: vertical ? 10 : 8, display: 'flex', gap: 4, background: 'rgba(0,0,0,0.15)' }}>
      {timeline.chapters.map((c, i) => {
        const w = ((c.to - c.from) / total) * 100
        const fill = Math.min(1, Math.max(0, (now - c.from) / (c.to - c.from)))
        return (
          <div key={i} style={{ width: `${w}%`, height: '100%', background: 'rgba(255,255,255,0.25)', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, background: t.colors.accent }} />
          </div>
        )
      })}
      {current && !vertical && (
        <div
          style={{
            position: 'absolute',
            right: 24,
            bottom: 16,
            fontFamily: fontFamily(t.fonts.body),
            fontSize: 18,
            fontWeight: 600,
            color: t.colors.text,
            opacity: 0.75,
          }}
        >
          {current.title}
        </div>
      )}
    </div>
  )
}
