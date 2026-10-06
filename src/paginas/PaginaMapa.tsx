// Tela principal (#/mapa). Desktop (≥ 960 px): painel de 420–480 px com rolagem própria + mapa à direita.
// Celular: uma coluna, mapa (~46dvh) logo depois do resultado, Ficha em tela cheia.
// Acessibilidade: uma região viva sempre montada anuncia o ponto novo; depois da busca ou do GPS o foco vai para a
// manchete; com a Ficha aberta, o painel de baixo fica inert (fora do Tab e do leitor de tela).
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type Ref } from 'react'
import { textos } from '../conteudo/textos.ts'
import { Abertura } from '../componentes/Abertura.tsx'
import { Busca } from '../componentes/Busca.tsx'
import { Compartilhar } from '../componentes/Compartilhar.tsx'
import { Carregando, ErroDeDados, Vazio } from '../componentes/Estados.tsx'
import { LimiteDeErro } from '../componentes/LimiteDeErro.tsx'
import { Lista } from '../componentes/Lista.tsx'
import { Rodape } from '../componentes/Moldura.tsx'
import { Resultado } from '../componentes/Resultado.tsx'
import type { PontoEscolhido } from '../dados/buscar.ts'
import { useDados } from '../dados/contexto.ts'
import { useFaseAtual } from '../fase.ts'
import { EncaixeMapa, MapaSincronizado } from '../mapa/Mapa.tsx'
import { linkDoPonto } from '../util/link.ts'
import { menosMovimentoAgora, useDesktop } from '../util/midia.ts'
import { anuncioDoPonto } from '../util/textosDados.ts'
import { useFonteDensidade, useMarcadores, type EstadoMapa } from './estadoMapa.ts'

const Ficha = lazy(() => import('../componentes/ficha/Ficha.tsx').then((m) => ({ default: m.Ficha })))

type Props = { estado: EstadoMapa }

function BlocoDoPonto({ estado, aberta, indiceCarregando }: Props & { aberta: boolean; indiceCarregando: boolean }) {
  const { estado: estadoIndice } = useDados()
  const indice = estadoIndice.tipo === 'ok' ? estadoIndice.indice : null
  const { ponto, regioes } = estado
  if (ponto === null) return null
  if (regioes.tipo === 'carregando' || (regioes.tipo === 'ocioso' && indiceCarregando)) return <Carregando rotulo={textos.carregando.regioes} />
  if (regioes.tipo === 'erro') return <ErroDeDados tentando={false} onTentar={estado.tentarDeNovo} />
  if (regioes.tipo !== 'ok') return null
  const { resultado } = regioes
  if (resultado.metricas === null) return <Vazio semResultado={resultado.regioes.length > 0} />
  return <Resultado ponto={ponto} votos={resultado.total.votos} metricas={resultado.metricas} indice={indice} aberta={aberta} />
}

type Pendente = { readonly rolar: boolean; readonly focar: boolean }

/** Depois de buscar ou usar o GPS: no celular rola até o resultado (o mapa fica abaixo dele) e o foco vai para a
 *  manchete (o botão da sugestão sumiu e o foco iria para o body). Toque no mapa e link não movem o foco. */
function useLevarAoResultado(estado: EstadoMapa, desktop: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const pendente = useRef<Pendente | null>(null)
  const { escolher: escolherNoEstado } = estado
  const escolher = useCallback(
    (p: PontoEscolhido) => {
      pendente.current = { rolar: !desktop, focar: p.origem === 'busca' || p.origem === 'localizacao' }
      escolherNoEstado(p)
    },
    [desktop, escolherNoEstado],
  )
  useEffect(() => {
    const acao = pendente.current
    if (acao === null || (estado.regioes.tipo !== 'ok' && estado.regioes.tipo !== 'erro')) return
    pendente.current = null
    const bloco = ref.current
    if (acao.rolar) bloco?.scrollIntoView({ block: 'start', behavior: menosMovimentoAgora() ? 'auto' : 'smooth' })
    if (acao.focar) bloco?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }, [estado.regioes])
  return { ref, escolher }
}

function useMapaComFalha() {
  const [falhou, setFalhou] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const aoFalhar = useCallback(() => setFalhou(true), [])
  const tentarDeNovo = useCallback(() => {
    setFalhou(false)
    setTentativa((t) => t + 1)
  }, [])
  return { falhou, tentativa, aoFalhar, tentarDeNovo }
}

