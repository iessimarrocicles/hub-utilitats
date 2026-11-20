import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { Action, Locator, PageAnalysis, PageElement, Storyboard } from '../../src/utilities/tutorials/types.ts'
import { askClaude } from '../claude.ts'
import { performAction } from './actions.ts'
import { readElements, settle } from './analyze.ts'
import { describe, gotoWithRetry, launch } from './browser.ts'

const LOCATOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ref: { type: 'string', description: 'Referència eN de l’anàlisi, si l’element hi apareix.' },
    role: { type: 'string' },
    name: { type: 'string' },
    label: { type: 'string' },
    placeholder: { type: 'string' },
    text: { type: 'string' },
    testId: { type: 'string' },
    css: { type: 'string' },
  },
}

export const STORYBOARD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'takeaways', 'chapters'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    takeaways: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    chapters: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'scenes'],
        properties: {
          title: { type: 'string' },
          scenes: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['narration', 'actions'],
              properties: {
                narration: { type: 'string' },
                callout: { type: 'string' },
                focus: LOCATOR_SCHEMA,
                actions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['type'],
                    properties: {
                      type: { enum: ['goto', 'click', 'type', 'hover', 'scroll', 'select', 'press', 'wait'] },
                      target: LOCATOR_SCHEMA,
                      value: { type: 'string' },
                      url: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const

type RawLocator = Locator & { ref?: string }
interface RawStoryboard {
  title: string
  summary: string
  takeaways: string[]
  chapters: {
    title: string
    scenes: { narration: string; callout?: string; focus?: RawLocator; actions: (Omit<Action, 'target'> & { target?: RawLocator })[] }[]
  }[]
}

function elementLines(elements: PageElement[], withRef = true): string {
  return elements
    .map((e) => `${withRef ? `${e.ref} ` : ''}${e.role} «${e.name}»${e.inViewport ? '' : ' (cal baixar)'} → ${describe(e.locator)}`)
    .join('\n')
}

export function scriptPrompt(a: PageAnalysis, brief: string, maxMinutes: number): string {
  const shots = a.screenshots.filter((s) => s.includes('marques'))
  return `Eres guionista de videotutoriales de software. Analiza esta página web y escribe el guion de un videotutorial en castellano que explique para qué sirve y cómo se usa.

PÁGINA
- URL: ${a.url}
- Título: ${a.title}
- Descripción: ${a.description || '(sin descripción)'}
- Encabezados:
${a.headings.map((h) => `  - ${h}`).join('\n') || '  (ninguno)'}

ELEMENTOS INTERACTIVOS (referencia, rol, nombre accesible, localizador):
${elementLines(a.elements)}

CAPTURAS: lee con la herramienta Read los ficheros ${shots.join(', ')} de la carpeta actual. Cada elemento lleva su referencia (e1, e2…) en una etiqueta roja.

INDICACIONES DEL USUARIO: ${brief.trim() || '(ninguna: explica el uso principal de la página)'}

CÓMO ESCRIBIR EL GUION
- Duración total: ${maxMinutes} minutos como máximo. Unas 140 palabras por minuto.
- Organízalo en capítulos (2-5) con escenas cortas. Cada escena: 1-3 frases de narración y las acciones que se ven mientras se narra.
- La primera escena presenta la página sin acciones (o solo un scroll suave). La última resume lo aprendido.
- Narración: castellano neutro, segunda persona («pulsa», «verás»), frases claras, sin leer URLs ni nombres técnicos de elementos. Explica el porqué, no solo el qué. Escribe los números y las siglas como se pronuncian.
- Acciones: usa la referencia (ref: "e12") de los elementos de la lista. Para elementos que aparecen después de una acción y no están en la lista, usa role+name, label, placeholder o text visibles. No inventes elementos.
- Para escribir: action "type" con el texto de ejemplo en value. Para confirmar: "press" con value "Enter". "wait" lleva los segundos en value.
- No hagas acciones destructivas ni irreversibles (borrar cuentas, pagos, enviar correos reales, publicar). Usa datos de ejemplo verosímiles.
- "focus": el elemento que hay que destacar en la escena (normalmente el de la acción principal). "callout": rótulo breve (máx. 5 palabras) que aparecerá junto al elemento, solo cuando aporte.
- "takeaways": 3-5 ideas clave para la pantalla de resumen.
- "summary": una sola frase de 25 palabras como máximo; aparece en la pantalla de presentación.
- "title": corto, 8 palabras como máximo.`
}

function fixPrompt(board: RawStoryboard, errors: { scene: string; error: string; elements: string }[]): string {
  return `El guion siguiente tiene acciones que fallan al ejecutarlas en la página real. Corrígelas y devuelve el guion completo.

GUION ACTUAL (JSON):
${JSON.stringify(board)}

ERRORES:
${errors.map((e) => `- Escena «${e.scene}»: ${e.error}\n  Elementos visibles en ese momento:\n${e.elements}`).join('\n')}

Mantén la narración salvo que haya que cambiarla para que encaje. Para los elementos de estas listas usa su localizador (role+name, label, placeholder, text o css), no una referencia eN. Si un paso no se puede hacer, quítalo.`
}

/** Passa les referències eN a localitzadors i posa ids estables. */
export function normalizeStoryboard(raw: RawStoryboard, analysis: PageAnalysis): Storyboard {
  const byRef = new Map(analysis.elements.map((e) => [e.ref, e.locator]))
  const fix = (l?: RawLocator): Locator | undefined => {
    if (!l) return undefined
    const { ref, ...rest } = l
    const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v === 'string' && v.trim())) as Locator
    if (ref && byRef.has(ref)) return byRef.get(ref)
    return Object.keys(clean).length ? clean : undefined
  }
  let s = 0
  return {
    title: raw.title,
    summary: raw.summary,
    takeaways: raw.takeaways ?? [],
    startUrl: analysis.url,
    chapters: raw.chapters.map((c, ci) => ({
      id: `c${ci + 1}`,
      title: c.title,
      scenes: c.scenes.map((sc) => ({
        id: `s${++s}`,
        narration: sc.narration.trim(),
        callout: sc.callout?.trim() || undefined,
        focus: fix(sc.focus),
        actions: sc.actions.map((a) => ({ ...a, target: fix(a.target) })).filter((a) => a.type !== 'goto' || a.url),
      })),
    })),
  }
}

/** Torna l'storyboard en el format brut, per a demanar correccions. */
function toRaw(b: Storyboard): RawStoryboard {
  return {
    title: b.title,
    summary: b.summary,
    takeaways: b.takeaways,
    chapters: b.chapters.map((c) => ({ title: c.title, scenes: c.scenes.map((s) => ({ narration: s.narration, callout: s.callout, focus: s.focus, actions: s.actions })) })),
  }
}

export interface DryRunError {
  sceneId: string
  error: string
  elements: string
}

/** Executa totes les accions sense gravar per a comprovar que els elements existeixen. */
export async function dryRun(board: Storyboard, useSession: boolean): Promise<DryRunError[]> {
  const { browser, page } = await launch({ useSession })
  const errors: DryRunError[] = []
  try {
    await gotoWithRetry(page, board.startUrl)
    await settle(page)
    const ctx = { human: false, sceneId: '', now: () => 0, mouse: { x: 960, y: 540 }, log: () => {} }
    for (const chapter of board.chapters) {
      for (const scene of chapter.scenes) {
        ctx.sceneId = scene.id
        for (const action of scene.actions) {
          try {
            await performAction(page, action, ctx)
          } catch (err) {
            const msg = (err as Error).message.split('\n')[0]
            const els = await readElements(page).catch(() => [])
            errors.push({
              sceneId: scene.id,
              error: `${action.type} ${describe(action.target)}: ${msg}`,
              elements: elementLines(els.slice(0, 80), false).replace(/^/gm, '    '),
            })
            break
          }
        }
      }
    }
  } finally {
    await browser.close()
  }
  return errors
}

export async function writeScript(
  analysis: PageAnalysis,
  analysisDir: string,
  opts: { brief: string; maxMinutes: number; useSession: boolean; stage: (s: string) => void },
): Promise<{ storyboard: Storyboard; errors: DryRunError[] }> {
  await mkdir(analysisDir, { recursive: true })
  opts.stage('Claude Code està analitzant la pàgina i escrivint el guió')
  const { output } = await askClaude<RawStoryboard>({
    prompt: scriptPrompt(analysis, opts.brief, opts.maxMinutes),
    schema: STORYBOARD_SCHEMA,
    cwd: analysisDir,
    tools: ['Read'],
  })
  let board = normalizeStoryboard(output, analysis)

  let errors: DryRunError[] = []
  for (let round = 1; round <= 3; round++) {
    opts.stage(round === 1 ? 'Provant el guió a la pàgina real' : `Tornant a provar el guió (intent ${round})`)
    errors = await dryRun(board, opts.useSession)
    if (errors.length === 0 || round === 3) break
    opts.stage(`Claude Code està corregint ${errors.length} passos que fallen`)
    const titleOf = (id: string) => board.chapters.flatMap((c) => c.scenes).find((s) => s.id === id)?.narration.slice(0, 60) ?? id
    const fixed = await askClaude<RawStoryboard>({
      prompt: fixPrompt(toRaw(board), errors.map((e) => ({ scene: titleOf(e.sceneId), error: e.error, elements: e.elements }))),
      schema: STORYBOARD_SCHEMA,
      cwd: path.resolve(analysisDir),
      tools: [],
    })
    board = normalizeStoryboard(fixed.output, analysis)
  }
  return { storyboard: board, errors }
}
