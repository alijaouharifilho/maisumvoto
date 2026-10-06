// Cartão de conversa de uma proposta do plano: o que é, em uma frase; um número com fonte; por que faz sentido;
// uma pergunta para puxar o assunto (com botão de copiar); o cuidado ao falar; e, recolhido, o trecho literal com a página.
import { useId, useState } from 'react'
import type { DadoDoCartao, Proposta } from '../conteudo/conteudo.ts'
import { textos } from '../conteudo/textos.ts'
import { CitacaoDoPlano } from './Roteiro.tsx'

const t = textos.paginas.plano

type EstadoCopia = 'parado' | 'copiado' | 'falhou'

function Numero({ dado }: { dado: DadoDoCartao }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border-l-4 border-mata bg-branco p-3">
      <p>
        <strong className="numeros block text-3xl font-extrabold text-mata-escura">{dado.numero}</strong>
        {dado.frase}
      </p>
      <p className="text-sm text-tinta-suave">
        {t.fonte}{' '}
        <a href={dado.url} target="_blank" rel="noopener noreferrer">
          {dado.fonte}
          <span className="sr-only"> {textos.acessibilidade.novaAba}</span>
        </a>
        {` (${dado.ano})`}
      </p>
    </div>
  )
}

// Navegador embutido de app (o do WhatsApp, por exemplo) costuma não liberar a API de área de transferência:
// cai no jeito antigo (textarea selecionado + execCommand), que esses navegadores ainda aceitam.
function copiarPeloJeitoAntigo(texto: string): boolean {
  if (typeof document.execCommand !== 'function') return false
  const campo = document.createElement('textarea')
  campo.value = texto
  campo.setAttribute('readonly', '')
  campo.style.position = 'fixed'
  campo.style.opacity = '0'
  document.body.append(campo)
  campo.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    campo.remove()
  }
}

async function copiarTexto(texto: string): Promise<EstadoCopia> {
  try {
    if (navigator.clipboard === undefined) throw new Error('sem API de área de transferência')
    await navigator.clipboard.writeText(texto)
    return 'copiado'
  } catch {
    return copiarPeloJeitoAntigo(texto) ? 'copiado' : 'falhou'
  }
}

const AVISO_COPIA: Record<EstadoCopia, string> = { parado: '', copiado: t.copiado, falhou: t.copiaFalhou }

function ParaPuxar({ pergunta }: { pergunta: string }) {
  const [estado, setEstado] = useState<EstadoCopia>('parado')
  const idPergunta = useId()
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-petroleo-claro p-3">
      <p className="font-bold">{t.paraPuxar}</p>
      <p id={idPergunta} className="text-lg">
        “{pergunta}”
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="botao botao-secundario"
          aria-describedby={idPergunta}
          onClick={() => void copiarTexto(pergunta).then(setEstado)}
        >
          {t.copiar}
        </button>
        <output className="text-sm">{AVISO_COPIA[estado]}</output>
      </div>
    </div>
  )
}

export function CartaoDoPlano({ proposta }: { proposta: Proposta }) {
  const idTitulo = useId()
  return (
    <article aria-labelledby={idTitulo} className="cartao flex flex-col gap-3">
      <h3 id={idTitulo} className="font-titulo text-xl font-bold">
        {proposta.titulo}
      </h3>
      <p className="text-lg">{proposta.emUmaFrase}</p>
      {proposta.dado === null ? null : <Numero dado={proposta.dado} />}
      <div className="flex flex-col gap-1">
        <p className="font-bold">{t.porQue}</p>
        <p>{proposta.porQue}</p>
      </div>
      <ParaPuxar pergunta={proposta.paraPuxar} />
      {proposta.cuidado === undefined ? null : (
        <p className="rounded-xl border-2 border-ambar-texto p-3 text-sm">
          <strong>{t.cuidado}</strong> {proposta.cuidado}
        </p>
      )}
      <details className="rounded-xl border border-tinta-suave p-3">
        <summary className="font-bold">{t.oQueOPlanoDiz(proposta.pagina)}</summary>
        <div className="mt-2">
          <CitacaoDoPlano citacao={proposta} />
        </div>
      </details>
    </article>
  )
}
