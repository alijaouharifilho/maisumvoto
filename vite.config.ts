import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import candidatura from './config/candidatura.json' with { type: 'json' }
import cabecalhosSeguranca from './deploy/cabecalhos-seguranca.json' with { type: 'json' }
import { aplicarDominio, dominioDoSite } from './ferramentas/dominio-do-site.ts'

// Dados em public/dados (gerados por `npm run dados`, fora do git).
// O mapa (maplibre-gl) é carregado sob demanda pelo próprio código; não forçar em chunk de entrada.
// O preview (alvo do E2E) usa os mesmos cabeçalhos da produção, para a CSP quebrar aqui e não no ar.
// Para mostrar o preview por um túnel (ex.: ngrok), liste o host em PREVIEW_HOSTS_EXTRAS no .env.local
// (fora do git): o Vite recusa qualquer host que não seja local, e o servidor de desenvolvimento nunca é exposto.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hostsExtras = (env.PREVIEW_HOSTS_EXTRAS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h !== '')
  const dominio = dominioDoSite(process.env, candidatura.site.dominio)
  return {
    plugins: [react(), tailwindcss(), { name: 'dominio-do-site', transformIndexHtml: (html: string) => aplicarDominio(html, dominio) }],
    server: { host: '127.0.0.1', port: 5150, strictPort: true },
    preview: { host: '127.0.0.1', port: 5151, strictPort: true, headers: cabecalhosSeguranca, allowedHosts: hostsExtras },
    build: {
      target: 'baseline-widely-available',
      sourcemap: false,
      assetsInlineLimit: 4096,
    },
  }
})
