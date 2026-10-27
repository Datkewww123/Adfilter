import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  webServer: {
    command: 'pnpm exec http-server tests/e2e/fake-youtube -p 4173 -s',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});