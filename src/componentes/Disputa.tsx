// Como foi a disputa entre os dois finalistas, pela classificação do núcleo (CONTRATO §3).
import type { Derivadas } from '../../nucleo/metricas.ts'
import { textos } from '../conteudo/textos.ts'
import { NOMES } from '../config.ts'
import { primeiraMaiuscula } from '../util/formatar.ts'
import { fraseDisputa } from '../util/textosDados.ts'
import { Selo } from './Selo.tsx'

type Props = { metricas: Derivadas }

export function Disputa({ metricas }: Props) {
  const frase = fraseDisputa(metricas)
  if (frase === null) return null
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-petroleo bg-petroleo-claro p-4">
      <Selo classe={metricas.classificacao} tamanho={24} />
      <p>
        <span className="sr-only">{primeiraMaiuscula(textos.classificacaoAria[metricas.classificacao](NOMES))}. </span>
        {frase}
      </p>
    </div>
  )
}
