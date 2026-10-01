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
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#result-title')).toHaveText('52表情を追加しました');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadPromise;
    const bytes = await readFile(await download.path());
    const out = parseGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(out.json.meshes[0].extras.targetNames).toHaveLength(109);
    await expect(page.locator('#sliders input[type="range"]')).toHaveCount(52);
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
        .every((r) => r.url.startsWith(new URL(page.url()).origin + '/')),
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

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1280, height: 1000 },
  { width: 390, height: 844 },
  { width: 390, height: 640 },
  { width: 844, height: 390 },
]) {
  test(`stage switching fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const fits = async () => {
      const metrics = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      }));
      expect(metrics.width).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.height).toBeLessThanOrEqual(metrics.viewportHeight);
    };
    await page.goto('/');
    await expect(page.locator('#waiting')).toBeVisible();
    await fits();
    await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#waiting')).toBeHidden();
    await fits();
    await expect(page.locator('#sliders input[type="range"]')).toHaveCount(52);
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#download')).toBeVisible();
    await expect(page.locator('#new-file')).toBeVisible();
    await expect(page.locator('#viewer canvas')).toBeVisible();
    await fits();
    await page.locator('input[aria-label="JawOpen"]').fill('0.7');
    await page.screenshot({
      path: `_local/staged-preview-${viewport.width}x${viewport.height}.png`,
    });
    await page.locator('.result-notes summary').click();
    await expect(page.locator('#warnings')).toBeVisible();
    await fits();
    await expect(page.locator('input[aria-label="JawOpen"]')).toHaveValue('0.7');
    await page.locator('#new-file').click();
    await expect(page.locator('#waiting')).toBeVisible();
    await expect(page.locator('#result')).toBeHidden();
    await expect(page.locator('#sliders input[type="range"]')).toHaveCount(0);
    await fits();
  });
}

test('processing is a single screen and can be cancelled', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/templates/hinzka-female.glb', async (route) => {
    await gate;
    await route.continue();
  });
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/');
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#progress-area')).toBeVisible();
  await expect(page.locator('#drop')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  await page.locator('#cancel').click();
  release();
  await expect(page.locator('#drop')).toBeVisible();
  await expect(page.locator('#status')).toContainText('キャンセル');
});

test('VRM can be saved when automatic preview fails', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.startsWith('webgl')) return null;
      return original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#preview-status')).toContainText('プレビューを開けませんでした');
  await expect(page.locator('#preview-retry')).toBeVisible();
  await expect(page.locator('#reset')).toBeDisabled();
  const pending = page.waitForEvent('download');
  await page.locator('#download').click();
  expect((await pending).suggestedFilename()).toBe('woman1_perfectsync.vrm');
  await page.locator('#new-file').click();
  await expect(page.locator('#waiting')).toBeVisible();
});

test('new file clears preview while it is still loading', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/src/preview/viewer.js*', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#result')).toBeVisible();
  await page.locator('#new-file').click();
  release();
  await expect(page.locator('#waiting')).toBeVisible();
  await expect(page.locator('#sliders input[type="range"]')).toHaveCount(0);
  await expect(page.locator('#viewer canvas')).toHaveCount(0);
});

test('hostile external images are rejected without making an external request', async ({
  page,
}) => {
  const { writeGlb } = await import('../../src/core/glb.js');
  const bytes = await readFile('_local/vrm/woman1.vrm');
  const g = parseGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  g.json.images.push({ uri: 'https://example.com/should-never-load.png' });
  const external = [];
  page.on('request', (r) => {
    if (r.url().startsWith('https://example.com/')) external.push(r.url());
  });
  await page.goto('/');
  await page.locator('#file').setInputFiles({
    name: 'external.vrm',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(writeGlb(g.json, g.bin)),
  });
  await expect(page.locator('#status')).toContainText('外部画像参照');
  await expect(page.locator('#result')).toBeHidden();
  expect(external).toEqual([]);
});

test('oversized sparse allocations fail before preview and allow retry', async ({ page }) => {
  const { writeGlb } = await import('../../src/core/glb.js');
  const bytes = await readFile('_local/vrm/woman1.vrm');
  const g = parseGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  g.json.accessors.push({ type: 'VEC3', componentType: 5126, count: 10000000 });
  await page.goto('/');
  await page.locator('#file').setInputFiles({
    name: 'oversized.vrm',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(writeGlb(g.json, g.bin)),
  });
  await expect(page.locator('#status')).toContainText('大きすぎ');
  await expect(page.locator('#result')).toBeHidden();
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#result')).toBeVisible();
});

test('filenames are displayed as text and cannot inject markup', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/templates/hinzka-female.glb', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await page.locator('#file').setInputFiles({
    name: '<svg onload=alert(1)>.vrm',
    mimeType: 'application/octet-stream',
    buffer: await readFile('_local/vrm/woman1.vrm'),
  });
  await expect(page.locator('#filename')).toHaveText('<svg onload=alert(1)>.vrm');
  await expect(page.locator('#filename svg')).toHaveCount(0);
  await page.locator('#cancel').click();
  release();
});
