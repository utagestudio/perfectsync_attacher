import { test, expect } from '@playwright/test';
import { contactFormUrl } from '../../config/contact.js';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));

test('contact follows saved language, switching and browser history', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('perfectsync-attacher.language', 'en'));
  await page.goto('/');
  await expect(page.locator('#contact-link')).toHaveAttribute(
    'href',
    contactFormUrl('en', version),
  );
  await page.locator('#language').selectOption('ja');
  await expect(page.locator('#contact-link')).toHaveAttribute(
    'href',
    contactFormUrl('ja', version),
  );
  await page.locator('#language').selectOption('ko');
  await expect(page.locator('#contact-link')).toHaveAttribute(
    'href',
    contactFormUrl('ko', version),
  );
  await page.goBack();
  await expect(page.locator('#contact-link')).toHaveAttribute(
    'href',
    contactFormUrl('ja', version),
  );
  await page.goForward();
  await expect(page.locator('#contact-link')).toHaveAttribute(
    'href',
    contactFormUrl('ko', version),
  );
});

test('contact fits waiting and result screens in all languages', async ({ page }) => {
  await page.goto('/ja/');
  for (const screen of ['waiting', 'result']) {
    if (screen === 'result') {
      await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
      await expect(page.locator('#sliders input[type="range"]')).toHaveCount(52);
    }
    for (const language of ['ja', 'en', 'ko', 'zh-Hant', 'zh-Hans']) {
      await page.locator('#language').selectOption(language);
      await expect(page.locator('#contact-link')).toHaveAttribute(
        'href',
        contactFormUrl(language, version),
      );
      for (const [width, height] of [
        [1280, 720],
        [390, 844],
        [390, 640],
        [320, 568],
        [844, 390],
      ]) {
        await page.setViewportSize({ width, height });
        await expect(page.locator('#contact-link')).toBeInViewport();
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <= innerWidth &&
              document.documentElement.scrollHeight <= innerHeight,
          ),
        ).toBe(true);
      }
    }
  }
});
