import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseGlb } from '../../src/core/glb.js';
for (const file of ['02_utage3.4.0-vrm0.0.vrm', '02_utage3.4vrm1.0.vrm'])
  test(`convert, download and preview ${file}`, async ({ page }, testInfo) => {
    const errors = [],
      requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
    await page.goto('/');
    await page.locator('#file').setInputFiles('_local/vrm/' + file);
    await expect(page.locator('#result-title')).toHaveText('52表情を追加しました');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadPromise;
    const bytes = await readFile(await download.path());
    const out = parseGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(out.json.meshes[0].extras.targetNames).toHaveLength(109);
    await page.locator('#preview-button').click();
    await expect(page.locator('#sliders input')).toHaveCount(52);
    await expect(page.locator('#viewer canvas')).toBeVisible();
    await page.locator('input[aria-label="JawOpen"]').fill('0.7');
    await expect(page.locator('input[aria-label="JawOpen"]')).toHaveValue('0.7');
    await page.screenshot({
      path: `_local/preview-${file.includes('vrm1') ? 'vrm1' : 'vrm0'}.png`,
      fullPage: true,
    });
    await page.locator('#reset').click();
    await expect(page.locator('input[aria-label="JawOpen"]')).toHaveValue('0');
    expect(errors).toEqual([]);
    expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
    expect(
      requests
        .filter((r) => /^https?:/.test(r.url))
        .every((r) => r.url.startsWith('http://127.0.0.1:5173/')),
    ).toBe(true);
  });
test('unsupported model gives a reason and permits retry', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file').setInputFiles('_local/vrm/ossan1.vrm');
  await expect(page.locator('#status')).toContainText('顔と身体が結合');
  await expect(page.locator('#result')).toBeHidden();
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#result-title')).toHaveText('52表情を追加しました');
});
test('private local models cannot be fetched from the development server', async ({ request }) => {
  const response = await request.get('/_local/vrm/woman1.vrm');
  expect(response.status()).toBe(403);
});
test('cancel returns to a usable state', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file').setInputFiles('_local/vrm/02_utage3.4vrm1.0.vrm');
  await page.locator('#cancel').click();
  await expect(page.locator('#status')).toContainText('キャンセル');
  await expect(page.locator('#result')).toBeHidden();
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#result-title')).toHaveText('52表情を追加しました');
});
test('mobile layout and invalid file drop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#drop')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#drop').evaluate((el) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['invalid'], 'model.vrm'));
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  });
  await expect(page.locator('#status')).toContainText('GLB');
  await expect(page.locator('#result')).toBeHidden();
  await page.screenshot({ path: '_local/preview-mobile.png', fullPage: true });
});
