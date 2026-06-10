// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  use: {
    headless: true,
    viewport: { width: 1400, height: 900 },
    // Carregar o HTML local via file://
    baseURL: 'file://' + process.cwd().replace(/\\/g, '/') + '/',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
