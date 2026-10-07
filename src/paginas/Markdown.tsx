// Monta os blocos de lerMarkdown como elementos React (nunca HTML pronto: não há como injetar marcação).
import type { Bloco, Trecho } from '../conteudo/markdown.ts'
import { textos } from '../conteudo/textos.ts'

function TrechoEmLinha({ trecho }: { trecho: Trecho }) {
  if (trecho.tipo === 'negrito') return <strong>{trecho.texto}</strong>
  if (trecho.tipo === 'texto') return <>{trecho.texto}</>
  if (trecho.url.startsWith('#')) return <a href={trecho.url}>{trecho.texto}</a>
  return (
    <a href={trecho.url} target="_blank" rel="noopener noreferrer">
      {trecho.texto}
      <span className="sr-only"> {textos.acessibilidade.novaAba}</span>
    </a>
  )
}

function Trechos({ trechos }: { trechos: readonly Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) => (
        // Trechos não mudam de ordem: o índice basta como chave.
        <TrechoEmLinha key={i} trecho={t} />
      ))}
    </>
  )
}

/** deslocamento: quanto descer o nível dos títulos (a Privacidade vira seção da página Sobre). */
function Titulo({ bloco, deslocamento }: { bloco: Extract<Bloco, { tipo: 'titulo' }>; deslocamento: number }) {
  const nivel = Math.min(4, bloco.nivel + deslocamento)
  const props = { id: bloco.ancora, tabIndex: -1, className: 'font-titulo font-bold' }
  const conteudo = <Trechos trechos={bloco.conteudo} />
  if (nivel === 1) return <h1 {...props} className={`${props.className} text-3xl`}>{conteudo}</h1>
  if (nivel === 2) return <h2 {...props} className={`${props.className} mt-4 text-2xl`}>{conteudo}</h2>
  if (nivel === 3) return <h3 {...props} className={`${props.className} mt-2 text-xl`}>{conteudo}</h3>
  return <h4 {...props} className={`${props.className} text-lg`}>{conteudo}</h4>
}

export function Markdown({ blocos, deslocamento = 0 }: { blocos: readonly Bloco[]; deslocamento?: number }) {
  return (
    <>
      {blocos.map((b, i) => {
        if (b.tipo === 'titulo') return <Titulo key={i} bloco={b} deslocamento={deslocamento} />
        if (b.tipo === 'paragrafo')
          return (
            <p key={i}>
              <Trechos trechos={b.conteudo} />
            </p>
          )
        const Lista = b.ordenada ? 'ol' : 'ul'
        return (
          <Lista key={i} className={`${b.ordenada ? 'list-decimal' : 'list-disc'} space-y-1 pl-6`}>
            {b.itens.map((item, j) => (
              <li key={j}>
                <Trechos trechos={item} />
              </li>
            ))}
          </Lista>
        )
      })}
    </>
  )
}
