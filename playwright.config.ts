import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: 'tests/results/artifacts',
  reporter: [['list'], ['html', { outputFolder: 'tests/results/report', open: 'never' }]],
  projects: [
    {
      name: 'iphone-air',
      use: { ...devices['iPhone Air'] },
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
