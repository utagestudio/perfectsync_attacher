import { test, expect } from '@playwright/test';

test('localized URLs return translated HTML before JavaScript runs', async ({ request }) => {
  for (const [language, text] of [
    ['ja', 'あなたのアバターに'],
    ['en', 'Give your avatar'],
    ['ko', '내 아바타에'],
    ['zh-Hant', '讓您的虛擬角色'],
    ['zh-Hans', '让您的虚拟角色'],
  ]) {
    const response = await request.get(`/${language}/`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(`<html lang="${language}">`);
    expect(html).toContain(text);
    expect(html).toContain(`href="https://perfectsync.utage.games/${language}/"`);
    expect(html).toContain('noindex, nofollow'); // Development server is not indexable.
  }
});

test('explicit URL overrides browser and saved preference; back preserves preview state', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#language').selectOption('ko');
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#language')).toHaveValue('en');
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#sliders input[type="range"]')).toHaveCount(52);
  await page.locator('input[aria-label="JawOpen"]').fill('0.7');
  const href = await page.locator('#download').getAttribute('href');
  await page.locator('#language').selectOption('zh-Hant');
  await expect(page).toHaveURL(/\/zh-Hant\/$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://perfectsync.utage.games/zh-Hant/',
  );
  await expect(page).toHaveTitle(/為 VRM 新增/);
  await page.goBack();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('input[aria-label="JawOpen"]')).toHaveValue('0.7');
  await expect(page.locator('#download')).toHaveAttribute('href', href);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://perfectsync.utage.games/en/',
  );
});
