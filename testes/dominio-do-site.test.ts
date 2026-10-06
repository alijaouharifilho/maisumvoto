// Domínio das tags de prévia do index.html: o de produção na Vercel, o da configuração fora dela.
import { describe, expect, it } from 'vitest'
import { aplicarDominio, dominioDoSite, MARCADOR_DOMINIO } from '../ferramentas/dominio-do-site.ts'

describe('dominioDoSite', () => {
  it('na Vercel, usa o domínio de produção do projeto (sem protocolo)', () => {
    expect(dominioDoSite({ VERCEL_PROJECT_PRODUCTION_URL: 'maisumvoto.vercel.app' }, 'maisumvoto.com.br')).toBe('maisumvoto.vercel.app')
    expect(dominioDoSite({ VERCEL_PROJECT_PRODUCTION_URL: ' maisumvoto.com.br ' }, 'x.example')).toBe('maisumvoto.com.br')
  })

  it('fora da Vercel (ou variável vazia), usa o domínio da configuração', () => {
    expect(dominioDoSite({}, 'maisumvoto.com.br')).toBe('maisumvoto.com.br')
    expect(dominioDoSite({ VERCEL_PROJECT_PRODUCTION_URL: '' }, 'maisumvoto.com.br')).toBe('maisumvoto.com.br')
  })

  it('recusa valor que não é domínio (falha o build em vez de publicar prévia quebrada)', () => {
    expect(() => dominioDoSite({ VERCEL_PROJECT_PRODUCTION_URL: 'https://a.b/' }, 'x')).toThrow(/inválido/)
    expect(() => dominioDoSite({}, 'tem espaço.com')).toThrow(/inválido/)
  })
})

describe('aplicarDominio', () => {
  it('troca todas as ocorrências do marcador', () => {
    const html = `<meta property="og:url" content="https://${MARCADOR_DOMINIO}/" /><meta content="https://${MARCADOR_DOMINIO}/og.png" />`
    const saida = aplicarDominio(html, 'maisumvoto.vercel.app')
    expect(saida).not.toContain(MARCADOR_DOMINIO)
    expect(saida).toContain('https://maisumvoto.vercel.app/og.png')
    expect(saida).toContain('content="https://maisumvoto.vercel.app/"')
  })
})
