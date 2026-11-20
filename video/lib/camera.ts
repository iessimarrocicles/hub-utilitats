import type { Box, CaptureEvent } from '../../src/utilities/tutorials/types.ts'

export interface CameraState {
  /** Centre del que es mira, en píxels CSS del viewport. */
  cx: number
  cy: number
  /** 1 = tota la pàgina dins del requadre. */
  z: number
}

export interface Shot {
  start: number
  end: number
  target: CameraState
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Plans de càmera a partir dels clics i l'escriptura: s'acosta a l'element un poc abans
 * de l'acció i es queda mentre dura. Plans pròxims s'ajunten en un sol moviment.
 */
export function buildShots(events: CaptureEvent[], viewport: { width: number; height: number }, maxZoom: number): Shot[] {
  const raw: Shot[] = []
  for (const e of events) {
    if (!e.box || !['click', 'type'].includes(e.type)) continue
    const b = e.box
    // Que l'element ocupe com a molt la meitat de l'amplada.
    const fit = Math.min((viewport.width * 0.5) / Math.max(b.width, 40), (viewport.height * 0.5) / Math.max(b.height, 30))
    const z = clamp(Math.min(maxZoom, fit), 1, maxZoom)
    if (z < 1.08) continue
    raw.push({
      start: e.t - 0.9,
      end: e.t + e.dur + (e.type === 'type' ? 1.2 : 1.6),
      target: { cx: b.x + b.width / 2, cy: b.y + b.height / 2, z },
    })
  }
  // Ajunta plans que se solapen o queden molt junts: la càmera fa panoràmica en lloc d'allunyar-se i tornar.
  const merged: Shot[] = []
  for (const s of raw.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1)
    if (!last || s.start - last.end >= 1.2) {
      merged.push({ ...s })
      continue
    }
    const same = Math.hypot(s.target.cx - last.target.cx, s.target.cy - last.target.cy) < 40 && Math.abs(s.target.z - last.target.z) < 0.05
    if (same) {
      // Mateix element (clic i després escriure): un sol pla més llarg.
      last.end = Math.max(last.end, s.end)
    } else {
      // Un altre element: el pla següent comença on acaba l'anterior, sense tornar a la vista general.
      const cut = Math.max(last.start + 0.4, Math.min(last.end, s.start + 0.6))
      last.end = cut
      merged.push({ start: cut, end: Math.max(cut + 0.3, s.end), target: s.target })
    }
  }
  return merged
}

/** On vol estar la càmera en l'instant t (sense suavitzar). */
export type Overview = CameraState | ((t: number) => CameraState)

export function targetAt(t: number, shots: Shot[], overview: Overview): CameraState {
  for (const s of shots) if (t >= s.start && t < s.end) return s.target
  return typeof overview === 'function' ? overview(t) : overview
}

/**
 * Recorregut de la càmera fotograma a fotograma amb un filtre de dos pols:
 * acceleració i frenada suaus, sense salts encara que l'objectiu canvie de cop.
 */
export function cameraTrack(duration: number, fps: number, shots: Shot[], overview: Overview, response = 5): CameraState[] {
  const n = Math.ceil(duration * fps) + 1
  const dt = 1 / fps
  const k = 1 - Math.exp(-dt * response)
  const first = targetAt(0, [], overview)
  const a = { ...first }
  const b = { ...first }
  const out: CameraState[] = []
  for (let i = 0; i < n; i++) {
    // Mira un poc endavant: la càmera arriba quan comença l'acció, no després.
    const target = targetAt(i * dt + 0.35, shots, overview)
    a.cx += (target.cx - a.cx) * k
    a.cy += (target.cy - a.cy) * k
    a.z += (target.z - a.z) * k
    b.cx += (a.cx - b.cx) * k
    b.cy += (a.cy - b.cy) * k
    b.z += (a.z - b.z) * k
    out.push({ ...b })
  }
  return out
}

/**
 * Transformació per a pintar la captura dins d'un requadre de boxW×boxH:
 * escala i desplaçament perquè el centre de la càmera quede al mig sense eixir de la pàgina.
 */
export function cameraTransform(
  cam: CameraState,
  viewport: { width: number; height: number },
  boxW: number,
  boxH: number,
  mode: 'contain' | 'cover',
): { scale: number; x: number; y: number } {
  const fit = mode === 'contain' ? Math.min(boxW / viewport.width, boxH / viewport.height) : Math.max(boxW / viewport.width, boxH / viewport.height)
  const scale = fit * cam.z
  const w = viewport.width * scale
  const h = viewport.height * scale
  const x = w <= boxW ? (boxW - w) / 2 : clamp(boxW / 2 - cam.cx * scale, boxW - w, 0)
  const y = h <= boxH ? (boxH - h) / 2 : clamp(boxH / 2 - cam.cy * scale, boxH - h, 0)
  return { scale, x, y }
}

export interface CursorState {
  x: number
  y: number
  /** 0-1: intensitat de l'ona del clic. */
  click: number
  /** Segons des de l'últim clic, o Infinity. */
  sinceClick: number
  visible: boolean
}

/** Posició del cursor pintat. Segueix els moviments gravats amb la mateixa corba que el ratolí real. */
export function cursorAt(t: number, events: CaptureEvent[], start: { x: number; y: number }): CursorState {
  let pos = { ...start }
  let lastClick = -Infinity
  for (const e of events) {
    if (e.t > t) break
    if (e.type === 'move') {
      const from = { ...pos }
      const k = e.dur > 0 ? easeInOut(clamp((t - e.t) / e.dur, 0, 1)) : 1
      pos = { x: from.x + (e.x - from.x) * k, y: from.y + (e.y - from.y) * k }
      if (t < e.t + e.dur) return { ...pos, click: 0, sinceClick: t - lastClick, visible: true }
      pos = { x: e.x, y: e.y }
    } else {
      pos = { x: e.x, y: e.y }
      if (e.type === 'click') lastClick = e.t
    }
  }
  const since = t - lastClick
  return { ...pos, click: since < 0.35 ? 1 - since / 0.35 : 0, sinceClick: since, visible: true }
}

/** La caixa del focus en coordenades de pantalla final, aplicant la càmera. */
export function project(box: Box, tr: { scale: number; x: number; y: number }): Box {
  return { x: tr.x + box.x * tr.scale, y: tr.y + box.y * tr.scale, width: box.width * tr.scale, height: box.height * tr.scale }
}
