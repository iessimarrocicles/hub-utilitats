import { useMemo } from 'react'
import { AbsoluteFill, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { PER_SCENE_GRAPHICS } from '../../src/utilities/tutorials/catalog.ts'
import type { Box, CaptureEvent, CompositionInput, GraphicId, SceneTiming, StyleTemplate } from '../../src/utilities/tutorials/types.ts'
import { fontFamily } from '../fonts.ts'
import { buildShots, cameraTrack, cameraTransform, cursorAt, project, type CameraState } from '../lib/camera.ts'
import { FPS, VOICE_DELAY } from '../lib/timeline.ts'
import { Backdrop } from './Cards.tsx'

export interface CaptureSegmentProps {
  input: CompositionInput
  captureStart: number
  duration: number
  scenes: SceneTiming[]
  chapterTitle: string
}

/** Graphics actius en una escena: els de l'escena substitueixen els de la plantilla per als que es poden triar per escena. */
export function sceneGraphics(input: CompositionInput, sceneId: string | undefined): Set<GraphicId> {
  const scene = input.storyboard.chapters.flatMap((c) => c.scenes).find((s) => s.id === sceneId)
  const global = input.graphics.filter((g) => !PER_SCENE_GRAPHICS.includes(g))
  const local = scene?.graphics ?? input.graphics.filter((g) => PER_SCENE_GRAPHICS.includes(g))
  return new Set([...global, ...local])
}

/** Requadre on es pinta la pàgina, segons el format i si hi ha marc de navegador. */
export function contentBox(width: number, height: number, frame: boolean) {
  const vertical = height > width
  if (vertical) return { x: 40, y: 330, w: width - 80, h: 1180, bar: frame ? 0 : 0, mode: 'cover' as const }
  if (!frame) return { x: 0, y: 0, w: width, h: height, bar: 0, mode: 'contain' as const }
  const bar = 44
  const w = Math.round(width * 0.855)
  const h = Math.round((w * 9) / 16)
  return { x: Math.round((width - w) / 2), y: Math.round((height - h - bar) / 2) + bar, w, h, bar, mode: 'contain' as const }
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

export function CaptureSegment({ input, captureStart, duration, scenes, chapterTitle }: CaptureSegmentProps) {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const { capture, template: t } = input
  const vertical = height > width
  const tLocal = frame / fps
  const tc = captureStart + tLocal
  const scene = scenes.find((s) => tc >= s.start && tc < s.end) ?? scenes.at(-1)!
  const g = sceneGraphics(input, scene?.sceneId)
  const box = contentBox(width, height, input.graphics.includes('browser-frame'))
  const vp = capture.viewport

  const firstMove = capture.events.find((e) => e.type === 'move')
  const cursorStart = firstMove ? { x: firstMove.x, y: firstMove.y } : { x: vp.width * 0.62, y: vp.height * 0.7 }

  // Pista de càmera de tota la captura, calculada una sola vegada.
  const track = useMemo(() => {
    const zoomScenes = new Set(
      input.storyboard.chapters.flatMap((c) => c.scenes).filter((s) => sceneGraphics(input, s.id).has('zoom')).map((s) => s.id),
    )
    const shots = buildShots(capture.events.filter((e) => zoomScenes.has(e.sceneId)), vp, t.zoom)
    const overview = vertical
      ? (time: number): CameraState => {
          const c = cursorAt(time, capture.events, cursorStart)
          return { cx: c.x, cy: c.y, z: 1 }
        }
      : { cx: vp.width / 2, cy: vp.height / 2, z: 1 }
    return cameraTrack(capture.duration, FPS, shots, overview, vertical ? 3 : 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture, input.graphics, input.storyboard, t.zoom, vertical])

  const cam = track[Math.min(track.length - 1, Math.max(0, Math.round(tc * FPS)))]
  const tr = cameraTransform(cam, vp, box.w, box.h, box.mode)
  const cursor = cursorAt(tc, capture.events, cursorStart)
  const toScreen = (b: Box) => {
    const p = project(b, tr)
    return { ...p, x: p.x + box.x, y: p.y + box.y }
  }
  const cursorScreen = { x: box.x + tr.x + cursor.x * tr.scale, y: box.y + tr.y + cursor.y * tr.scale }

  // Focus de l'escena: a partir de l'última acció, que és quan la caixa és vàlida.
  const sceneEvents = capture.events.filter((e) => e.sceneId === scene.sceneId)
  const lastAction = [...sceneEvents].reverse().find((e) => e.type !== 'move')
  const focusFrom = Math.max(scene.start + 0.6, lastAction ? lastAction.t + lastAction.dur + 0.2 : scene.start + 0.8)
  const focusBox = capture.focus[scene.sceneId]
  const focusP = focusBox ? easeOut((tc - focusFrom) / 0.45) * easeOut((scene.end - 0.15 - tc) / 0.3) : 0
  const sceneData = input.storyboard.chapters.flatMap((c) => c.scenes).find((s) => s.id === scene.sceneId)

  return (
    <AbsoluteFill>
      <Backdrop t={t} />

      {/* Marc i captura */}
      <div
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y - box.bar,
          width: box.w,
          height: box.h + box.bar,
          borderRadius: box.bar || vertical ? t.radius : 0,
          overflow: 'hidden',
          boxShadow: box.bar || vertical ? `0 30px 80px rgba(0,0,0,${t.shadow}), 0 0 0 1px rgba(0,0,0,0.08)` : undefined,
          background: '#fff',
        }}
      >
        {box.bar > 0 && <BrowserBar t={t} url={input.storyboard.startUrl} height={box.bar} />}
        <div style={{ position: 'absolute', left: 0, top: box.bar, width: box.w, height: box.h, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: vp.width,
              height: vp.height,
              transformOrigin: '0 0',
              transform: `translate(${tr.x}px, ${tr.y}px) scale(${tr.scale})`,
            }}
          >
            <OffthreadVideo src={input.captureSrc} muted trimBefore={Math.round(captureStart * fps)} style={{ width: vp.width, height: vp.height }} />
          </div>
        </div>
      </div>

      {/* Damunt de la pàgina, retallat al requadre */}
      <div style={{ position: 'absolute', left: 0, top: 0, width, height, clipPath: `inset(${box.y}px ${width - box.x - box.w}px ${height - box.y - box.h}px ${box.x}px round ${box.bar ? 0 : t.radius}px)` }}>
        {g.has('spotlight') && focusBox && focusP > 0 && <Spotlight b={toScreen(pad(focusBox, 10))} p={focusP} />}
        {g.has('highlight') && focusBox && focusP > 0 && <Highlight b={toScreen(pad(focusBox, 6))} p={focusP} t={t} time={tc} />}
        {g.has('click-ripple') && <Ripples events={sceneEvents} tc={tc} x={cursorScreen.x} y={cursorScreen.y} t={t} />}
        {g.has('cursor') && <Cursor x={cursorScreen.x} y={cursorScreen.y} style={t.cursor} click={cursor.click} z={cam.z} t={t} />}
      </div>

      {g.has('callout') && sceneData?.callout && focusBox && focusP > 0 && (
        <Callout b={toScreen(focusBox)} text={sceneData.callout} p={focusP} t={t} bounds={{ width, height }} />
      )}
      {g.has('keystrokes') && <Keystrokes events={sceneEvents} tc={tc} t={t} y={vertical ? 1560 : height - 230} />}
      {g.has('captions') && <Captions input={input} scene={scene} tc={tc} vertical={vertical} />}
      {g.has('lower-third') && <LowerThird title={chapterTitle} tLocal={tLocal} duration={duration} t={t} vertical={vertical} />}
      {g.has('step-counter') && <StepCounter input={input} sceneId={scene.sceneId} t={t} />}
      {vertical && <VerticalTitle input={input} t={t} />}
    </AbsoluteFill>
  )
}

const pad = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, width: b.width + p * 2, height: b.height + p * 2 })

