// Leitor mínimo de markdown para sobre.md e privacidade.md. Devolve blocos tipados (nada de HTML pronto):
// o front monta os elementos, então não há como injetar marcação. Suporta só o que os textos usam:
// "# / ## / ###", parágrafos, listas "- " e "1. ", **negrito** e [texto](url). Links só http(s), mailto e "#".

export type Trecho =
  | { readonly tipo: 'texto'; readonly texto: string }
  | { readonly tipo: 'negrito'; readonly texto: string }
  | { readonly tipo: 'link'; readonly texto: string; readonly url: string }

export type Bloco =
  | { readonly tipo: 'titulo'; readonly nivel: 1 | 2 | 3; readonly ancora: string; readonly conteudo: readonly Trecho[] }
  | { readonly tipo: 'paragrafo'; readonly conteudo: readonly Trecho[] }
  | { readonly tipo: 'lista'; readonly ordenada: boolean; readonly itens: readonly (readonly Trecho[])[] }

const TITULO = /^(#{1,3})\s+(.+)$/
const ITEM_SIMPLES = /^-\s+(.+)$/
const ITEM_NUMERADO = /^\d+\.\s+(.+)$/
const EM_LINHA = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
const URL_SEGURA = /^(https?:\/\/|mailto:|#)/i

/** "Quem faz?" → "quem-faz". Âncora estável para links do tipo #/sobre/privacidade. */
export function ancora(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function lerEmLinha(texto: string): Trecho[] {
  const trechos: Trecho[] = []
  let desde = 0
  for (const m of texto.matchAll(EM_LINHA)) {
    const inicio = m.index
    if (inicio > desde) trechos.push({ tipo: 'texto', texto: texto.slice(desde, inicio) })
    const [inteiro, negrito, rotulo, url] = m
    if (negrito !== undefined) trechos.push({ tipo: 'negrito', texto: negrito })
    else if (rotulo !== undefined && url !== undefined && URL_SEGURA.test(url)) trechos.push({ tipo: 'link', texto: rotulo, url })
    else trechos.push({ tipo: 'texto', texto: rotulo ?? inteiro })
    desde = inicio + inteiro.length
  }
  if (desde < texto.length) trechos.push({ tipo: 'texto', texto: texto.slice(desde) })
  return trechos
}

function lerTitulo(linha: string): Bloco | null {
  const m = TITULO.exec(linha)
  if (!m?.[1] || !m[2]) return null
  const nivel = m[1].length as 1 | 2 | 3
  return { tipo: 'titulo', nivel, ancora: ancora(m[2]), conteudo: lerEmLinha(m[2]) }
}

function lerLista(linhas: readonly string[]): Bloco | null {
  const ordenada = ITEM_NUMERADO.test(linhas[0] ?? '')
  const padrao = ordenada ? ITEM_NUMERADO : ITEM_SIMPLES
  if (!linhas.every((l) => padrao.test(l))) return null
  return { tipo: 'lista', ordenada, itens: linhas.map((l) => lerEmLinha(padrao.exec(l)?.[1] ?? '')) }
}

function lerBloco(linhas: readonly string[]): Bloco[] {
  const primeira = linhas[0] ?? ''
  const titulo = lerTitulo(primeira)
  if (titulo !== null) {
    return linhas.length === 1 ? [titulo] : [titulo, ...lerBloco(linhas.slice(1))]
  }
  return [lerLista(linhas) ?? { tipo: 'paragrafo', conteudo: lerEmLinha(linhas.join(' ')) }]
}

/** Blocos separados por linha em branco. Comentários HTML (<!-- -->) são descartados. */
export function lerMarkdown(md: string): Bloco[] {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((bloco) => bloco.split('\n').map((l) => l.trim()).filter((l) => l !== ''))
    .filter((linhas) => linhas.length > 0)
    .flatMap(lerBloco)
}
