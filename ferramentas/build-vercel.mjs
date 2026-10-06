// Build na Vercel (vercel.json → buildCommand). Em produção (VERCEL_ENV=production), antes de montar o site,
// aplica as mesmas travas do deploy/publicar.sh: o portão de publicação (responsável, hospedagem, dados
// conferidos com o resultado oficial e APROVACAO.md assinada) e o congelamento eleitoral. Prévias montam sempre.
// Build de produção que falha mantém no ar o deployment anterior (ou nenhum, se ainda não houve).
// Emergência durante o congelamento: variável CONGELAMENTO_IGNORAR=1 no projeto da Vercel (ver deploy/CONGELAMENTO.md).
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { avaliarCongelamento, formatarBrasilia, janelaCongelamento } from '../deploy/congelamento.mjs'
import { falhasDaPublicacao } from './checar-publicacao.mjs'

/** Motivos para recusar o build; vazio = pode montar. Fora de produção, nunca bloqueia. */
export function motivosParaBloquear({ ambiente, agora, cfg, indice, aprovacao, ignorarCongelamento = false }) {
  if (ambiente !== 'production') return []
  const motivos = [...falhasDaPublicacao({ cfg, indice, aprovacao })]
  const congelamento = avaliarCongelamento(agora, janelaCongelamento(cfg.calendario))
  // Como o deploy/publicar.sh: além do congelamento, as 2 h antes dele (o último deploy normal é até 24/10, 20h).
  if (congelamento.estado !== 'livre' && !ignorarCongelamento) motivos.push(congelamento.mensagem)
  return motivos
}

function lerSeExiste(caminho, ler) {
  return existsSync(caminho) ? ler(readFileSync(caminho, 'utf8')) : null
}

function principal() {
  const raiz = fileURLToPath(new URL('..', import.meta.url))
  const ambiente = process.env.VERCEL_ENV ?? 'local'
  const motivos = motivosParaBloquear({
    ambiente,
    agora: new Date(),
    cfg: JSON.parse(readFileSync(resolve(raiz, 'config', 'candidatura.json'), 'utf8')),
    indice: lerSeExiste(resolve(raiz, 'public', 'dados', 'indice.json'), JSON.parse),
    aprovacao: lerSeExiste(resolve(raiz, 'src', 'conteudo', 'APROVACAO.md'), (t) => t),
    ignorarCongelamento: process.env.CONGELAMENTO_IGNORAR === '1',
  })
  if (motivos.length > 0) {
    console.error(`❌ Produção bloqueada em ${formatarBrasilia(new Date())} (horário de Brasília). Corrija e publique de novo:\n- ${motivos.join('\n- ')}`)
    process.exit(1)
  }
  console.warn(`Montando o site (ambiente: ${ambiente}).`)
  const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', cwd: raiz, shell: process.platform === 'win32' })
  process.exit(build.status ?? 1)
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) principal()
