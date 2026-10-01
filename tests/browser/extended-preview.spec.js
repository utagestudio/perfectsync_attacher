import { test, expect } from '@playwright/test';
test('extended preview preserves downloads, clamps on disable and resets all toggles', async ({
  page,
}) => {
  await page.goto('/ja/');
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  const ranges = page.locator('#sliders input[type="range"]');
  const toggles = page.locator('#sliders button.extended-toggle');
  await expect(ranges).toHaveCount(52);
  await expect(toggles).toHaveCount(52);
  await expect(page.locator('.extended-note')).toContainText('保存するVRMには反映されません');
  const row = page
    .locator('.slider-row')
    .filter({ has: page.locator('input[type="range"][aria-label="JawOpen"]') });
  const range = row.locator('input[type="range"]');
  const toggle = row.locator('button.extended-toggle');
  const href = await page.locator('#download').getAttribute('href');
  await range.fill('0.7');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveCSS('background-color', 'rgb(62, 140, 120)');
  await expect(range).toHaveValue('0.7');
  await expect(range).toHaveAttribute('min', '-1');
  await expect(range).toHaveAttribute('max', '2');
  for (const number of ['0', '1', '0.5']) {
    await range.fill(number);
    await expect(toggle).toHaveCSS('background-color', 'rgb(62, 140, 120)');
  }
  await range.fill('-1');
  await expect(toggle).toHaveCSS('background-color', 'rgb(195, 78, 87)');
  await expect(range).toHaveCSS('accent-color', 'rgb(195, 78, 87)');
  await expect(row.locator('output')).toHaveText('-100%');
  await page.waitForTimeout(100);
  await page.screenshot({ path: '_local/extended-negative.png' });
  await toggle.click();
  await expect(range).toHaveValue('0');
  await expect(row).not.toHaveClass(/out-of-range/);
  await toggle.click();
  await range.fill('2');
  await expect(row.locator('output')).toHaveText('200%');
  await expect(toggle).toHaveCSS('background-color', 'rgb(195, 78, 87)');
  await page.screenshot({ path: '_local/extended-positive.png' });
  await page.locator('#language').selectOption('en');
  await expect(row.locator('.extended-toggle span')).toHaveText('BOOST');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(range).toHaveValue('2');
  for (const language of ['ja', 'en', 'ko', 'zh-Hant', 'zh-Hans']) {
    await page.locator('#language').selectOption(language);
    await toggle.scrollIntoViewIfNeeded();
    expect(
      await toggle.evaluate(
        (button) =>
          button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight,
      ),
    ).toBe(true);
    await row.screenshot({ path: `_local/extended-button-${language}.png` });
  }
  await toggle.click();
  await expect(range).toHaveValue('1');
  await toggle.click();
  await range.fill('-0.5');
  await page.locator('#reset').click();
  await expect(page.locator('#sliders button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#sliders .out-of-range')).toHaveCount(0);
  expect(
    await ranges.evaluateAll((inputs) =>
      inputs.every((i) => i.value === '0' && i.min === '0' && i.max === '1'),
    ),
  ).toBe(true);
  await expect(page.locator('#download')).toHaveAttribute('href', href);
  await page.setViewportSize({ width: 320, height: 568 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= innerHeight &&
        document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator('#new-file').click();
  await expect(toggles).toHaveCount(0);
});
