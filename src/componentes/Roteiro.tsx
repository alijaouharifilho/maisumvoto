// Uma ficha de conversa (abstenção, branco, nulo...): frase-guia, contexto, passos, pontes com o plano e cuidados.
// Usada na página Conversa e dentro da Ficha da região (um nível de título abaixo).
import type { Citacao, FichaVoto, Ponte, RoteiroGeral } from '../conteudo/conteudo.ts'
import { linkPagina } from '../conteudo/conteudo.ts'
import { textos } from '../conteudo/textos.ts'

const t = textos.paginas

type Nivel = 2 | 3 | 4

function Titulo({ nivel, children, className = '' }: { nivel: Nivel; children: string; className?: string }) {
  const classe = `font-titulo font-bold ${className}`
  if (nivel === 2) return <h2 className={`text-xl ${classe}`}>{children}</h2>
  if (nivel === 3) return <h3 className={`text-lg ${classe}`}>{children}</h3>
  return <h4 className={`text-base ${classe}`}>{children}</h4>
}

function proximo(n: Nivel): Nivel {
  return n === 2 ? 3 : 4
}

export function CitacaoDoPlano({ citacao }: { citacao: Citacao }) {
  return (
    <figure className="flex flex-col gap-1 border-l-4 border-mata pl-3">
      <blockquote className="italic">“{citacao.trecho}”</blockquote>
      <figcaption className="text-sm">
        <a href={linkPagina(citacao.pagina)} target="_blank" rel="noopener noreferrer" className="inline-block py-1">
          {t.plano.pagina(citacao.pagina)}
          <span className="sr-only">
            {' '}
            {t.plano.paginaComplemento} {textos.acessibilidade.novaAba}
          </span>
        </a>
      </figcaption>
    </figure>
  )
}

function Pontes({ pontes, nivel }: { pontes: readonly Ponte[]; nivel: Nivel }) {
  return (
    <div className="flex flex-col gap-3">
      <Titulo nivel={nivel}>{t.prosa.pontes}</Titulo>
      {pontes.map((p) => (
        <div key={p.tema} className="flex flex-col gap-2 rounded-xl bg-petroleo-claro p-3">
          <p className="font-bold">{p.tema}</p>
          <p>{p.texto}</p>
          {p.citacoes.map((c) => (
            <CitacaoDoPlano key={`${c.pagina}-${c.trecho}`} citacao={c} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Passos({ passos, nivel }: { passos: readonly string[]; nivel: Nivel }) {
  return (
    <div className="flex flex-col gap-2">
      <Titulo nivel={nivel}>{t.prosa.passos}</Titulo>
      <ol className="list-decimal space-y-1 pl-6">
        {passos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
    </div>
  )
}

function Cuidados({ cuidados, nivel }: { cuidados: readonly string[]; nivel: Nivel }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-ambar-texto p-3">
      <Titulo nivel={nivel} className="text-ambar-texto">
        {t.prosa.cuidados}
      </Titulo>
      <ul className="list-disc space-y-1 pl-6">
        {cuidados.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  )
}

/** Conteúdo de uma ficha de voto; o título fica com quem chama (página ou <summary> da Ficha). */
export function CorpoDoRoteiro({ ficha, nivel }: { ficha: FichaVoto; nivel: Nivel }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-titulo text-lg font-bold text-mata">{ficha.fraseGuia}</p>
      {ficha.contexto.map((c) => (
        <p key={c}>{c}</p>
      ))}
      <Passos passos={ficha.passos} nivel={nivel} />
      {ficha.pontes.length > 0 ? <Pontes pontes={ficha.pontes} nivel={nivel} /> : null}
      <Cuidados cuidados={ficha.cuidados} nivel={nivel} />
    </div>
  )
}

export function RoteiroGeralDaConversa({ geral, nivel }: { geral: RoteiroGeral; nivel: Nivel }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-titulo text-lg font-bold text-mata">{geral.fraseGuia}</p>
      <Passos passos={geral.passos} nivel={proximo(nivel)} />
      <Cuidados cuidados={geral.cuidados} nivel={proximo(nivel)} />
    </div>
  )
}
