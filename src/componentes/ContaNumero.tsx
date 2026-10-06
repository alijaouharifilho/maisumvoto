// Número que conta do valor anterior até o novo (900 ms, curva 1 − (1−t)⁴).
// Sem animação sob "menos movimento" ou quando o valor não muda; na primeira vez parte do zero
// só se for animar (não pisca o valor final antes de começar).
import { useEffect, useRef, useState } from 'react'
import { formatarNumero } from '../../nucleo/frases.ts'
import { useMenosMovimento } from '../util/midia.ts'

const DURACAO_MS = 900

type Props = { valor: number; className?: string }

function suavizar(t: number): number {
  return 1 - (1 - t) ** 4
}

export function ContaNumero({ valor, className }: Props) {
  const menosMovimento = useMenosMovimento()
  const [mostrado, setMostrado] = useState(() => (menosMovimento ? valor : 0))
  const anterior = useRef(menosMovimento ? valor : 0)

  useEffect(() => {
    const de = anterior.current
    anterior.current = valor
    if (menosMovimento || de === valor) {
      setMostrado(valor)
      return
    }
    let quadro = 0
    const inicio = performance.now()
    const passo = (agora: number): void => {
      const t = Math.min(1, (agora - inicio) / DURACAO_MS)
      setMostrado(Math.round(de + (valor - de) * suavizar(t)))
      if (t < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [valor, menosMovimento])

  // Leitor de tela ouve só o valor final, não cada quadro da contagem.
  return (
    <>
      <span className={className} aria-hidden="true">
        {formatarNumero(mostrado)}
      </span>
      <span className="sr-only">{formatarNumero(valor)}</span>
    </>
  )
}
