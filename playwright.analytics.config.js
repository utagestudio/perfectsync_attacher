import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({
  ...base,
  testDir: 'tests/analytics',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5196' },
  webServer: {
    command: 'npm run dev -- --port 5196 --strictPort',
    env: { GTM_ID: 'GTM-TEST123' },
    url: 'http://127.0.0.1:5196',
    reuseExistingServer: false,
  },
});
