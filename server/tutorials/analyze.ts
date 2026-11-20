import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright'
import type { PageAnalysis, PageElement } from '../../src/utilities/tutorials/types.ts'
import { gotoWithRetry, launch } from './browser.ts'

const MAX_ELEMENTS = 160

/** Espera que la pàgina estiga quieta, sense bloquejar-se en webs amb connexions obertes. */
export async function settle(page: Page, timeoutMs = 8000): Promise<void> {
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {})
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await page.waitForTimeout(400)
}

/** Llig els elements interactius amb un localitzador estable per a cadascun. */
export async function readElements(page: Page): Promise<PageElement[]> {
  return page.evaluate((max) => {
    const SELECTOR = [
      'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
      '[role=button]', '[role=link]', '[role=tab]', '[role=menuitem]', '[role=checkbox]',
      '[role=switch]', '[role=combobox]', '[role=option]', '[contenteditable=true]',
    ].join(',')
    const implicitRole = (el: Element): string => {
      const tag = el.tagName.toLowerCase()
      const type = (el.getAttribute('type') ?? '').toLowerCase()
      if (el.getAttribute('role')) return el.getAttribute('role')!
      if (tag === 'a') return 'link'
      if (tag === 'button' || tag === 'summary') return 'button'
      if (tag === 'select') return 'combobox'
      if (tag === 'textarea') return 'textbox'
      if (tag === 'input') {
        if (['button', 'submit', 'reset'].includes(type)) return 'button'
        if (type === 'checkbox') return 'checkbox'
        if (type === 'radio') return 'radio'
        if (type === 'search') return 'searchbox'
        if (type === 'range') return 'slider'
        return 'textbox'
      }
      return tag
    }
    const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
    const labelOf = (el: Element): string => {
      const id = el.getAttribute('id')
      if (id) {
        const l = document.querySelector(`label[for="${CSS.escape(id)}"]`)
        if (l) return clean(l.textContent)
      }
      const parent = el.closest('label')
      return parent ? clean(parent.textContent) : ''
    }
    const nameOf = (el: Element): string => {
      const by = el.getAttribute('aria-labelledby')
      if (by) {
        const t = by.split(/\s+/).map((i) => document.getElementById(i)?.textContent ?? '').join(' ')
        if (clean(t)) return clean(t)
      }
      return (
        clean(el.getAttribute('aria-label')) ||
        labelOf(el) ||
        clean((el as HTMLInputElement).value && ['button', 'submit'].includes((el as HTMLInputElement).type) ? (el as HTMLInputElement).value : '') ||
        clean((el as HTMLElement).innerText) ||
        clean(el.getAttribute('placeholder')) ||
        clean(el.getAttribute('title')) ||
        clean(el.querySelector('img')?.getAttribute('alt'))
      )
    }
    const out: PageElement[] = []
    const seen = new Set<Element>()
    for (const el of Array.from(document.querySelectorAll(SELECTOR))) {
      if (out.length >= max || seen.has(el)) continue
      seen.add(el)
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (r.width < 4 || r.height < 4 || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue
      const role = implicitRole(el)
      const name = nameOf(el)
      const testId = el.getAttribute('data-testid') ?? el.getAttribute('data-test') ?? undefined
      const label = labelOf(el)
      const placeholder = clean(el.getAttribute('placeholder')) || undefined
      const id = el.getAttribute('id')
      const locator: PageElement['locator'] = testId
        ? { testId }
        : name && role !== 'textbox'
          ? { role, name }
          : label
            ? { label }
            : placeholder
              ? { placeholder }
              : name
                ? { role, name }
                : id && /^[A-Za-z][\w-]*$/.test(id)
                  ? { css: `#${id}` }
                  : { css: el.tagName.toLowerCase() }
      out.push({
        ref: `e${out.length + 1}`,
        tag: el.tagName.toLowerCase(),
        role,
        name,
        locator,
        box: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) },
        inViewport: r.bottom > 0 && r.top < innerHeight,
      })
    }
    return out
  }, MAX_ELEMENTS)
}

/** Dibuixa una etiqueta amb la referència de cada element (set-of-marks) per a la captura anotada. */
async function drawMarks(page: Page, elements: PageElement[]): Promise<void> {
  await page.evaluate((els) => {
    const layer = document.createElement('div')
    layer.id = '__hub_marks'
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2147483647'
    for (const e of els) {
      const b = document.createElement('div')
      b.style.cssText = `position:absolute;left:${e.box.x}px;top:${e.box.y}px;width:${e.box.width}px;height:${e.box.height}px;outline:2px solid #e11d48;border-radius:3px`
      const t = document.createElement('span')
      t.textContent = e.ref
      t.style.cssText = 'position:absolute;left:-2px;top:-16px;background:#e11d48;color:#fff;font:bold 11px/14px monospace;padding:0 3px;border-radius:3px'
      b.appendChild(t)
      layer.appendChild(b)
    }
    document.body.appendChild(layer)
  }, elements)
}

async function removeMarks(page: Page): Promise<void> {
  await page.evaluate(() => document.getElementById('__hub_marks')?.remove())
}

export async function analyzePage(
  url: string,
  outDir: string,
  opts: { useSession: boolean; onStage?: (s: string) => void },
): Promise<PageAnalysis> {
  await mkdir(outDir, { recursive: true })
  const { browser, page } = await launch({ useSession: opts.useSession })
  try {
    opts.onStage?.('Obrint la pàgina')
    await gotoWithRetry(page, url)
    await settle(page)

    opts.onStage?.('Llegint l’estructura de la pàgina')
    const meta = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name=description]')?.getAttribute('content') ?? '',
      headings: Array.from(document.querySelectorAll('h1,h2,h3'))
        .map((h) => `${h.tagName.toLowerCase()}: ${(h as HTMLElement).innerText.replace(/\s+/g, ' ').trim()}`)
        .filter((h) => h.length > 4)
        .slice(0, 40),
      links: Array.from(document.querySelectorAll('a[href]'))
        .map((a) => ({ text: (a as HTMLElement).innerText.replace(/\s+/g, ' ').trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.text && l.href.startsWith(location.origin))
        .slice(0, 40),
    }))
    const elements = await readElements(page)

    opts.onStage?.('Fent captures de la pàgina')
    const screenshots: string[] = []
    const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    const pages = Math.min(4, Math.ceil(fullHeight / 1080))
    for (let i = 0; i < pages; i++) {
      await page.evaluate((y) => scrollTo(0, y), i * 1080)
      await page.waitForTimeout(300)
      const clean = `pantalla-${i + 1}.png`
      await page.screenshot({ path: path.join(outDir, clean) })
      screenshots.push(clean)
      const visible = elements.filter((e) => e.box.y + e.box.height > i * 1080 && e.box.y < (i + 1) * 1080)
      await drawMarks(page, visible)
      const marked = `pantalla-${i + 1}-marques.png`
      await page.screenshot({ path: path.join(outDir, marked) })
      screenshots.push(marked)
      await removeMarks(page)
    }
    await page.evaluate(() => scrollTo(0, 0))

    return {
      url: page.url(),
      title: meta.title,
      description: meta.description,
      headings: meta.headings,
      elements,
      screenshots,
      links: meta.links,
      analyzedAt: new Date().toISOString(),
    }
  } finally {
    await browser.close()
  }
}
