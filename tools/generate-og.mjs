import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  const svg = await readFile(new URL('../assets/og.svg', import.meta.url), 'utf8');
  await page.setContent(`<style>body{margin:0}</style>${svg}`);
  await page.screenshot({ path: new URL('../public/og.png', import.meta.url).pathname });
} finally {
  await browser.close();
}
