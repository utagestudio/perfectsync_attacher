import { test, expect } from '@playwright/test';
import { CONSENT_KEY, CONSENT_MS } from '../../src/analytics/consent.js';

// A local stub exercises requests and timer disposal without sending test traffic to Google.
async function googleStub(page) {
  const requests = [];
  page.on('request', (request) => {
    if (/google(tagmanager|-analytics)\.com/.test(request.url())) requests.push(request.url());
  });
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
      window.receivedEvents = window.dataLayer.map(value => value.event).filter(Boolean);
      document.cookie = '_ga=stub; path=/';
      const view = window.dataLayer.find(value=>value.event==='psa_page_view');
      if (view) window.testTimer = setInterval(() => fetch('https://www.google-analytics.com/g/collect?en=page_view&dl=' + encodeURIComponent(view.page_location)), 80);
    `,
    });
  });
  await page.route('https://www.google-analytics.com/**', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  return requests;
}
const saved = (choice, now = Date.now()) => ({
  version: 1,
  containerId: 'GTM-TEST123',
  choice,
  savedAt: now,
  expiresAt: now + CONSENT_MS,
});
async function seed(page, record) {
  await page.addInitScript(({ key, record }) => localStorage.setItem(key, JSON.stringify(record)), {
    key: CONSENT_KEY,
    record,
  });
}

test('unknown or rejected consent makes no Google request and never blocks conversion', async ({
  page,
}) => {
  const requests = await googleStub(page);
  await page.goto('/');
  await expect(page.locator('#consent-dialog')).toBeVisible();
  await expect(page.locator('#analytics-frame')).toHaveCount(0);
  await page.locator('#consent-reject').click();
  await expect(page.locator('#consent-dialog')).toBeHidden();
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#sliders input')).toHaveCount(52);
  await page.locator('input[aria-label="JawOpen"]').fill('0.7');
  expect(requests).toEqual([]);
  await page.reload();
  await expect(page.locator('#consent-dialog')).toBeHidden();
  await expect(page.locator('#analytics-frame')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('allow starts one container; withdrawal destroys execution without losing output or values', async ({
  page,
}) => {
  const requests = await googleStub(page);
  await page.goto('/en/?private=never-send#secret');
  expect(requests).toEqual([]);
  await page.locator('#consent-accept').click();
  await expect
    .poll(() => requests.filter((url) => url.includes('/g/collect')).length)
    .toBeGreaterThan(0);
  expect(requests.filter((url) => url.includes('/gtm.js'))).toHaveLength(1);
  const frame = page.frameLocator('#analytics-frame');
  const data = await frame
    .locator('body')
    .evaluate(() => window.dataLayer.filter((item) => item.event));
  expect(data).toEqual([
    { event: 'gtm.js', 'gtm.start': expect.any(Number) },
    {
      event: 'psa_page_view',
      page_location: 'http://127.0.0.1:5196/en/',
      page_title: 'Perfect Sync Attacher',
      page_referrer: '',
    },
  ]);
  expect(await page.evaluate(() => window.dataLayer)).toBeUndefined();
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#sliders input')).toHaveCount(52);
  await page.locator('input[aria-label="JawOpen"]').fill('0.7');
  const output = await page.locator('#download').getAttribute('href');
  await page.locator('#language').selectOption('ko');
  expect(requests.filter((url) => url.includes('/gtm.js'))).toHaveLength(1);
  await page.locator('#consent-settings').click();
  await page.locator('#consent-reject').click();
  await expect(page.locator('#analytics-frame')).toHaveCount(0);
  await expect(page.locator('input[aria-label="JawOpen"]')).toHaveValue('0.7');
  await expect(page.locator('#download')).toHaveAttribute('href', output);
  expect(await page.evaluate(() => document.cookie.includes('_ga='))).toBe(false);
  const before = requests.length;
  await page.waitForTimeout(300); // More than three stub timer periods.
  expect(requests).toHaveLength(before);
  await page.reload();
  await expect(page.locator('#analytics-frame')).toHaveCount(0);
  expect(requests).toHaveLength(before);
});

test('valid saved allowance starts automatically; expired and changed-container consent do not', async ({
  browser,
}) => {
  for (const record of [
    saved('accepted'),
    saved('accepted', Date.now() - CONSENT_MS - 1000),
    { ...saved('accepted'), containerId: 'GTM-OTHER' },
  ]) {
    const context = await browser.newContext({ locale: 'ja-JP' });
    const page = await context.newPage();
    const requests = await googleStub(page);
    await seed(page, record);
    await page.goto('http://127.0.0.1:5196/');
    if (record.containerId === 'GTM-TEST123' && record.expiresAt > Date.now()) {
      await expect.poll(() => requests.length).toBeGreaterThan(0);
      await expect(page.locator('#consent-dialog')).toBeHidden();
    } else {
      await expect(page.locator('#consent-dialog')).toBeVisible();
      expect(requests).toEqual([]);
    }
    await context.close();
  }
});

test('storage failure still permits a session choice and subsequent withdrawal', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    }),
  );
  const requests = await googleStub(page);
  await page.goto('/');
  await page.locator('#consent-accept').click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await page.locator('#consent-settings').click();
  await expect(page.locator('#consent-session')).toBeVisible();
  await page.locator('#consent-reject').click();
  await expect(page.locator('#analytics-frame')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#consent-dialog')).toBeVisible();
});

for (const language of ['ja', 'en', 'ko', 'zh-Hant', 'zh-Hans']) {
  test(`consent panel and page fit small screens in ${language}`, async ({ page }) => {
    const requests = await googleStub(page);
    await page.goto(`/${language}/`);
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('#consent-dialog')).toBeVisible();
      const box = await page.locator('#consent-dialog').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      await page.locator('#consent-reject').focus();
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
      );
    }
    await page.locator('#consent-close').click();
    await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
    await expect(page.locator('#sliders input')).toHaveCount(52);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
      true,
    );
    expect(requests).toEqual([]);
  });
}

test('another tab withdrawing consent stops the running frame', async ({ context, page }) => {
  await googleStub(page);
  await page.goto('/');
  await page.locator('#consent-accept').click();
  await expect(page.locator('#analytics-frame')).toHaveCount(1);
  const other = await context.newPage();
  await googleStub(other);
  await other.goto('http://127.0.0.1:5196/');
  await other.locator('#consent-settings').click();
  await other.locator('#consent-reject').click();
  await expect(page.locator('#analytics-frame')).toHaveCount(0);
});

test('re-allowing consent does not emit a second page view in the same document', async ({
  page,
}) => {
  const requests = await googleStub(page);
  await page.goto('/');
  await page.locator('#consent-accept').click();
  await expect.poll(() => requests.filter((url) => url.includes('/gtm.js')).length).toBe(1);
  await page.locator('#consent-settings').click();
  await page.locator('#consent-reject').click();
  await page.locator('#consent-settings').click();
  await page.locator('#consent-accept').click();
  await expect.poll(() => requests.filter((url) => url.includes('/gtm.js')).length).toBe(2);
  const events = await page
    .frameLocator('#analytics-frame')
    .locator('body')
    .evaluate(() => window.dataLayer.filter((item) => item.event === 'psa_page_view'));
  expect(events).toEqual([]);
});
