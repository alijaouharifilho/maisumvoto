// Compartilhar por WhatsApp (wa.me, iniciado pelo próprio usuário), com a regra de consentimento à vista.
// A mensagem não leva dado pessoal: só o número público do ponto e o link arredondado à grade.
import { useId } from 'react'
import { textos } from '../conteudo/textos.ts'
import { NOMES, NOME_SITE } from '../config.ts'
import { hrefWhatsApp } from '../util/link.ts'

const t = textos.compartilhar

type Props = {
  /** Endereço com o ponto arredondado, ou a raiz do site sem ponto. */
  link: string
  /** "Até" do ponto do link; omitido sem ponto ou enquanto calcula. */
  ate?: number
}

export function Compartilhar({ link, ate }: Props) {
  const id = useId()
  const mensagem = t.mensagem({ nomeSite: NOME_SITE, alvo: NOMES.alvo, link, ...(ate === undefined ? {} : { ate }) })
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-2xl bg-mata-clara p-4">
      <h2 id={id} className="font-titulo text-xl font-bold">
        {t.titulo}
      </h2>
      <p>{t.texto}</p>
      <ol className="list-decimal space-y-1 pl-6">
        {t.passos.map((passo) => (
          <li key={passo}>{passo}</li>
        ))}
      </ol>
      <p className="rounded-xl border-2 border-mata bg-papel p-3 text-sm font-bold">{t.regra}</p>
      <a className="botao botao-primario self-start no-underline" href={hrefWhatsApp(mensagem)} target="_blank" rel="noopener noreferrer">
        {t.botao}
        <span className="sr-only"> {textos.acessibilidade.novaAba}</span>
      </a>
    </section>
  )
}