function BrowserBar({ t, url, height }: { t: StyleTemplate; url: string; height: number }) {
  let host = url
  try {
    host = new URL(url).host
  } catch {
    /* url no vàlida */
  }
  return (
    <div style={{ height, background: '#f1f3f5', borderBottom: '1px solid #e2e5e9', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 9 }}>
      {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
        <div key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c }} />
      ))}
      <div
        style={{
          margin: '0 auto',
          width: '44%',
          height: 28,
          borderRadius: 8,
          background: '#fff',
          border: '1px solid #e2e5e9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fontFamily(t.fonts.body),
          fontSize: 15,
          color: '#64748b',
        }}
      >
        🔒 {host}
      </div>
    </div>
  )
}

function Spotlight({ b, p }: { b: Box; p: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: b.x,
        top: b.y,
        width: b.width,
        height: b.height,
        borderRadius: 14,
        boxShadow: `0 0 0 4000px rgba(8,10,20,${0.55 * p})`,
      }}
    />
  )
}

function Highlight({ b, p, t, time }: { b: Box; p: number; t: StyleTemplate; time: number }) {
  const pulse = 1 + 0.025 * Math.sin(time * 5)
  return (
    <div
      style={{
        position: 'absolute',
        left: b.x,
        top: b.y,
        width: b.width,
        height: b.height,
        borderRadius: 12,
        border: `4px solid ${t.colors.accent}`,
        boxShadow: `0 0 0 6px ${t.colors.accent}33, 0 0 30px ${t.colors.accent}66`,
        opacity: p,
        transform: `scale(${pulse * (0.94 + 0.06 * p)})`,
      }}
    />
  )
}

