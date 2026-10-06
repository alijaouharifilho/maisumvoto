// MapLibre servido como ESM nativo a partir de public/mapa/maplibre-<versão>/ (cópia de node_modules/maplibre-gl/dist).
// Por quê: assim a página e o worker importam o MESMO maplibre-gl-shared.mjs (≈148 KB gzip baixados uma vez só).
// Empacotado pelo Vite, o worker (?worker&url) levaria a própria cópia do shared. testes/front/identidade.test.ts
// confere que a cópia é idêntica à do pacote instalado e que a versão abaixo bate.
import type * as MapLibre from 'maplibre-gl'

export const VERSAO_MAPLIBRE = '6.12.0'

export type BibliotecaMapa = typeof MapLibre

export function urlMapLibre(origem: string): string {
  return new URL(`/mapa/maplibre-${VERSAO_MAPLIBRE}/maplibre-gl.mjs`, origem).href
}

export async function carregarMapLibre(): Promise<BibliotecaMapa> {
  // URL montada em tempo de execução: o empacotador não tenta resolver nem embutir o arquivo.
  const modulo: unknown = await import(/* @vite-ignore */ urlMapLibre(window.location.origin))
  return modulo as BibliotecaMapa
}