function Painel({ estado, refBloco, mapaFalhou, onTentarMapa, escolher, inerte }: {
  estado: EstadoMapa
  refBloco: Ref<HTMLDivElement>
  mapaFalhou: boolean
  onTentarMapa: () => void
  escolher: (p: PontoEscolhido) => void
  inerte: boolean
}) {
  const { carregador, estado: estadoIndice, tentarDeNovo } = useDados()
  const indice = estadoIndice.tipo === 'ok' ? estadoIndice.indice : null
  const { aberta } = useFaseAtual()
  const desktop = useDesktop()
  const resultado = estado.regioes.tipo === 'ok' ? estado.regioes.resultado : null
  const dica = estado.ponto === null && !mapaFalhou
  const ate = resultado?.metricas?.ate
  return (
    <div inert={inerte} className="relative flex flex-col gap-4 px-4 pt-3 lg:h-full lg:gap-6 lg:overflow-y-auto lg:pt-5">
      <Abertura indice={indice} />
      {estadoIndice.tipo === 'erro' ? <ErroDeDados tentando={estadoIndice.tentando} onTentar={tentarDeNovo} /> : null}
      {estadoIndice.tipo === 'carregando' ? <Carregando rotulo={textos.carregando.site} /> : null}
      <Busca carregador={carregador} onEscolher={escolher} versaoPonto={estado.versao} semMapa={mapaFalhou} />
      {estado.ponto === null ? null : (
        <div ref={refBloco} className="scroll-mt-[calc(var(--altura-cabecalho)+1rem)]">
          <BlocoDoPonto estado={estado} aberta={aberta} indiceCarregando={estadoIndice.tipo === 'carregando'} />
        </div>
      )}
      {desktop ? null : <EncaixeMapa className="-mx-4 h-[46dvh] min-h-64" dica={dica} falhou={mapaFalhou} onTentarDeNovo={onTentarMapa} />}
      {resultado !== null && resultado.lista.length > 0 ? (
        <Lista lista={resultado.lista} semResultado={resultado.semResultado} onAbrir={estado.selecionar} />
      ) : null}
      {aberta ? <Compartilhar link={linkDoPonto(window.location.origin, estado.ponto)} {...(ate === undefined ? {} : { ate })} /> : null}
      <Rodape />
    </div>
  )
}

export function PaginaMapa({ estado }: Props) {
  const { carregador, estado: estadoIndice } = useDados()
  const indice = estadoIndice.tipo === 'ok' ? estadoIndice.indice : null
  const { aberta } = useFaseAtual()
  const desktop = useDesktop()
  const mapa = useMapaComFalha()
  const { ref, escolher } = useLevarAoResultado(estado, desktop)
  const resultado = estado.regioes.tipo === 'ok' ? estado.regioes.resultado : null
  const marcadores = useMarcadores(estado.regioes)
  const densidade = useFonteDensidade(carregador, indice)
  const selecionada = resultado?.regioes.find((r) => r.id === estado.selecionada) ?? null
  const { selecionar } = estado
  const fecharFicha = useCallback(() => selecionar(null), [selecionar])
  const escolherNoMapa = useCallback((lat: number, lon: number) => escolher({ lat, lon, origem: 'mapa', rotulo: null }), [escolher])

  return (
    <div className="lg:grid lg:h-full lg:grid-cols-[minmax(420px,480px)_1fr]">
      <output className="sr-only">{anuncioDoPonto(estado.ponto, resultado, aberta)}</output>
      <div className="relative lg:h-full lg:min-h-0">
        <Painel estado={estado} refBloco={ref} mapaFalhou={mapa.falhou} onTentarMapa={mapa.tentarDeNovo} escolher={escolher} inerte={selecionada !== null} />
        {selecionada === null ? null : (
          <LimiteDeErro>
            <Suspense fallback={<Carregando rotulo={textos.acessibilidade.carregando} />}>
              <Ficha key={selecionada.id} regiao={selecionada} indice={indice} aberta={aberta} modal={!desktop} onFechar={fecharFicha} />
            </Suspense>
          </LimiteDeErro>
        )}
      </div>
      {desktop ? <EncaixeMapa className="h-full" dica={estado.ponto === null && !mapa.falhou} falhou={mapa.falhou} onTentarDeNovo={mapa.tentarDeNovo} /> : null}
      <MapaSincronizado
        ponto={estado.ponto}
        marcadores={marcadores}
        selecionada={estado.selecionada}
        densidade={densidade}
        cooperativo={!desktop}
        tentativa={mapa.tentativa}
        onEscolherPonto={escolherNoMapa}
        onAbrirRegiao={estado.selecionar}
        onFalha={mapa.aoFalhar}
      />
    </div>
  )
}
