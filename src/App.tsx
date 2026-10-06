// Moldura do site e roteamento por hash. Conversa, Plano, Comparar, Sobre e a Ficha são carregados sob demanda.
import { lazy, Suspense, useEffect, useRef } from 'react'
import { textos } from './conteudo/textos.ts'
import { Carregando } from './componentes/Estados.tsx'
import { LimiteDeErro } from './componentes/LimiteDeErro.tsx'
import { AvisoVersaoNova, Cabecalho, DiaDaVotacao, FaixaDeFase, Rodape } from './componentes/Moldura.tsx'
import { ID_CONTEUDO, NOME_SITE, NOMES } from './config.ts'
import { useDados } from './dados/contexto.ts'
import { ContextoFase } from './fase.ts'
import { useEstadoMapa, type EstadoMapa } from './paginas/estadoMapa.ts'
import { PaginaMapa } from './paginas/PaginaMapa.tsx'
import { useVersaoNova } from './recuperacao.ts'
import { useFase } from './relogio.ts'
import { useRota, type EstadoRota } from './rotas.ts'
import type { Rota } from '../nucleo/link.ts'
import type { IdFase } from '../nucleo/tipos.ts'

const PaginaProsa = lazy(() => import('./paginas/PaginaProsa.tsx').then((m) => ({ default: m.PaginaProsa })))
const PaginaPlano = lazy(() => import('./paginas/PaginaPlano.tsx').then((m) => ({ default: m.PaginaPlano })))
const PaginaComparar = lazy(() => import('./paginas/PaginaComparar.tsx').then((m) => ({ default: m.PaginaComparar })))
const PaginaSobre = lazy(() => import('./paginas/PaginaSobre.tsx').then((m) => ({ default: m.PaginaSobre })))

/** Título da aba por página: quem usa leitor de tela ouve a página nova ao trocar pelo menu. */
function tituloDaRota(rota: Rota): string {
  const p = textos.paginas
  if (rota === 'mapa') return textos.meta.titulo(NOME_SITE)
  const pagina = { prosa: p.prosa.titulo, plano: p.plano.titulo(NOMES.alvo), comparar: p.comparar.titulo, sobre: p.sobre.titulo }[rota]
  return `${pagina} · ${NOME_SITE}`
}

/** Troca de página (não a primeira carga): título novo e foco no conteúdo, que o menu deixava no próprio link.
 *  Com âncora (#/sobre/privacidade, ponto do mapa), quem cuida do foco é a página. */
function useTituloEFoco(rota: EstadoRota): void {
  const primeira = useRef(true)
  const ancora = useRef(rota.ancora)
  useEffect(() => {
    ancora.current = rota.ancora
  })
  useEffect(() => {
    document.title = tituloDaRota(rota.rota)
    if (primeira.current) {
      primeira.current = false
      return
    }
    if (ancora.current === null) document.getElementById(ID_CONTEUDO)?.focus({ preventScroll: true })
  }, [rota.rota])
}

type PropsConteudo = { rota: EstadoRota; fase: IdFase; estadoMapa: EstadoMapa }

function VotacaoHoje() {
  return (
    <>
      <DiaDaVotacao />
      <div className="mx-auto max-w-2xl px-4">
        <Rodape />
      </div>
    </>
  )
}

/** No dia da votação, mapa e roteiros dão lugar ao aviso estático: nada de orientação de abordagem. */
function Conteudo({ rota, fase, estadoMapa }: PropsConteudo) {
  const votacao = fase === 'votacao'
  if (rota.rota === 'mapa') return votacao ? <VotacaoHoje /> : <PaginaMapa estado={estadoMapa} />
  if (rota.rota === 'prosa') return votacao ? <VotacaoHoje /> : <PaginaProsa ancora={rota.ancora} />
  if (rota.rota === 'plano') return <PaginaPlano ancora={rota.ancora} />
  if (rota.rota === 'comparar') return <PaginaComparar ancora={rota.ancora} />
  return <PaginaSobre ancora={rota.ancora} />
}

export function App() {
  const rota = useRota()
  useTituloEFoco(rota)
  const fase = useFase()
  const { carregador, estado } = useDados()
  const estadoMapa = useEstadoMapa(carregador, estado.tipo === 'ok' ? estado.indice : null, rota)
  const versaoNova = useVersaoNova()
  // No desktop, a tela do mapa ocupa exatamente a janela (painel e mapa rolam por dentro); as outras páginas rolam normal.
  const telaCheia = rota.rota === 'mapa' && fase.fase !== 'votacao'
  return (
    <ContextoFase.Provider value={fase}>
      <div className={`flex min-h-dvh flex-col ${telaCheia ? 'lg:h-dvh lg:min-h-0' : ''}`}>
        <Cabecalho rota={rota.rota} />
        {versaoNova ? <AvisoVersaoNova /> : null}
        <FaixaDeFase fase={fase.fase} />
        <main id={ID_CONTEUDO} tabIndex={-1} className="flex-1 outline-none lg:min-h-0">
          <LimiteDeErro key={rota.rota}>
            <Suspense fallback={<Esperando />}>
              <Conteudo rota={rota} fase={fase.fase} estadoMapa={estadoMapa} />
            </Suspense>
          </LimiteDeErro>
        </main>
      </div>
    </ContextoFase.Provider>
  )
}

function Esperando() {
  return (
    <div className="p-4">
      <Carregando rotulo={textos.acessibilidade.carregando} />
    </div>
  )
}
