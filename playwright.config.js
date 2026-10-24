import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 }, // mobile-first (iPhone 14)
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
  },
  webServer: {
    command: 'node scripts/serve.mjs 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'mobile-chromium', use: { browserName: 'chromium' } },
    { name: 'mobile-webkit', use: { browserName: 'webkit' } },
  ],
});