function Ripples({ events, tc, x, y, t }: { events: CaptureEvent[]; tc: number; x: number; y: number; t: StyleTemplate }) {
  const active = events.filter((e) => e.type === 'click' && tc >= e.t && tc < e.t + 0.6)
  return (
    <>
      {active.map((e, i) => {
        const k = (tc - e.t) / 0.6
        const r = 14 + easeOut(k) * 46
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - r,
              top: y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: `3px solid ${t.colors.accent}`,
              background: `${t.colors.accent}22`,
              opacity: 1 - k,
            }}
          />
        )
      })}
    </>
  )
}

function Cursor({ x, y, style, click, z, t }: { x: number; y: number; style: StyleTemplate['cursor']; click: number; z: number; t: StyleTemplate }) {
  const s = (1 + (z - 1) * 0.35) * (1 - click * 0.18)
  if (style === 'dot' || style === 'ring') {
    const r = 18 * s
    return (
      <div
        style={{
          position: 'absolute',
          left: x - r,
          top: y - r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          background: style === 'dot' ? `${t.colors.accent}cc` : 'transparent',
          border: style === 'ring' ? `3px solid ${t.colors.accent}` : '2px solid #fff',
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
        }}
      />
    )
  }
  return (
    <svg
      width={34 * s}
      height={34 * s}
      viewBox="0 0 24 24"
      style={{ position: 'absolute', left: x - 5 * s, top: y - 3 * s, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))', overflow: 'visible' }}
    >
      <path d="M5 2.5 L5 19.5 L9.4 15.4 L12.3 21.6 L15.3 20.2 L12.4 14.1 L18.4 14.1 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  )
}

function Callout({ b, text, p, t, bounds }: { b: Box; text: string; p: number; t: StyleTemplate; bounds: { width: number; height: number } }) {
  const below = b.y < bounds.height * 0.35
  const w = Math.min(640, 60 + text.length * 19)
  const x = Math.min(bounds.width - w - 40, Math.max(40, b.x + b.width / 2 - w / 2))
  // Ancorada per la vora més pròxima a l'element: mai el tapa, siga d'una o de dues línies.
  const y = below ? b.y + b.height + 22 : b.y - 22
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        translate: below ? '0 0' : '0 -100%',
        padding: '16px 24px',
        borderRadius: 16,
        background: t.colors.accent,
        color: '#fff',
        fontFamily: fontFamily(t.fonts.title),
        fontWeight: 700,
        fontSize: 30,
        textAlign: 'center',
        boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
        opacity: p,
        transform: `translateY(${(1 - p) * (below ? -14 : 14)}px) scale(${0.92 + 0.08 * p})`,
      }}
    >
      {text}
    </div>
  )
}

const KEY_NAMES: Record<string, string> = { Enter: '↵ Intro', Tab: '⇥ Tab', Escape: 'Esc', Backspace: '⌫', ArrowDown: '↓', ArrowUp: '↑', Space: 'Espacio' }

