import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CoverInput } from '../../src/utilities/tutorials/types.ts'
import { fontFamily, loadTemplateFonts } from '../fonts.ts'
import { balanceLines, COVER_COLORS as C, COVER_FONT, coverMinutes, fitSize, minutesLabel } from '../lib/cover.ts'

/**
 * Miniatura de DOCENTSTIC (Plantilla.png): fons gris, títol blanc, subtítol roig,
 * botó de play, pinzellada amb els minuts i, a la dreta, una imatge sense fons.
 * La mateixa peça fa la portada (imatge fixa) i els primers segons del vídeo.
 */
export function Cover({ cover, seconds }: { cover: CoverInput; seconds: number }) {
  loadTemplateFonts([COVER_FONT])
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const vertical = height > width
  // Tot es dissenya sobre 1920 d'ample (o 1080 en vertical) i s'escala.
  const k = width / (vertical ? 1080 : 1920)
  const enter = (delay: number, damping = 16) => spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } })

  const title = cover.title.trim().toUpperCase()
  const subtitle = balanceLines(cover.subtitle.toUpperCase())
  const textWidth = (vertical ? 940 : 960) * k
  const titleSize = fitSize(title, textWidth, 160 * k, 80 * k)
  const subSize = fitSize(subtitle, textWidth, (subtitle.includes('\n') ? 96 : 121) * k, 56 * k)
  const minutes = minutesLabel(coverMinutes(seconds))

  const pTitle = enter(2)
  const pSub = enter(8)
  const pPlay = enter(14, 11)
  const pBrush = interpolate(frame, [18, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pImage = enter(4, 20)
  const shadow = `0 ${6 * k}px ${26 * k}px rgba(0,0,0,0.5)`
  const font = fontFamily(COVER_FONT)

  // Posicions (en píxels finals).
  const left = (vertical ? 70 : 105) * k
  const titleTop = (vertical ? 150 : 118) * k
  const play = vertical ? { x: 300 * k, y: 1010 * k, r: 125 * k } : { x: 505 * k, y: 738 * k, r: 129 * k }
  const brush = { w: 570 * k, h: 112 * k, x: play.x - 285 * k, y: play.y + play.r + 20 * k }

  return (
    <AbsoluteFill style={{ background: C.background, overflow: 'hidden' }}>
      {cover.image && (
        <Img
          src={cover.image}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: vertical ? '100%' : '62%',
            height: vertical ? '58%' : '100%',
            objectFit: 'contain',
            objectPosition: vertical ? 'center bottom' : 'right bottom',
            opacity: pImage,
            transform: `translateX(${(1 - pImage) * 80 * k}px)`,
            filter: `drop-shadow(0 ${10 * k}px ${30 * k}px rgba(0,0,0,0.35))`,
          }}
        />
      )}

      <div style={{ position: 'absolute', left, top: titleTop, maxWidth: textWidth }}>
        <div
          style={{
            fontFamily: font,
            fontSize: titleSize,
            lineHeight: 1.04,
            color: C.title,
            textShadow: shadow,
            whiteSpace: 'nowrap',
            opacity: pTitle,
            transform: `translateX(${(1 - pTitle) * -60 * k}px)`,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              marginTop: 30 * k,
              fontFamily: font,
              fontSize: subSize,
              lineHeight: 1.08,
              color: C.subtitle,
              textShadow: shadow,
              whiteSpace: 'pre',
              opacity: pSub,
              transform: `translateX(${(1 - pSub) * -60 * k}px)`,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      <PlayButton x={play.x} y={play.y} r={play.r} scale={pPlay} />
      <Brush {...brush} progress={pBrush} k={k} label={minutes} font={font} />

      <div
        style={{
          position: 'absolute',
          left: 30 * k,
          bottom: 16 * k,
          fontFamily: font,
          fontSize: 33 * k,
          color: C.title,
          textShadow: shadow,
          opacity: pSub,
        }}
      >
        {cover.brand.toUpperCase()}
      </div>
    </AbsoluteFill>
  )
}

function PlayButton({ x, y, r, scale }: { x: number; y: number; r: number; scale: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `linear-gradient(140deg, ${C.playFrom} 0%, ${C.playTo} 100%)`,
        boxShadow: `0 ${r * 0.08}px ${r * 0.35}px rgba(0,0,0,0.35)`,
        transform: `scale(${scale})`,
      }}
    >
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        {/* Triangle blanc amb les puntes arredonides, desplaçat a la dreta com en la plantilla. */}
        <path d="M43 30 Q43 25 47.5 27.6 L74 43.6 Q78.5 46.3 78.5 50 Q78.5 53.7 74 56.4 L47.5 72.4 Q43 75 43 70 Z" fill="#fff" />
      </svg>
    </div>
  )
}

/** Pinzellada negra feta a mà: dues passades amb vores irregulars. */
function Brush({
  x,
  y,
  w,
  h,
  progress,
  k,
  label,
  font,
}: {
  x: number
  y: number
  w: number
  h: number
  progress: number
  k: number
  label: string
  font: string
}) {
  const stroke = (seed: number, top: number, bottom: number, from: number, to: number) => {
    const rnd = (i: number) => {
      const v = Math.sin(seed * 97.3 + i * 12.9898) * 43758.5453
      return v - Math.floor(v)
    }
    const steps = 46
    const pts: string[] = []
    for (let i = 0; i <= steps; i++) pts.push(`${from + ((to - from) * i) / steps},${top + rnd(i) * 5 - 2.5}`)
    pts.push(`${to + rnd(99) * 3},${(top + bottom) / 2}`)
    for (let i = steps; i >= 0; i--) pts.push(`${from + ((to - from) * i) / steps},${bottom + rnd(i + 50) * 5 - 2.5}`)
    pts.push(`${from - rnd(98) * 4},${(top + bottom) / 2}`)
    return pts.join(' ')
  }
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}>
      <svg viewBox="0 0 200 40" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <polygon points={stroke(1, 2, 24, 4, 128)} fill={C.brush} />
        <polygon points={stroke(2, 9, 38, 10, 196)} fill={C.brush} />
        {/* Fils de la pinzellada a les vores. */}
        {[6, 13, 30, 34].map((yy, i) => (
          <line key={i} x1={2 + i * 3} y1={yy} x2={60 + i * 25} y2={yy + (i % 2 ? 0.6 : -0.6)} stroke={C.brush} strokeWidth={0.7} opacity={0.8} />
        ))}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 0,
          fontFamily: font,
          fontSize: 62 * k,
          fontStyle: 'italic',
          letterSpacing: '0.01em',
          color: C.minutes,
        }}
      >
        {label}
      </div>
    </div>
  )
}
