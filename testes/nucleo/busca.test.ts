import { describe, expect, it } from 'vitest'
import {
  ehCep,
  escolhaDireta,
  filtrarResultados,
  MAX_ARQUIVOS_CONSULTA,
  normalizar,
  palavrasChave,
  prefixosConsulta,
  arquivoDaBusca,
} from '../../nucleo/busca.ts'
import { regrasBusca } from '../../nucleo/candidatura.ts'
import type { ItemBusca, RegrasBusca } from '../../nucleo/tipos.ts'
import { golden } from './golden.ts'

describe('normalizar (CONTRATO §5.1)', () => {
  it.each(golden.busca.normalizar)('"$entrada" → "$saida"', ({ entrada, saida }) => {
    expect(normalizar(entrada)).toBe(saida)
  })

  it('troca pontuação e símbolos não ASCII por espaço', () => {
    expect(normalizar('Conjunto “Nova Era” — Bloco 3')).toBe('conjunto nova era bloco 3')
    // NFKD decompõe "º" em "o"
    expect(normalizar('Nº 10\tSala\n2')).toBe('no 10 sala 2')
  })

  it('texto vazio ou só espaços vira vazio', () => {
    expect(normalizar('')).toBe('')
    expect(normalizar('  ,.;  ')).toBe('')
  })
})

describe('palavrasChave (CONTRATO §5.2)', () => {
  it('fica com as palavras longas que não são genéricas', () => {
    expect(palavrasChave('Jardim Botânico', regrasBusca)).toEqual(['botanico'])
    expect(palavrasChave('São José dos Pinhais', regrasBusca)).toEqual(['jose', 'pinhais'])
  })

  it('cai para ≥ minLetrasReserva quando não há palavra longa', () => {
    expect(palavrasChave('Vila Boa', regrasBusca)).toEqual(['boa'])
  })

  it('cai para todas com ≥ 3 quando só há genéricas', () => {
    expect(palavrasChave('Vila Nova', regrasBusca)).toEqual(['vila', 'nova'])
  })

  it('nome sem palavra de 3 letras não tem palavra-chave', () => {
    expect(palavrasChave('Jd A', regrasBusca)).toEqual([])
  })

  it('sem repetição', () => {
    expect(palavrasChave('Pinhais Pinhais', regrasBusca)).toEqual(['pinhais'])
  })
})

describe('arquivoDaBusca (CONTRATO §1): nome de dispositivo do Windows ganha "_"', () => {
  it.each(golden.busca.arquivos)('$prefixo → $arquivo.json', ({ prefixo, arquivo }) => {
    expect(arquivoDaBusca(prefixo)).toBe(arquivo)
  })
})

describe('prefixosConsulta (CONTRATO §5.4)', () => {
  it.each(golden.busca.prefixosConsulta)('"$entrada" → $prefixos', ({ entrada, prefixos }) => {
    expect(prefixosConsulta(entrada, regrasBusca)).toEqual(prefixos)
  })

  it('"bairro cidade" sem vírgula pede também o arquivo do bairro (não só o da palavra mais longa)', () => {
    // Antes: só jan.json / cur.json / bra.json, onde Tijuca, Batel e Asa Norte não estão.
    expect(prefixosConsulta('Tijuca Rio de Janeiro', regrasBusca)).toContain('tij')
    expect(prefixosConsulta('Batel Curitiba', regrasBusca)).toEqual(['bat', 'cur'])
    expect(prefixosConsulta('Asa Norte Brasília', regrasBusca)).toEqual(['asa', 'nor', 'bra'])
  })

  it('genéricas vão para o fim e o total fica no máximo', () => {
    const r = prefixosConsulta('Escola Estadual Professor Monteiro Lobato Bastos Curitiba', regrasBusca)
    expect(r).toEqual(['mon', 'lob', 'bas', 'cur'])
    expect(r).toHaveLength(MAX_ARQUIVOS_CONSULTA)
  })

  it('só o trecho antes da vírgula escolhe arquivo', () => {
    expect(prefixosConsulta('Batel, Curitiba', regrasBusca)).toEqual(['bat'])
  })

  it('texto sem palavra-chave não escolhe arquivo', () => {
    expect(prefixosConsulta('ab', regrasBusca)).toEqual([])
    expect(prefixosConsulta(', Curitiba', regrasBusca)).toEqual([])
  })

  it('respeita tamanhoPrefixo da configuração', () => {
    const regras: RegrasBusca = { ...regrasBusca, tamanhoPrefixo: 4 }
    expect(prefixosConsulta('São José dos Pinhais', regras)).toEqual(['jose', 'pinh', 'sao'])
  })
})

