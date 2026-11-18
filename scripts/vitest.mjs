// A Windows, si la carpeta s'obri com a «c:\…» (minúscula, com fa VS Code),
// Vitest carrega dues còpies d'alguns mòduls i tots els tests fallen amb
// «Cannot read properties of undefined (reading 'config')».
// Aquest script posa la lletra de la unitat en majúscula i llança Vitest.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase())
const require = createRequire(path.join(cwd, 'package.json'))
const bin = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')

const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: 'inherit' })
process.exit(result.status ?? 1)
