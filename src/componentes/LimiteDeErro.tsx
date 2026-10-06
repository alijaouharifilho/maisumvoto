// ErrorBoundary: uma tela quebrada vira um aviso com botão de recarregar, nunca uma página em branco.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { textos } from '../conteudo/textos.ts'
import { pareceFalhaDeVersao } from '../recuperacao.ts'

type Props = { children: ReactNode }
type Estado = { erro: unknown; temErro: boolean }

export class LimiteDeErro extends Component<Props, Estado> {
  override state: Estado = { erro: null, temErro: false }

  static getDerivedStateFromError(erro: unknown): Estado {
    return { erro, temErro: true }
  }

  override componentDidCatch(erro: unknown, info: ErrorInfo): void {
    console.error('Erro de tela', erro, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.temErro) return this.props.children
    const versao = pareceFalhaDeVersao(this.state.erro)
    return (
      <div role="alert" className="cartao m-4 flex flex-col items-start gap-3">
        <p className="font-bold">{versao ? textos.sistema.versaoNova : textos.sistema.erroTela}</p>
        <button type="button" className="botao botao-primario" onClick={() => window.location.reload()}>
          {textos.sistema.recarregar}
        </button>
      </div>
    )
  }
}