describe('ehCep (CONTRATO §5.5)', () => {
  it.each(golden.busca.cep)('"$entrada" → $arquivo / $chave', ({ entrada, arquivo, chave }) => {
    const r = ehCep(entrada)
    expect(r === null ? null : r.arquivo).toBe(arquivo)
    expect(r === null ? null : r.chave).toBe(chave)
  })

  it('tolera espaços nas pontas', () => {
    expect(ehCep(' 80010-000 ')).toEqual({ arquivo: '800', chave: '80010000' })
  })

  it('aceita o formato com ponto e com espaço', () => {
    expect(ehCep('80.010-000')).toEqual({ arquivo: '800', chave: '80010000' })
    expect(ehCep('80010 000')).toEqual({ arquivo: '800', chave: '80010000' })
  })

  it('rejeita CEP com letras ou dígitos a mais', () => {
    expect(ehCep('80010-0000')).toBeNull()
    expect(ehCep('8001O-000')).toBeNull()
  })
})

function item(p: Partial<ItemBusca> & Pick<ItemBusca, 'n'>): ItemBusca {
  return { t: 'b', uf: 'PR', lat: 0, lon: 0, e: 0, ...p }
}

describe('filtrarResultados (CONTRATO §5.4)', () => {
  const itens: ItemBusca[] = [
    item({ t: 'b', n: 'Jardim Botânico', m: 'Curitiba', uf: 'PR', e: 9000 }),
    item({ t: 'b', n: 'Jardim Botânico', m: 'Rio de Janeiro', uf: 'RJ', e: 20000 }),
    item({ t: 'm', n: 'Botuverá', uf: 'SC', e: 4000 }),
    item({ t: 'l', n: 'Escola Botânica Municipal', m: 'Curitiba', uf: 'PR', e: 30000 }),
    item({ t: 'b', n: 'Bota Fora', m: 'Curitiba', uf: 'PR', e: 100 }),
  ]

  it('casa todos os termos como prefixo e ordena por eleitorado', () => {
    const r = filtrarResultados(itens, 'jardim bot', regrasBusca)
    expect(r.map((i) => `${i.n}/${i.uf}`)).toEqual(['Jardim Botânico/RJ', 'Jardim Botânico/PR'])
  })

  it('depois da vírgula filtra pelo lugar (município ou UF)', () => {
    const r = filtrarResultados(itens, 'Jardim Botânico, Curitiba', regrasBusca)
    expect(r.map((i) => `${i.n}/${i.uf}`)).toEqual(['Jardim Botânico/PR'])
    expect(filtrarResultados(itens, 'Jardim Botânico, rj', regrasBusca).map((i) => i.uf)).toEqual(['RJ'])
  })

  it('nome exatamente igual ao texto vem primeiro', () => {
    const r = filtrarResultados(itens, 'Botuverá', regrasBusca)
    expect(r[0]?.n).toBe('Botuverá')
    const r2 = filtrarResultados(itens, 'jardim botanico', regrasBusca)
    expect(r2.map((i) => i.uf)).toEqual(['RJ', 'PR'])
  })

  it('empate total mantém a ordem do arquivo', () => {
    const lista = [item({ n: 'Pinhais', uf: 'PR', e: 5 }), item({ n: 'Pinhais', uf: 'SC', e: 5 })]
    expect(filtrarResultados(lista, 'pinhais', regrasBusca).map((i) => i.uf)).toEqual(['PR', 'SC'])
    expect(filtrarResultados([...lista].reverse(), 'pinhais', regrasBusca).map((i) => i.uf)).toEqual(['SC', 'PR'])
  })

  it('igualdade exata vence eleitorado maior', () => {
    const lista = [item({ n: 'Bota', e: 1 }), item({ n: 'Bota Fora', e: 999 })]
    expect(filtrarResultados(lista, 'bota', regrasBusca).map((i) => i.n)).toEqual(['Bota', 'Bota Fora'])
  })

  it('termo do 1º trecho pode casar com o município', () => {
    const r = filtrarResultados(itens, 'botan curitiba', regrasBusca)
    expect(r.map((i) => i.n)).toEqual(['Escola Botânica Municipal', 'Jardim Botânico'])
  })

  it('município (sem m) usa o próprio nome como lugar', () => {
    expect(filtrarResultados(itens, 'Botuverá, sc', regrasBusca).map((i) => i.n)).toEqual(['Botuverá'])
  })

  it('limita a maxResultados', () => {
    const muitos = Array.from({ length: 20 }, (_, k) => item({ n: `Pinhais ${k}`, e: k }))
    const r = filtrarResultados(muitos, 'pinhais', regrasBusca)
    expect(r).toHaveLength(regrasBusca.maxResultados)
    expect(r[0]?.e).toBe(19)
  })

  it('texto vazio não devolve nada', () => {
    expect(filtrarResultados(itens, '  ', regrasBusca)).toEqual([])
  })

  it('não muta a lista recebida', () => {
    const copia = [...itens]
    filtrarResultados(itens, 'bot', regrasBusca)
    expect(itens).toEqual(copia)
  })
})

