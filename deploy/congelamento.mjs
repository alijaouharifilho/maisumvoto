// Congelamento de deploy no período eleitoral (deploy/CONGELAMENTO.md). Os limites vêm de config/candidatura.json
// (calendario): começa quando termina a última fase aberta e acaba quando termina a última fase com data.
// Usado pela trava do build de produção na Vercel (ferramentas/build-vercel.mjs).

export const MARGEM_ULTIMO_DEPLOY_MS = 2 * 60 * 60 * 1000
const FUSO_EXIBICAO = 'America/Sao_Paulo'

function data(iso, rotulo) {
  const d = new Date(iso)
  if (typeof iso !== 'string' || Number.isNaN(d.getTime())) throw new Error(`${rotulo}: data inválida (${iso})`)
  return d
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
