// Escolha do ponto: busca local (bairro, cidade, local de votação ou CEP), GPS só no clique, ou toque no mapa.
// Resposta atrasada (busca lenta no 4G, GPS esperando permissão) nunca troca um ponto escolhido depois dela.
// Os botões ficam aria-disabled (e não disabled) enquanto esperam: disabled tira o foco do botão e o joga no body.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { ItemBusca } from '../../nucleo/tipos.ts'
import { textos } from '../conteudo/textos.ts'
import { regrasBusca } from '../config.ts'
import type { Carregador } from '../dados/carregar.ts'
import { pontoDoItem, resolverBusca, type PontoEscolhido, type RespostaBusca } from '../dados/buscar.ts'
import { rotuloItemBusca } from '../util/formatar.ts'

const t = textos.busca

const OPCOES_GPS: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }

type Estado =
  | { readonly tipo: 'parado' }
  | { readonly tipo: 'buscando' }
  | { readonly tipo: 'localizando' }
  | { readonly tipo: 'opcoes'; readonly itens: readonly ItemBusca[] }
  | { readonly tipo: 'erro'; readonly mensagem: string }

type Props = {
  carregador: Carregador
  onEscolher: (p: PontoEscolhido) => void
  /** Versão do ponto atual (EstadoMapa.versao): muda quando outro ponto é escolhido por qualquer caminho. */
  versaoPonto: number
  /** Sem mapa (não carregou): a dica "ou toque no mapa" some. */
  semMapa?: boolean
}

function ehAbortado(erro: unknown): boolean {
  return erro instanceof DOMException && erro.name === 'AbortError'
}

function estadoDaResposta(r: Exclude<RespostaBusca, { tipo: 'ponto' }>): Estado {
  if (r.tipo === 'opcoes') return { tipo: 'opcoes', itens: r.itens }
  if (r.tipo === 'curto') return { tipo: 'erro', mensagem: t.erros.curto(regrasBusca.tamanhoPrefixo) }
  if (r.tipo === 'cepNaoEncontrado') return { tipo: 'erro', mensagem: t.erros.cepNaoEncontrado }
  return { tipo: 'erro', mensagem: t.erros.nadaEncontrado }
}

/** Pedidos em andamento (busca e GPS). Cancelar invalida os dois: a resposta que chegar depois é descartada. */
function usePedidos(versaoPonto: number, aoCancelar: () => void) {
  const pedido = useRef<AbortController | null>(null)
  const gps = useRef(0)
  const versao = useRef(versaoPonto)
  const cancelar = (): void => {
    pedido.current?.abort()
    gps.current += 1
  }
  useEffect(() => () => {
    pedido.current?.abort()
    gps.current += 1
  }, [])
  const cancelarAtual = useRef(aoCancelar)
  useEffect(() => {
    cancelarAtual.current = aoCancelar
  })
  // Outro ponto escolhido (toque no mapa, link colado) enquanto a busca ou o GPS esperam.
  useEffect(() => {
    if (versao.current === versaoPonto) return
    versao.current = versaoPonto
    pedido.current?.abort()
    gps.current += 1
    cancelarAtual.current()
  }, [versaoPonto])
  const novaBusca = (): AbortController => {
    cancelar()
    const controle = new AbortController()
    pedido.current = controle
    return controle
  }
  const novoGps = (): (() => boolean) => {
    cancelar()
    const meu = gps.current
    return () => meu === gps.current
  }
  return { novaBusca, novoGps }
}

