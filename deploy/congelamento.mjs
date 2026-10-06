// Congelamento de deploy no período eleitoral. Os limites vêm de config/candidatura.json
// (calendario): começa quando termina a última fase aberta e acaba quando termina a última
// fase com data. Uso pelo deploy/publicar.sh:
//   node deploy/congelamento.mjs [--config caminho] [--agora ISO-8601]
// Códigos de saída: 0 livre · 10 margem do último deploy · 11 congelado · 1 erro (falha fechada).
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const MARGEM_ULTIMO_DEPLOY_MS = 2 * 60 * 60 * 1000
const FUSO_EXIBICAO = 'America/Sao_Paulo'
const CODIGO = Object.freeze({ livre: 0, margem: 10, congelado: 11, erro: 1 })
const CONFIG_PADRAO = fileURLToPath(new URL('../config/candidatura.json', import.meta.url))

function data(iso, rotulo) {
  const d = new Date(iso)
  if (typeof iso !== 'string' || Number.isNaN(d.getTime())) throw new Error(`${rotulo}: data inválida (${iso})`)
  return d
}

export function lerCalendario(caminho = CONFIG_PADRAO) {
  const config = JSON.parse(readFileSync(caminho, 'utf8'))
  if (!config?.calendario) throw new Error(`${caminho}: sem "calendario"`)
  return config.calendario
}

export function janelaCongelamento(calendario) {
  const fases = calendario?.fases
  const abertas = calendario?.fasesAbertas
  if (!Array.isArray(fases) || fases.length < 2) throw new Error('calendario.fases: precisa de ao menos 2 fases')
  if (!Array.isArray(abertas) || abertas.length === 0) throw new Error('calendario.fasesAbertas: vazio')
  const ultimaAberta = fases.filter((f) => abertas.includes(f.id)).at(-1)
  const ultimaComData = fases.filter((f) => f.ate !== null).at(-1)
  if (!ultimaAberta || !ultimaComData) throw new Error('calendario.fases: sem fase aberta ou sem fase com data')
  const inicio = data(ultimaAberta.ate, `fase ${ultimaAberta.id}`)
  const fim = data(ultimaComData.ate, `fase ${ultimaComData.id}`)
  if (inicio.getTime() >= fim.getTime()) throw new Error('calendario: início do congelamento não é anterior ao fim')
  return Object.freeze({ inicio, fim })
}

export function formatarBrasilia(d) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_EXIBICAO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

export function avaliarCongelamento(agora, janela, margemMs = MARGEM_ULTIMO_DEPLOY_MS) {
  const t = agora.getTime()
  const inicio = formatarBrasilia(janela.inicio)
  const fim = formatarBrasilia(janela.fim)
  const limite = formatarBrasilia(new Date(janela.inicio.getTime() - margemMs))
  if (t >= janela.inicio.getTime() && t < janela.fim.getTime()) {
    return { estado: 'congelado', mensagem: `Deploy congelado de ${inicio} até ${fim} (horário de Brasília).` }
  }
  if (t >= janela.inicio.getTime() - margemMs && t < janela.inicio.getTime()) {
    return {
      estado: 'margem',
      mensagem: `O último deploy era até ${limite}; o congelamento começa ${inicio} (horário de Brasília).`,
    }
  }
  return { estado: 'livre', mensagem: `Fora do congelamento (${inicio} → ${fim}, horário de Brasília).` }
}

function lerArgumentos(argv) {
  const opcoes = { config: CONFIG_PADRAO, agora: new Date() }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--config') opcoes.config = argv[(i += 1)]
    else if (argv[i] === '--agora') opcoes.agora = data(argv[(i += 1)], '--agora')
    else throw new Error(`argumento desconhecido: ${argv[i]}`)
  }
  return opcoes
}

function principal() {
  try {
    const { config, agora } = lerArgumentos(process.argv.slice(2))
    const r = avaliarCongelamento(agora, janelaCongelamento(lerCalendario(config)))
    const saida = r.estado === 'livre' ? process.stdout : process.stderr
    saida.write(`congelamento: ${r.estado}. ${r.mensagem}\n`)
    process.exitCode = CODIGO[r.estado]
  } catch (erro) {
    process.stderr.write(`congelamento: erro ao ler o calendário (deploy bloqueado): ${erro.message}\n`)
    process.exitCode = CODIGO.erro
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) principal()
