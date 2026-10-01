import { test, expect } from '@playwright/test';
test('introduction loads on request, plays with audio and stops when closed', async ({ page }) => {
  const videoRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/media/introduction.mp4')) videoRequests.push(request.url());
  });
  await page.goto('/ja/');
  const dialog = page.locator('#introduction-dialog');
  const video = page.locator('#introduction-video');
  const trigger = page.locator('#introduction-open');
  await expect(dialog).toBeHidden();
  await expect(video).not.toHaveAttribute('src');
  expect(videoRequests).toEqual([]);
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect.poll(() => video.evaluate((v) => !v.paused && v.currentTime > 0)).toBe(true);
  expect(await video.evaluate((v) => v.muted)).toBe(false);
  expect(videoRequests.length).toBeGreaterThan(0);
  await page.screenshot({ path: '_local/introduction-dialog-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => video.evaluate((v) => v.paused)).toBe(true);
  await expect(video).not.toHaveAttribute('src');
  await expect(trigger).toBeFocused();
  for (const language of ['ja', 'en', 'ko', 'zh-Hant', 'zh-Hans']) {
    await page.locator('#language').selectOption(language);
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 390, height: 640 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(trigger).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      await trigger.click();
      const box = await dialog.boundingBox();
      expect(box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.height).toBeLessThanOrEqual(viewport.height);
      await page.locator('#introduction-close').click();
      await expect(video).not.toHaveAttribute('src');
    }
  }
  await page.setViewportSize({ width: 390, height: 640 });
  await trigger.click();
  await page.screenshot({ path: '_local/introduction-dialog-mobile.png' });
  await page.locator('#introduction-close').click();
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#sliders input[type="range"]')).toHaveCount(52);
  await expect(trigger).toBeHidden();
});
