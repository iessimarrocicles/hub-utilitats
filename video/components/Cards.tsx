import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { StyleTemplate, Storyboard } from '../../src/utilities/tutorials/types.ts'
import { fontFamily } from '../fonts.ts'

/** Fons de la plantilla: degradat amb dues taques de llum que es mouen a poc a poc. */
export function Backdrop({ t }: { t: StyleTemplate }) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const a = frame / 240
  const blob = (x: number, y: number, r: number, color: string, o: number) => (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        opacity: o,
      }}
    />
  )
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${t.colors.background} 0%, ${t.colors.background2} 100%)`, overflow: 'hidden' }}>
      {blob(width * (0.2 + 0.05 * Math.sin(a)), height * (0.25 + 0.05 * Math.cos(a * 0.8)), width * 0.35, t.colors.accent, 0.18)}
      {blob(width * (0.85 + 0.04 * Math.cos(a * 0.7)), height * (0.8 + 0.05 * Math.sin(a)), width * 0.3, t.colors.accent, 0.12)}
    </AbsoluteFill>
  )
}

function useIn(delay: number, damping = 18) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } })
}

/** Fosa d'entrada i eixida d'una peça. */
export function useFade(duration: number) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const d = Math.round(0.35 * fps)
  const total = Math.round(duration * fps)
  return interpolate(frame, [0, d, total - d, total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}

function Words({ text, t, size, delay, weight = 800 }: { text: string; t: StyleTemplate; size: number; delay: number; weight?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${size * 0.28}px` }}>
      {text.split(/\s+/).map((w, i) => {
        const p = spring({ frame: frame - delay - i * 3, fps, config: { damping: 16, mass: 0.6 } })
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontFamily: fontFamily(t.fonts.title),
              fontWeight: weight,
              fontSize: size,
              lineHeight: 1.1,
              color: t.colors.text,
              transform: `translateY(${(1 - p) * size * 0.6}px)`,
              opacity: p,
              letterSpacing: '-0.02em',
            }}
          >
            {w}
          </span>
        )
      })}
    </div>
  )
}

export function Intro({ t, board, duration }: { t: StyleTemplate; board: Storyboard; duration: number }) {
  const { width, height } = useVideoConfig()
  const vertical = height > width
  const fade = useFade(duration)
  const line = useIn(10)
  const sub = useIn(28)
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Backdrop t={t} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: vertical ? 80 : 160, textAlign: 'center' }}>
        {t.logo && <Img src={t.logo} style={{ height: 70, marginBottom: 40, opacity: sub }} />}
        <div
          style={{
            fontFamily: fontFamily(t.fonts.body),
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: t.colors.accent,
            marginBottom: 28,
            opacity: line,
          }}
        >
          Tutorial
        </div>
        <Words text={board.title} t={t} size={vertical ? 84 : 96} delay={6} />
        <div style={{ width: interpolate(line, [0, 1], [0, 220]), height: 6, borderRadius: 3, background: t.colors.accent, margin: '40px 0' }} />
        <div
          style={{
            fontFamily: fontFamily(t.fonts.body),
            fontSize: vertical ? 38 : 36,
            lineHeight: 1.4,
            color: t.colors.muted,
            maxWidth: 1200,
            // Com a molt tres línies: un resum llarg no ha de tapar el títol.
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            opacity: sub,
            transform: `translateY(${(1 - sub) * 20}px)`,
          }}
        >
          {board.summary}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

export function ChapterCard({ t, index, title, duration }: { t: StyleTemplate; index: number; title: string; duration: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fade = useFade(duration)
  const num = useIn(0, 14)
  const wipe = interpolate(frame, [0, 0.6 * fps], [0, 1], { extrapolateRight: 'clamp', easing: Easing.bezier(0.65, 0, 0.35, 1) })
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Backdrop t={t} />
      <AbsoluteFill style={{ background: t.colors.accent, clipPath: `inset(0 ${100 - wipe * 100}% 0 0)`, opacity: 0.08 }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 120, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: fontFamily(t.fonts.title),
            fontWeight: 800,
            fontSize: 200,
            lineHeight: 1,
            color: t.colors.accent,
            transform: `scale(${0.6 + num * 0.4})`,
            opacity: num,
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </div>
        <div style={{ height: 30 }} />
        <Words text={title} t={t} size={72} delay={8} weight={700} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

export function Summary({ t, board, duration }: { t: StyleTemplate; board: Storyboard; duration: number }) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const vertical = height > width
  const fade = useFade(duration)
  const head = useIn(0)
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Backdrop t={t} />
      <AbsoluteFill style={{ justifyContent: 'center', padding: vertical ? '0 80px' : '0 220px' }}>
        <div
          style={{
            fontFamily: fontFamily(t.fonts.title),
            fontWeight: 800,
            fontSize: 72,
            color: t.colors.text,
            marginBottom: 50,
            opacity: head,
            transform: `translateX(${(1 - head) * -40}px)`,
          }}
        >
          Lo que has aprendido
        </div>
        {board.takeaways.map((k, i) => {
          const p = spring({ frame: frame - 14 - i * 12, fps, config: { damping: 16 } })
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 30, opacity: p, transform: `translateX(${(1 - p) * 60}px)` }}>
              <div
                style={{
                  flex: '0 0 auto',
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: t.colors.accent,
                  color: t.colors.background,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: fontFamily(t.fonts.title),
                  fontWeight: 800,
                  fontSize: 30,
                }}
              >
                ✓
              </div>
              <div style={{ fontFamily: fontFamily(t.fonts.body), fontSize: vertical ? 40 : 42, lineHeight: 1.3, color: t.colors.text }}>{k}</div>
            </div>
          )
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

export function Outro({ t, board, duration }: { t: StyleTemplate; board: Storyboard; duration: number }) {
  const fade = useFade(duration)
  const p = useIn(4)
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Backdrop t={t} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 100 }}>
        {t.logo && <Img src={t.logo} style={{ height: 90, marginBottom: 40, opacity: p }} />}
        <Words text="¡Gracias por ver el tutorial!" t={t} size={88} delay={0} />
        <div style={{ fontFamily: fontFamily(t.fonts.body), fontSize: 34, color: t.colors.muted, marginTop: 36, opacity: p }}>{board.title}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
