import { spawn } from 'node:child_process'

export interface RunResult {
  code: number
  stdout: string
  stderr: string
}

export interface RunOptions {
  cwd?: string
  input?: string
  timeoutMs?: number
  onStderr?: (chunk: string) => void
  onStdout?: (chunk: string) => void
}

/** Executa un programa sense shell i en recull l'eixida. */
export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, windowsHide: true })
    let stdout = ''
    let stderr = ''
    let timer: NodeJS.Timeout | undefined
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        child.kill()
        reject(new Error(`${cmd} ha tardat massa i s'ha aturat.`))
      }, opts.timeoutMs)
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d: string) => {
      stdout += d
      opts.onStdout?.(d)
    })
    child.stderr.on('data', (d: string) => {
      stderr += d
      if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000)
      opts.onStderr?.(d)
    })
    child.on('error', (err) => {
      if (timer) clearTimeout(timer)
      reject(new Error(`No s'ha pogut executar ${cmd}: ${err.message}`))
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })
    if (opts.input != null) child.stdin.end(opts.input, 'utf8')
    else child.stdin.end()
  })
}

/** Com run, però falla si el programa acaba amb error. */
export async function runOk(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const r = await run(cmd, args, opts)
  if (r.code !== 0) {
    const tail = (r.stderr || r.stdout).trim().split(/\r?\n/).slice(-6).join('\n')
    throw new Error(`${cmd} ha fallat (codi ${r.code}).\n${tail}`)
  }
  return r
}