describe('nome com a cidade, sem vírgula (CONTRATO §5.4)', () => {
  const itens: ItemBusca[] = [
    item({ t: 'l', n: 'Colégio Tijuca', m: 'Rio de Janeiro', uf: 'RJ', e: 90000 }),
    item({ t: 'b', n: 'Tijuca', m: 'Rio de Janeiro', uf: 'RJ', e: 5000 }),
    item({ t: 'b', n: 'Tijuca', m: 'Teresópolis', uf: 'RJ', e: 7000 }),
  ]

  it('"bairro cidade" casa o bairro e o põe em primeiro', () => {
    const r = filtrarResultados(itens, 'Tijuca Rio de Janeiro', regrasBusca)
    expect(r.map((i) => `${i.t}:${i.n}/${i.m ?? ''}`)).toEqual(['b:Tijuca/Rio de Janeiro', 'l:Colégio Tijuca/Rio de Janeiro'])
  })

  it('"município UF" conta como igual ao nome', () => {
    const lista = [item({ t: 'm', n: 'Curitibanos', uf: 'SC', e: 50 }), item({ t: 'm', n: 'Curitiba', uf: 'PR', e: 10 })]
    expect(filtrarResultados(lista, 'curitiba pr', regrasBusca)[0]?.n).toBe('Curitiba')
  })
})

describe('escolhaDireta', () => {
  const itens: ItemBusca[] = [
    item({ t: 'b', n: 'Água Verde', m: 'Curitiba', uf: 'PR', e: 9000 }),
    item({ t: 'l', n: 'Colégio Positivo (Água Verde)', m: 'Curitiba', uf: 'PR', e: 3000 }),
    item({ t: 'b', n: 'Água Verde', m: 'Blumenau', uf: 'SC', e: 2000 }),
    item({ t: 'm', n: 'Curitiba', uf: 'PR', e: 1_400_000 }),
    item({ t: 'm', n: 'Bom Jesus', uf: 'RS', e: 9000 }),
    item({ t: 'm', n: 'Bom Jesus', uf: 'PI', e: 9000 }),
  ]

  it('"bairro, cidade" com um só bairro de nome igual vai direto', () => {
    const r = filtrarResultados(itens, 'Água Verde, Curitiba', regrasBusca)
    expect(escolhaDireta(r, 'Água Verde, Curitiba')?.m).toBe('Curitiba')
  })

  it('"bairro cidade" sem vírgula também vai direto', () => {
    expect(escolhaDireta(itens, 'agua verde curitiba')?.m).toBe('Curitiba')
    expect(escolhaDireta(itens, 'Curitiba PR')?.n).toBe('Curitiba')
  })

  it('ambíguo ou só o nome: não vai direto (mostra a lista)', () => {
    expect(escolhaDireta(itens, 'Água Verde')).toBeNull()
    expect(escolhaDireta(itens, 'Curitiba')).toBeNull()
    expect(escolhaDireta(itens, 'Bom Jesus, b')).toBeNull()
    expect(escolhaDireta(itens, '  ')).toBeNull()
  })

  it('local de votação nunca vai direto', () => {
    expect(escolhaDireta(itens, 'Colégio Positivo (Água Verde), Curitiba')).toBeNull()
  })
})

describe('nome com apóstrofo', () => {
  const santana = item({ t: 'm', n: "Sant'Ana do Livramento", uf: 'RS', e: 59_664 })
  const dias = item({ t: 'm', n: "Dias d'Ávila", uf: 'BA', e: 50_000 })

  it('a grafia comum, sem apóstrofo, casa o nome', () => {
    expect(filtrarResultados([santana], 'Santana do Livramento', regrasBusca)).toEqual([santana])
    expect(filtrarResultados([dias], 'Dias Davila', regrasBusca)).toEqual([dias])
    expect(filtrarResultados([santana], "Sant'Ana do Livramento", regrasBusca)).toEqual([santana])
  })

  it('a grafia sem apóstrofo também conta como nome igual', () => {
    expect(escolhaDireta([santana], 'Santana do Livramento, RS')).toBe(santana)
    expect(escolhaDireta([dias], 'Dias Davila BA')).toBe(dias)
  })
})
