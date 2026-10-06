// Domínio público do site para as tags de prévia (og:url, og:image) do index.html.
// Na Vercel, vale o domínio de produção do projeto (VERCEL_PROJECT_PRODUCTION_URL: o domínio próprio mais curto,
// ou o *.vercel.app se não houver), para a prévia do link nunca apontar para um domínio que ainda não existe.
// Fora da Vercel (dev e preview locais), vale o domínio de config/candidatura.json.

export const MARCADOR_DOMINIO = '__DOMINIO_SITE__'

const RE_DOMINIO = /^[a-z0-9.-]+(:\d+)?$/i

export function dominioDoSite(env: Readonly<Record<string, string | undefined>>, dominioConfig: string): string {
  const daVercel = (env.VERCEL_PROJECT_PRODUCTION_URL ?? '').trim()
  const escolhido = daVercel !== '' ? daVercel : dominioConfig
  if (!RE_DOMINIO.test(escolhido)) throw new Error(`domínio do site inválido: "${escolhido}"`)
  return escolhido
}

export function aplicarDominio(html: string, dominio: string): string {
  return html.replaceAll(MARCADOR_DOMINIO, dominio)
}
