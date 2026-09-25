import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Cap parallelism at two-thirds of the cores so the dev machine keeps headroom
  // and heavy specs don't flake on timeouts/rendering under full CPU contention.
  workers: '66%',
  outputDir: 'tests/results/artifacts',
  reporter: [['list'], ['html', { outputFolder: 'tests/results/report', open: 'never' }]],
  projects: [
    {
      name: 'iphone-air',
      use: { ...devices['iPhone Air'] },
    },
    {
      name: 'samsung-galaxy-s24',
      use: { ...devices['Galaxy S24'] },
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1024 } },
    },
  ],
  use: {
    baseURL: 'http://127.0.0.1:9021',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run web:export && python3 -m http.server 9021 --directory dist',
    url: 'http://127.0.0.1:9021',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
