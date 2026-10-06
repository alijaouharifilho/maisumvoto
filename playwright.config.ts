import { defineConfig, devices } from '@playwright/test'

// E2E contra o build de produção servido pelo `vite preview` (porta 5151).
export default defineConfig({
  testDir: 'testes/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:5151', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:5151',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
