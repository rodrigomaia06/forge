const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  outputDir: 'tests/results/artifacts',
  reporter: [['list'], ['html', { outputFolder: 'tests/results/report', open: 'never' }]],
  projects: [
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 15 Pro'] },
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
