// Carregador do site: arquivos servidos em /dados (public/dados no build). A hora do servidor (cabeçalho Date do
// índice) vai para o relógio da fase.
import { registrarHoraDoServidor } from '../relogio.ts'
import { criarCarregador } from './carregar.ts'

export const carregador = criarCarregador({ base: '/dados', aoHoraDoServidor: registrarHoraDoServidor })
