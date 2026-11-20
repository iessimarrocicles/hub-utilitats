import { existsSync } from 'node:fs'
import { chromium, type Browser, type BrowserContext, type Locator as PwLocator, type Page } from 'playwright'
import type { Locator } from '../../src/utilities/tutorials/types.ts'
import { BROWSER_PATH, SESSION_FILE } from '../config.ts'

export const VIEWPORT = { width: 1920, height: 1080 }

export interface BrowserOptions {
  headless?: boolean
  /** Factor de píxels: 2 = captura a 3840×2160 per a zooms nítids. */
  scale?: number
  useSession?: boolean
  viewport?: { width: number; height: number }
}

function launchOptions(headless: boolean) {
  return {
    headless,
    // El Chromium complet de Playwright (no el «headless shell»), o el que diga HUB_BROWSER_PATH.
    channel: BROWSER_PATH ? undefined : 'chromium',
    executablePath: BROWSER_PATH || undefined,
    args: ['--hide-scrollbars', '--disable-features=Translate', '--lang=es-ES'],
  }
}

export async function launch(opts: BrowserOptions = {}): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await chromium.launch(launchOptions(opts.headless ?? true))
  const context = await browser.newContext({
    viewport: opts.viewport ?? VIEWPORT,
    deviceScaleFactor: opts.scale ?? 1,
    locale: 'es-ES',
    colorScheme: 'light',
    storageState: opts.useSession && existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
  })
  const page = await context.newPage()
  return { browser, context, page }
}

const NETWORK_ERROR = /net::ERR_(CONNECTION_TIMED_OUT|CONNECTION_RESET|CONNECTION_CLOSED|TIMED_OUT|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|NETWORK_CHANGED|ADDRESS_UNREACHABLE)|Timeout \d+ms exceeded/

/**
 * Obri una adreça tornant-ho a provar si la xarxa falla: amb connexions lentes o
 * intermitents, el primer intent pot tallar-se encara que la web funcione.
 */
export async function gotoWithRetry(page: Page, url: string, attempts = 3): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      return
    } catch (err) {
      if (i >= attempts || !NETWORK_ERROR.test((err as Error).message)) throw new Error(friendlyError(err as Error, url))
      await page.waitForTimeout(2000 * i)
    }
  }
}

/** Missatge d'error llegible: sense codis de color ni el registre intern de Playwright. */
export function friendlyError(err: Error, url?: string): string {
  // eslint-disable-next-line no-control-regex
  const msg = err.message.replace(/\u001b\[[0-9;]*m/g, '').split(/\n\s*Call log:/)[0].trim()
  if (/net::ERR_(CONNECTION_TIMED_OUT|TIMED_OUT)|Timeout \d+ms exceeded.*goto/.test(msg)) {
    return `No s’ha pogut obrir ${url ?? 'la pàgina'}: la connexió ha tardat massa, fins i tot després de tres intents. Comprova la connexió a Internet i torna-ho a provar.`
  }
  if (/net::ERR_NAME_NOT_RESOLVED/.test(msg)) return `No es troba l’adreça ${url ?? ''}. Revisa que estiga ben escrita.`
  if (/net::ERR_INTERNET_DISCONNECTED/.test(msg)) return 'No hi ha connexió a Internet.'
  return msg
}

type Role = Parameters<Page['getByRole']>[0]

/** Converteix el localitzador del guió en un localitzador de Playwright. */
export function resolve(page: Page, loc: Locator): PwLocator {
  let l: PwLocator
  if (loc.testId) l = page.getByTestId(loc.testId)
  else if (loc.role && loc.name) l = page.getByRole(loc.role as Role, { name: loc.name, exact: false })
  else if (loc.label) l = page.getByLabel(loc.label, { exact: false })
  else if (loc.placeholder) l = page.getByPlaceholder(loc.placeholder, { exact: false })
  else if (loc.text) l = page.getByText(loc.text, { exact: false })
  else if (loc.css) l = page.locator(loc.css)
  else if (loc.role) l = page.getByRole(loc.role as Role)
  else throw new Error('Localitzador buit.')
  return l.first()
}

export function describe(loc: Locator | undefined): string {
  if (!loc) return '(cap)'
  return Object.entries(loc)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ')
}

/**
 * Obri un navegador visible perquè l'usuari inicie sessió.
 * Quan tanca la finestra, es desa la sessió per a les captures.
 */
export async function loginSession(url: string): Promise<void> {
  const browser = await chromium.launch({ ...launchOptions(false), args: [] })
  const context = await browser.newContext({
    viewport: null,
    locale: 'es-ES',
    storageState: existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
  })
  const page = await context.newPage()
  await page.goto(url).catch(() => {})
  // Espera que l'usuari tanque totes les pestanyes.
  await new Promise<void>((done) => {
    const check = () => {
      if (context.pages().length === 0) done()
    }
    context.on('page', (p) => p.on('close', check))
    page.on('close', check)
  })
  await context.storageState({ path: SESSION_FILE })
  await browser.close()
}
