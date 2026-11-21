import type { Page } from 'playwright'
import type { Action, Box, CaptureEvent, CaptureEventType } from '../../src/utilities/tutorials/types.ts'
import { settle } from './analyze.ts'
import { describe, gotoWithRetry, resolve } from './browser.ts'

export interface ActionContext {
  /** Ritme humà (captura) o ràpid (validació en sec). */
  human: boolean
  sceneId: string
  /** Rellotge de la captura en segons. */
  now: () => number
  mouse: { x: number; y: number }
  log: (e: CaptureEvent) => void
}

const TIMEOUT = 8000
const sleep = (page: Page, ms: number) => page.waitForTimeout(Math.max(0, ms))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function record(ctx: ActionContext, type: CaptureEventType, t: number, extra: Partial<CaptureEvent> = {}): void {
  ctx.log({ t, dur: ctx.now() - t, type, x: ctx.mouse.x, y: ctx.mouse.y, sceneId: ctx.sceneId, ...extra })
}

/** Mou el ratolí amb una corba suau, perquè els estats :hover de la pàgina coincidisquen amb el cursor pintat. */
async function moveMouse(page: Page, ctx: ActionContext, x: number, y: number): Promise<void> {
  const from = { ...ctx.mouse }
  const dist = Math.hypot(x - from.x, y - from.y)
  const t0 = ctx.now()
  if (ctx.human && dist > 4) {
    const ms = Math.min(900, 280 + dist * 0.35)
    const steps = Math.max(8, Math.round(ms / 16))
    for (let i = 1; i <= steps; i++) {
      const k = ease(i / steps)
      await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k)
      await sleep(page, ms / steps)
    }
  } else {
    await page.mouse.move(x, y)
  }
  ctx.mouse.x = x
  ctx.mouse.y = y
  if (ctx.human) record(ctx, 'move', t0)
}

async function scrollIntoView(page: Page, ctx: ActionContext, action: Action): Promise<void> {
  const loc = resolve(page, action.target!)
  await loc.waitFor({ state: 'visible', timeout: TIMEOUT })
  if (!ctx.human) return loc.scrollIntoViewIfNeeded({ timeout: TIMEOUT })
  const t0 = ctx.now()
  const moved = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect()
    if (r.top >= 80 && r.bottom <= innerHeight - 80) return false
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return true
  })
  if (moved) {
    await sleep(page, 800)
    record(ctx, 'scroll', t0)
  }
}

async function targetBox(page: Page, action: Action): Promise<Box> {
  const box = await resolve(page, action.target!).boundingBox({ timeout: TIMEOUT })
  if (!box) throw new Error(`L'element ${describe(action.target)} no es veu a la pantalla.`)
  return { x: box.x, y: box.y, width: box.width, height: box.height }
}

/** Punt on clicar: el centre, o una mica a l'esquerra en camps de text llargs. */
function aimPoint(box: Box): { x: number; y: number } {
  const x = box.width > 300 ? box.x + Math.min(box.width * 0.25, 160) : box.x + box.width / 2
  return { x: Math.round(x), y: Math.round(box.y + box.height / 2) }
}

export async function performAction(page: Page, action: Action, ctx: ActionContext): Promise<void> {
  const needsTarget = ['click', 'type', 'hover', 'select'].includes(action.type)
  if (needsTarget && !action.target) throw new Error(`L'acció ${action.type} necessita un element.`)

  switch (action.type) {
    case 'goto': {
      const t0 = ctx.now()
      await gotoWithRetry(page, action.url!)
      await settle(page)
      if (ctx.human) record(ctx, 'navigate', t0, { value: action.url })
      return
    }
    case 'wait':
      return sleep(page, Math.min(10, Number(action.value ?? 1)) * 1000)
    case 'press': {
      const t0 = ctx.now()
      await page.keyboard.press(action.value || 'Enter')
      if (ctx.human) {
        record(ctx, 'press', t0, { value: action.value || 'Enter' })
        await sleep(page, 500)
      }
      return
    }
    case 'scroll': {
      if (action.target) return scrollIntoView(page, ctx, action)
      const t0 = ctx.now()
      const dy = Number(action.value ?? 600) || 600
      await page.evaluate((y) => scrollBy({ top: y, behavior: 'smooth' }), dy)
      await sleep(page, ctx.human ? 900 : 300)
      if (ctx.human) record(ctx, 'scroll', t0, { value: String(dy) })
      return
    }
  }

  await scrollIntoView(page, ctx, action)
  const box = await targetBox(page, action)
  const aim = aimPoint(box)
  await moveMouse(page, ctx, aim.x, aim.y)
  if (ctx.human) await sleep(page, 180)

  const loc = resolve(page, action.target!)
  switch (action.type) {
    case 'hover':
      await loc.hover({ timeout: TIMEOUT })
      if (ctx.human) await sleep(page, 600)
      return
    case 'click': {
      const t0 = ctx.now()
      if (ctx.human) {
        await page.mouse.down()
        await sleep(page, 70)
        await page.mouse.up()
      } else {
        await loc.click({ timeout: TIMEOUT })
      }
      if (ctx.human) record(ctx, 'click', t0, { box })
      await settle(page, ctx.human ? 4000 : 2500)
      return
    }
    case 'select': {
      const t0 = ctx.now()
      await loc.selectOption({ label: action.value ?? '' }, { timeout: TIMEOUT }).catch(() => loc.selectOption(action.value ?? '', { timeout: TIMEOUT }))
      if (ctx.human) record(ctx, 'click', t0, { box, value: action.value })
      return
    }
    case 'type': {
      const text = action.value ?? ''
      if (!ctx.human) {
        await loc.fill(text, { timeout: TIMEOUT })
        return
      }
      const tClick = ctx.now()
      await page.mouse.down()
      await sleep(page, 60)
      await page.mouse.up()
      record(ctx, 'click', tClick, { box })
      await sleep(page, 250)
      // Com fill() a la prova: substitueix el que hi haja (p. ex. un nom proposat per la web).
      const current = await loc.inputValue({ timeout: 1000 }).catch(() => '')
      if (current) {
        await page.keyboard.press('ControlOrMeta+A')
        await sleep(page, 120)
        await page.keyboard.press('Backspace')
        await sleep(page, 200)
      }
      const t0 = ctx.now()
      // Cadència humana: més ràpid dins de les paraules, pauses als espais.
      for (const ch of text) {
        await page.keyboard.type(ch)
        await sleep(page, ch === ' ' ? 110 : 45 + Math.random() * 45)
      }
      record(ctx, 'type', t0, { box, value: text })
      return
    }
  }
}

/** Durada aproximada d'una acció amb ritme humà, per a repartir el temps de cada escena. */
export function estimateSeconds(action: Action): number {
  switch (action.type) {
    case 'goto':
      return 2.5
    case 'wait':
      return Math.min(10, Number(action.value ?? 1))
    case 'type':
      return 1.2 + (action.value?.length ?? 0) * 0.075
    case 'scroll':
      return 1.2
    case 'press':
      return 0.7
    default:
      return 1.4
  }
}
