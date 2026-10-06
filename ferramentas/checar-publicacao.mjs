// Portão "antes de publicar" (build de produção na Vercel e `npm run checar:publicacao`). Falha alto se algo
// bloqueante faltar:
// responsável e hospedagem na config, dados conferidos com o resultado oficial e a aprovação humana dos textos
// (src/conteudo/APROVACAO.md inteiro marcado e assinado; Res. TSE 23.610, art. 28, §6º-B).
// As citações dos planos são conferidas contra os PDFs à parte (`npm run conferir:citacoes`), antes de cada envio.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ITEM_ABERTO = /^\s*- \[ \]/gm
const LINHA_APROVADO = /^Aprovado por:(.*?)Data:(.*)$/m

/** Falhas da APROVACAO.md: item sem marcar, ou "Aprovado por"/"Data" ainda em branco (só sublinhados). */
export function falhasDaAprovacao(texto) {
  const falhas = []
  const abertos = (texto.match(ITEM_ABERTO) ?? []).length
  if (abertos > 0) falhas.push(`src/conteudo/APROVACAO.md tem ${abertos} itens sem marcar (revisão humana de todo texto, D6)`)
  const linha = texto.match(LINHA_APROVADO)
  const nome = (s) => s !== undefined && /\p{L}/u.test(s)
  const data = (s) => s !== undefined && /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(s)
  if (linha === null || !nome(linha[1]) || !data(linha[2])) {
    falhas.push('src/conteudo/APROVACAO.md sem "Aprovado por" e "Data" preenchidos')
  }
  return falhas
}

/** Todas as falhas, a partir do que foi lido do disco (indice = null quando o arquivo não existe). */
export function falhasDaPublicacao({ cfg, indice, aprovacao }) {
  const falhas = []
  if (!cfg.site.responsavel?.nome) falhas.push('site.responsavel.nome vazio (Lei 9.504, art. 57-D: vedado o anonimato)')
  if (!cfg.site.responsavel?.contato) falhas.push('site.responsavel.contato vazio')
  if (!cfg.site.hospedagem) falhas.push('site.hospedagem vazio (provedor no Brasil — Lei 9.504, art. 57-B; aviso de privacidade)')
  if (indice === null) falhas.push('public/dados/indice.json não existe (rode `npm run dados`)')
  else if (!indice.conferencia?.ok) falhas.push('indice.conferencia.ok = false (totais não batem com o resultado oficial)')
  if (aprovacao === null) falhas.push('src/conteudo/APROVACAO.md não existe')
  else falhas.push(...falhasDaAprovacao(aprovacao))
  return falhas
}

function lerSeExiste(url, ler) {
  return existsSync(url) ? ler(readFileSync(url, 'utf8')) : null
}

function principal() {
  const cfg = JSON.parse(readFileSync(new URL('../config/candidatura.json', import.meta.url), 'utf8'))
  const indice = lerSeExiste(new URL('../public/dados/indice.json', import.meta.url), JSON.parse)
  const aprovacao = lerSeExiste(new URL('../src/conteudo/APROVACAO.md', import.meta.url), (t) => t)
  const falhas = falhasDaPublicacao({ cfg, indice, aprovacao })
  if (falhas.length) {
    console.error('❌ Publicação bloqueada:\n- ' + falhas.join('\n- '))
    process.exit(1)
  }
  console.warn('✅ Portão de publicação ok (o que fica fora do código, como a validação jurídica, continua com o responsável).')
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) principal()
