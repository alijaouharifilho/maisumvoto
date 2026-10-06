// As duas páginas da seção "Plano" (#/plano e #/comparar): links com cara de aba, a atual marcada com aria-current.
import { textos } from '../conteudo/textos.ts'
import { NOMES } from '../config.ts'
import { hrefDe } from '../rotas.ts'

type PaginaDoPlano = 'plano' | 'comparar'

const t = textos.paginas.abasPlano

const ABAS: readonly { readonly rota: PaginaDoPlano; readonly rotulo: string }[] = [
  { rota: 'plano', rotulo: t.propostas(NOMES.alvo) },
  { rota: 'comparar', rotulo: t.comparar },
]

export function AbasDoPlano({ atual }: { atual: PaginaDoPlano }) {
  return (
    <nav aria-label={t.rotulo}>
      {/* No celular, as duas abas lado a lado em metades iguais; a partir de 640 px, do tamanho do texto. */}
      <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {ABAS.map((a) => (
          <li key={a.rota}>
            <a
              href={hrefDe(a.rota)}
              aria-current={a.rota === atual ? 'page' : undefined}
              className="flex h-full min-h-11 items-center justify-center rounded-full border-2 border-linha px-3 py-2 text-center text-sm font-bold text-tinta no-underline hover:bg-papel-2 aria-[current=page]:border-mata aria-[current=page]:bg-mata-clara sm:px-4 sm:text-base"
            >
              {a.rotulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
