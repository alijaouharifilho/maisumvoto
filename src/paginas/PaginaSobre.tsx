// #/sobre (e #/sobre/privacidade): Sobre e Aviso de privacidade, a partir dos .md do conteúdo.
import { useMemo } from 'react'
import { markdown } from '../conteudo/conteudo.ts'
import { lerMarkdown } from '../conteudo/markdown.ts'
import { preencherModelo } from '../conteudo/modelo.ts'
import { Rodape } from '../componentes/Moldura.tsx'
import { candidatura } from '../config.ts'
import { textos } from '../conteudo/textos.ts'
import { useRolarParaAncora } from '../rotas.ts'
import { Markdown } from './Markdown.tsx'
import { useValoresModelo } from './valores.ts'

const idDaAncora = (ancora: string): string => ancora

export function PaginaSobre({ ancora }: { ancora: string | null }) {
  const valores = useValoresModelo()
  const sobre = useMemo(() => lerMarkdown(preencherModelo(markdown.sobre, valores)), [valores])
  const privacidade = useMemo(() => lerMarkdown(preencherModelo(markdown.privacidade, valores)), [valores])
  useRolarParaAncora(ancora, idDaAncora)
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <Markdown blocos={sobre} />
      <hr className="my-6 border-linha" />
      <Markdown blocos={privacidade} deslocamento={1} />
      <p className="mt-4 text-xs text-tinta-suave">{textos.paginas.sobre.responsavel(candidatura.site.responsavel)}</p>
      <Rodape />
    </article>
  )
}
