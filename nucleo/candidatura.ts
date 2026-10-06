// Configuração única da campanha e regras de busca, validadas na carga do módulo.
// Se o JSON estiver inválido, o build/teste quebra com uma mensagem que aponta o arquivo e o campo.
import { z } from 'zod/mini'
import brutoBusca from '../config/busca.json' with { type: 'json' }
import brutoCandidatura from '../config/candidatura.json' with { type: 'json' }
import { esquemaCandidatura, esquemaRegrasBusca } from './esquemas.ts'
import type { Candidatura, RegrasBusca } from './tipos.ts'

function congelar<T>(valor: T): T {
  if (valor !== null && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.values(valor).forEach(congelar)
    Object.freeze(valor)
  }
  return valor
}

export function validarConfig<T>(esquema: z.ZodMiniType<T>, dados: unknown, origem: string): T {
  const resultado = esquema.safeParse(dados)
  if (!resultado.success) {
    throw new Error(`Configuração inválida em ${origem}:\n${z.prettifyError(resultado.error)}`)
  }
  return congelar(resultado.data)
}

export const candidatura: Candidatura = validarConfig(esquemaCandidatura, brutoCandidatura, 'config/candidatura.json')

export const regrasBusca: RegrasBusca = validarConfig(esquemaRegrasBusca, brutoBusca, 'config/busca.json')
