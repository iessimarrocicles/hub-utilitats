import { CLAUDE_MODEL } from './config.ts'
import { run } from './lib/run.ts'

export interface ClaudeCall {
  prompt: string
  schema: object
  cwd: string
  /** Eines que pot usar. Buit = cap eina. */
  tools?: string[]
  addDirs?: string[]
  timeoutMs?: number
}

export interface ClaudeResult<T> {
  output: T
  costUsd: number | null
}

/**
 * Crida el Claude Code local en mode no interactiu i en torna l'eixida estructurada.
 * Va aïllat (sense MCP ni configuració de l'usuari) perquè cada crida consumisca poc.
 */
export async function askClaude<T>(call: ClaudeCall): Promise<ClaudeResult<T>> {
  const args = [
    '-p',
    '--output-format', 'json',
    '--no-session-persistence',
    '--strict-mcp-config',
    '--setting-sources', '',
    '--tools', (call.tools ?? []).join(','),
    '--json-schema', JSON.stringify(call.schema),
  ]
  if (call.tools?.length) args.push('--allowedTools', call.tools.join(','))
  for (const d of call.addDirs ?? []) args.push('--add-dir', d)
  if (CLAUDE_MODEL) args.push('--model', CLAUDE_MODEL)

  const r = await run('claude', args, { cwd: call.cwd, input: call.prompt, timeoutMs: call.timeoutMs ?? 20 * 60_000 })
  let data: { is_error?: boolean; structured_output?: T; result?: string; total_cost_usd?: number }
  try {
    data = JSON.parse(r.stdout)
  } catch {
    const tail = (r.stderr || r.stdout).trim().slice(-600)
    throw new Error(`Claude Code no ha tornat una resposta vàlida.${tail ? `\n${tail}` : ''}`)
  }
  if (data.is_error || data.structured_output == null) {
    throw new Error(`Claude Code no ha pogut completar la tasca. ${data.result ?? ''}`.trim())
  }
  return { output: data.structured_output, costUsd: data.total_cost_usd ?? null }
}

export async function claudeVersion(): Promise<string | null> {
  try {
    const r = await run('claude', ['--version'], { timeoutMs: 20_000 })
    return r.code === 0 ? r.stdout.trim() : null
  } catch {
    return null
  }
}
