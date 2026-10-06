// Pontos compactos (CONTRATO §2.3): pares [Δlat, Δlon] inteiros, acumulados e divididos pela escala.
import type { PontosCompactos } from './tipos.ts'

export function decodificarPontos(p: PontosCompactos): [lat: number, lon: number][] {
  if (!(p.escala > 0)) throw new RangeError(`escala precisa ser positiva (recebeu ${p.escala})`)
  if (p.d.length % 2 !== 0) throw new RangeError(`d precisa ter pares [Δlat, Δlon] (tamanho ${p.d.length})`)
  const saida: [number, number][] = []
  let la = 0
  let lo = 0
  for (const [i, delta] of p.d.entries()) {
    if (i % 2 === 0) {
      la += delta
    } else {
      lo += delta
      saida.push([la / p.escala, lo / p.escala])
    }
  }
  return saida
}
