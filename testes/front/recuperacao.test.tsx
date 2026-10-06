// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { textos } from '../../src/conteudo/textos.ts'
import { LimiteDeErro } from '../../src/componentes/LimiteDeErro.tsx'
import { aoFalharPreload, houveVersaoNova, pareceFalhaDeVersao } from '../../src/recuperacao.ts'

afterEach(cleanup)

function Quebra(): never {
  throw new Error('quebrou')
}

describe('recuperação depois de um deploy', () => {
  it('pedaço de JS sumido: recarrega uma vez; se falhar de novo em seguida, avisa em vez de insistir', () => {
    window.sessionStorage.clear()
    const recarregar = vi.fn()
    const primeiro = new Event('vite:preloadError', { cancelable: true })
    aoFalharPreload(primeiro, 1_000_000, recarregar)
    expect(recarregar).toHaveBeenCalledTimes(1)
    expect(primeiro.defaultPrevented).toBe(true)
    expect(houveVersaoNova()).toBe(false)

    const segundo = new Event('vite:preloadError', { cancelable: true })
    aoFalharPreload(segundo, 1_030_000, recarregar)
    expect(recarregar).toHaveBeenCalledTimes(1)
    expect(segundo.defaultPrevented).toBe(false)
    expect(houveVersaoNova()).toBe(true)
  })

  it('enquanto recarrega por preloadError, o TypeError do import que voltou vazio conta como versão nova', async () => {
    vi.resetModules()
    const rec = await import('../../src/recuperacao.ts')
    window.sessionStorage.clear()
    const erro = new TypeError("Cannot read properties of undefined (reading 'PaginaProsa')")
    expect(rec.pareceFalhaDeVersao(erro)).toBe(false)
    rec.aoFalharPreload(new Event('vite:preloadError', { cancelable: true }), 5_000_000, () => undefined)
    expect(rec.pareceFalhaDeVersao(erro)).toBe(true)
  })

  it('reconhece a mensagem típica de módulo dinâmico que não carregou', () => {
    expect(pareceFalhaDeVersao(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true)
  })

  it('tela quebrada vira aviso com botão de recarregar, nunca página em branco', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <LimiteDeErro>
        <Quebra />
      </LimiteDeErro>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: textos.sistema.recarregar })).toBeTruthy()
  })
})