function useBusca(carregador: Carregador, onEscolher: (p: PontoEscolhido) => void, versaoPonto: number) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'parado' })
  const parar = (): void => setEstado((e) => (e.tipo === 'buscando' || e.tipo === 'localizando' ? { tipo: 'parado' } : e))
  const { novaBusca, novoGps } = usePedidos(versaoPonto, parar)

  const escolher = (p: PontoEscolhido): void => {
    setEstado({ tipo: 'parado' })
    onEscolher(p)
  }

  async function buscar(texto: string): Promise<void> {
    const controle = novaBusca()
    setEstado({ tipo: 'buscando' })
    try {
      const r = await resolverBusca(carregador, texto, regrasBusca, controle.signal)
      if (controle.signal.aborted) return
      if (r.tipo === 'ponto') escolher(r.ponto)
      else setEstado(estadoDaResposta(r))
    } catch (erro) {
      if (ehAbortado(erro) || controle.signal.aborted) return
      console.error('Busca falhou', erro)
      setEstado({ tipo: 'erro', mensagem: t.erros.falhaBusca })
    }
  }

  function usarLocalizacao(): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setEstado({ tipo: 'erro', mensagem: t.erros.localizacaoIndisponivel })
      return
    }
    const valendo = novoGps()
    setEstado({ tipo: 'localizando' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (valendo()) escolher({ lat: pos.coords.latitude, lon: pos.coords.longitude, origem: 'localizacao', rotulo: null })
      },
      () => {
        if (valendo()) setEstado({ tipo: 'erro', mensagem: t.erros.localizacaoNegada })
      },
      OPCOES_GPS,
    )
  }

  return { estado, buscar, usarLocalizacao, escolherItem: (item: ItemBusca) => escolher(pontoDoItem(item)) }
}

export function Busca({ carregador, onEscolher, versaoPonto, semMapa = false }: Props) {
  const [texto, setTexto] = useState('')
  const { estado, buscar, usarLocalizacao, escolherItem } = useBusca(carregador, onEscolher, versaoPonto)
  const id = useId()
  const ocupado = estado.tipo === 'buscando' || estado.tipo === 'localizando'
  const enviar = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (!ocupado) void buscar(texto)
  }
  const localizar = (): void => {
    if (!ocupado) usarLocalizacao()
  }

  return (
    <section aria-labelledby={`${id}-rotulo`} className="flex flex-col overflow-hidden rounded-2xl border border-linha bg-branco">
      <search>
      <form onSubmit={enviar} className="flex flex-col">
        <label id={`${id}-rotulo`} htmlFor={`${id}-campo`} className="sobre-azul block bg-marca px-4 py-3 font-titulo text-lg font-extrabold">
          {t.rotulo}
        </label>
        <div className="flex gap-2 px-4 pt-4">
          <input
            id={`${id}-campo`}
            type="search"
            className="campo min-w-0 flex-1"
            placeholder={t.placeholder}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            aria-describedby={estado.tipo === 'erro' ? `${id}-erro` : undefined}
          />
          <button type="submit" className="botao botao-destaque" aria-disabled={ocupado}>
            {estado.tipo === 'buscando' ? t.buscando : t.buscar}
          </button>
        </div>
      </form>
      </search>
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" className="botao botao-secundario" onClick={localizar} aria-disabled={ocupado}>
            {estado.tipo === 'localizando' ? t.localizando : t.minhaLocalizacao}
          </button>
          {semMapa ? null : <span className="text-tinta-suave">{t.dica}</span>}
        </div>
        <Retorno idErro={`${id}-erro`} estado={estado} onEscolher={escolherItem} />
      </div>
    </section>
  )
}

/** Abaixo da busca: o erro (role=alert, ligado ao campo por aria-describedby) ou as sugestões. */
function Retorno({ idErro, estado, onEscolher }: { idErro: string; estado: Estado; onEscolher: (item: ItemBusca) => void }) {
  if (estado.tipo === 'erro') {
    return (
      <p id={idErro} role="alert" className="font-bold text-alerta">
        {estado.mensagem}
      </p>
    )
  }
  return estado.tipo === 'opcoes' ? <Opcoes itens={estado.itens} onEscolher={onEscolher} /> : null
}

function Opcoes({ itens, onEscolher }: { itens: readonly ItemBusca[]; onEscolher: (item: ItemBusca) => void }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <output id={id} className="block font-bold">
        {t.sugestoes(itens.length)}
      </output>
      <ul aria-labelledby={id} className="flex flex-col gap-1">
        {itens.map((item) => (
          <li key={`${item.t}|${item.n}|${item.m ?? ''}|${item.uf}|${item.lat}|${item.lon}`}>
            <button
              type="button"
              className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-marca underline hover:bg-marca-clara"
              onClick={() => onEscolher(item)}
            >
              {rotuloItemBusca(item)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
