import { defineConfig, devices } from '@playwright/test'

// E2E contra o build de produção servido pelo `vite preview` (porta 5151). Com a 5151 ocupada (por exemplo, atrás de um
// túnel que não deve mostrar texto ainda não aprovado), PORTA_E2E=5152 npm run e2e usa a porta reserva.
const PORTA = Number(process.env.PORTA_E2E ?? 5151)
const ENDERECO = `http://127.0.0.1:${PORTA}`

export default defineConfig({
  testDir: 'testes/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: ENDERECO, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORTA} --strictPort`,
    url: ENDERECO,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
