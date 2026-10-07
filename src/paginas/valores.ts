// Valores dos textos-modelo ({{chave}}) e roteiros já preenchidos. Só os módulos carregados sob demanda
// (Ficha, Guia, Sobre) importam daqui: o conteúdo editorial fica fora do JS de entrada.
import { useMemo } from 'react'
import { derivar } from '../../nucleo/metricas.ts'
import { plano, roteiros, type Roteiros } from '../conteudo/conteudo.ts'
import { preencherTudo, valoresDoModelo, type ValoresModelo } from '../conteudo/modelo.ts'
import { candidatura, CFG } from '../config.ts'
import { useIndice } from '../dados/contexto.ts'

export function useValoresModelo(): ValoresModelo {
  const indice = useIndice()
  const geradoEm = indice?.geradoEm ?? null
  const exteriorAte = indice === null ? null : derivar(indice.exterior, CFG).ate
  return useMemo(() => {
    // A privacidade cita o endereço em que o site está de fato no ar (domínio próprio ou *.vercel.app).
    const site = { ...candidatura.site, dominio: window.location.host || candidatura.site.dominio }
    return valoresDoModelo({ ...candidatura, site }, { geradoEm, urlPlano: plano.documento.url, exteriorAte })
  }, [geradoEm, exteriorAte])
}

export function useRoteiros(): Roteiros {
  const valores = useValoresModelo()
  return useMemo(() => preencherTudo(roteiros, valores), [valores])
}
