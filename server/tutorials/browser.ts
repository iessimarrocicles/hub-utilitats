import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Locator as PwLocator, type Page } from 'playwright'
import type { Locator } from '../../src/utilities/tutorials/types.ts'
import { BROWSER_PATH, SESSION_FILE, WORKSPACE } from '../config.ts'

/** Perfil del Chrome on l'usuari inicia sessió (fora del control de Playwright). */
const PROFILE_DIR = path.join(WORKSPACE, 'browser-profile')

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

const SYSTEM_CHROME = [
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
].find((p): p is string => !!p && existsSync(p))

/**
 * Obri un navegador visible perquè l'usuari inicie sessió.
 * És un Chrome normal, sense Playwright: Google («Aquest navegador no és segur») i altres
 * proveïdors bloquegen l'inici de sessió als navegadors automatitzats. Quan l'usuari el tanca,
 * Playwright obri el mateix perfil sense finestra i en desa la sessió per a les captures.
 */
export async function loginSession(url: string): Promise<void> {
  const exe = BROWSER_PATH || SYSTEM_CHROME || chromium.executablePath()
  await mkdir(PROFILE_DIR, { recursive: true })
  const child = spawn(exe, [`--user-data-dir=${PROFILE_DIR}`, '--no-first-run', '--no-default-browser-check', '--lang=es-ES', '--new-window', url], {
    stdio: 'ignore',
  })
  await new Promise<void>((done, fail) => {
    child.once('error', fail)
    child.once('exit', () => done())
  })
  // El procés llançat pot acabar de seguida (Chrome es torna a obrir en un altre procés):
  // el perfil està en ús mentre existeix el seu «lockfile», que Chrome esborra en tancar-se.
  const lock = path.join(PROFILE_DIR, 'lockfile')
  await new Promise((r) => setTimeout(r, 3000))
  while (existsSync(lock)) await new Promise((r) => setTimeout(r, 1000))
  await new Promise((r) => setTimeout(r, 1000))
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, executablePath: exe })
  try {
    // storageState només inclou l'emmagatzematge dels llocs visitats en aquest context.
    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
    await page.waitForTimeout(5000)
    // indexedDB: llocs com ElevenLabs (Firebase) hi guarden part de l'inici de sessió.
    await context.storageState({ path: SESSION_FILE, indexedDB: true })
  } finally {
    await context.close()
  }
}
