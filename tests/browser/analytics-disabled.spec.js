import { test, expect } from '@playwright/test';
test('no GTM_ID means no consent UI, Google loader or analytics frame', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('google')) requests.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('#consent-settings')).toBeHidden();
  await expect(page.locator('#consent-dialog')).toBeHidden();
  await expect(page.locator('#analytics-frame')).toHaveCount(0);
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#sliders input[type="range"]')).toHaveCount(52);
  expect(requests).toEqual([]);
});
