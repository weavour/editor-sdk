import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser', fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5197' },
  projects: [ { name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'firefox', use: { ...devices['Desktop Firefox'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } } ],
  webServer: { command: 'node tests/server.mjs', port: 5197, reuseExistingServer: !process.env.CI },
});
