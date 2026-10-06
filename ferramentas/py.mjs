// Roda o Python do venv do projeto (.venv), com -X utf8, em Windows e Linux.
// Uso: node ferramentas/py.mjs -m etl.montar [args]
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const candidatos = [join(raiz, '.venv', 'Scripts', 'python.exe'), join(raiz, '.venv', 'bin', 'python')]
const python = candidatos.find((p) => existsSync(p))
if (!python) {
  console.error('Venv não encontrado. Crie com o Python explícito:\n  C:/Users/PC/AppData/Local/Python/pythoncore-3.14-64/python.exe -m venv .venv\n  .venv/Scripts/python.exe -m pip install -r etl/requirements.txt')
  process.exit(1)
}
const r = spawnSync(python, ['-X', 'utf8', ...process.argv.slice(2)], { stdio: 'inherit', cwd: raiz, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
process.exit(r.status ?? 1)