function Keystrokes({ events, tc, t, y }: { events: CaptureEvent[]; tc: number; t: StyleTemplate; y: number }) {
  const e = [...events].reverse().find((ev) => ev.type === 'press' && tc >= ev.t && tc < ev.t + 1.3)
  if (!e) return null
  const k = Math.min(1, (tc - e.t) / 0.15) * Math.min(1, (e.t + 1.3 - tc) / 0.25)
  const keys = (e.value ?? '').split('+').map((p) => KEY_NAMES[p] ?? p)
  return (
    <AbsoluteFill style={{ alignItems: 'center', top: y, height: 90, bottom: 'auto' }}>
      <div style={{ display: 'flex', gap: 12, opacity: k, transform: `translateY(${(1 - k) * 12}px)` }}>
        {keys.map((key) => (
          <div
            key={key}
            style={{
              padding: '12px 22px',
              borderRadius: 12,
              background: 'rgba(15,23,42,0.88)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderBottomWidth: 4,
              color: '#fff',
              fontFamily: fontFamily(t.fonts.body),
              fontWeight: 700,
              fontSize: 30,
            }}
          >
            {key}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

/** Subtítols per blocs curts, amb la paraula que sona ressaltada. */
function Captions({ input, scene, tc, vertical }: { input: CompositionInput; scene: SceneTiming; tc: number; vertical: boolean }) {
  const t = input.template
  const audio = input.audio.find((a) => a.sceneId === scene.sceneId)
  if (!audio) return null
  const local = tc - scene.start - VOICE_DELAY
  if (local < 0 || local > audio.duration + 0.2) return null
  const maxChars = vertical ? 26 : 46
  const chunks: (typeof audio.words)[] = []
  let cur: typeof audio.words = []
  for (const w of audio.words) {
    const len = cur.reduce((n, x) => n + x.w.length + 1, 0)
    if (cur.length && (len + w.w.length > maxChars || /[.!?]$/.test(cur.at(-1)!.w))) {
      chunks.push(cur)
      cur = []
    }
    cur.push(w)
  }
  if (cur.length) chunks.push(cur)
  const chunk = chunks.find((c) => local <= c.at(-1)!.end + 0.25) ?? chunks.at(-1)
  if (!chunk) return null
  const size = vertical ? t.captions.size * 1.15 : t.captions.size
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: vertical ? 250 : t.captions.position === 'bottom' ? 70 : undefined,
        paddingTop: t.captions.position === 'top' ? 70 : undefined,
      }}
    >
      <div
        style={{
          maxWidth: vertical ? 960 : 1500,
          padding: t.captions.box ? '12px 26px' : 0,
          borderRadius: 14,
          background: t.captions.box ? 'rgba(10,12,20,0.78)' : 'transparent',
          textAlign: 'center',
          fontFamily: fontFamily(t.fonts.body),
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.25,
          color: '#fff',
          textShadow: t.captions.box ? 'none' : '0 3px 12px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)',
        }}
      >
        {chunk.map((w, i) => {
          const on = local >= w.start && local < w.end + 0.08
          return (
            <span key={i} style={{ color: on ? t.colors.accent : '#fff', transition: 'none' }}>
              {w.w}
              {i < chunk.length - 1 ? ' ' : ''}
            </span>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function LowerThird({ title, tLocal, duration, t, vertical }: { title: string; tLocal: number; duration: number; t: StyleTemplate; vertical: boolean }) {
  const { fps } = useVideoConfig()
  const show = Math.min(3.4, duration - 0.5)
  if (tLocal > show) return null
  const p = spring({ frame: tLocal * fps, fps, config: { damping: 18 } })
  const out = interpolate(tLocal, [show - 0.35, show], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', left: vertical ? 60 : 110, top: vertical ? 220 : undefined, bottom: vertical ? undefined : 150, opacity: out }}>
      <div style={{ display: 'flex', alignItems: 'stretch', transform: `translateX(${(1 - p) * -80}px)`, opacity: p }}>
        <div style={{ width: 8, background: t.colors.accent, borderRadius: 4 }} />
        <div
          style={{
            marginLeft: 14,
            padding: '14px 26px',
            background: 'rgba(10,12,20,0.82)',
            borderRadius: 10,
            fontFamily: fontFamily(t.fonts.title),
            fontWeight: 700,
            fontSize: 38,
            color: '#fff',
          }}
        >
          {title}
        </div>
      </div>
    </div>
  )
}

function StepCounter({ input, sceneId, t }: { input: CompositionInput; sceneId: string; t: StyleTemplate }) {
  const steps = input.storyboard.chapters.flatMap((c) => c.scenes).filter((s) => s.actions.length > 0)
  const i = steps.findIndex((s) => s.id === sceneId)
  if (i < 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        right: 60,
        top: 36,
        padding: '8px 18px',
        borderRadius: 999,
        background: t.colors.accent,
        color: '#fff',
        fontFamily: fontFamily(t.fonts.body),
        fontWeight: 700,
        fontSize: 24,
        boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
      }}
    >
      Paso {i + 1} de {steps.length}
    </div>
  )
}

function VerticalTitle({ input, t }: { input: CompositionInput; t: StyleTemplate }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: 110,
        fontFamily: fontFamily(t.fonts.title),
        fontWeight: 800,
        fontSize: 58,
        lineHeight: 1.1,
        color: t.colors.text,
      }}
    >
      {input.storyboard.title}
    </div>
  )
}
