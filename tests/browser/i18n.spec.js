import { test, expect } from '@playwright/test';

const cases = [
  {
    language: 'ja',
    locale: 'ja-JP',
    choose: 'ファイルを選択',
    result: '52表情を追加しました',
    invalid: '有効なGLB形式のVRMではありません。',
  },
  {
    language: 'en',
    locale: 'en-US',
    choose: 'Choose file',
    result: 'Added 52 expressions',
    invalid: 'This is not a valid GLB-format VRM.',
  },
  {
    language: 'ko',
    locale: 'ko-KR',
    choose: '파일 선택',
    result: '표정 52개 추가 완료',
    invalid: '올바른 GLB 형식의 VRM이 아닙니다.',
  },
  {
    language: 'zh-Hant',
    locale: 'zh-TW',
    choose: '選擇檔案',
    result: '已新增 52 種表情',
    invalid: '這不是有效的 GLB 格式 VRM。',
  },
  {
    language: 'zh-Hans',
    locale: 'zh-CN',
    choose: '选择文件',
    result: '已添加 52 种表情',
    invalid: '这不是有效的 GLB 格式 VRM。',
  },
];
const viewports = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 390, height: 640 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
];
async function fits(page) {
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
  }));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.height).toBeLessThanOrEqual(metrics.viewportHeight);
}
for (const entry of cases) {
  test.describe(entry.language, () => {
    test.use({ locale: entry.locale });
    test('detects language and translates errors, results and preview without page scroll', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', entry.language);
      await expect(page.locator('.file-label')).toHaveText(entry.choose);
      await expect(page.locator('#language')).toHaveValue(entry.language);
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await fits(page);
      }
      await page.locator('#file').setInputFiles({
        name: 'broken.vrm',
        mimeType: 'application/octet-stream',
        buffer: Buffer.from('invalid'),
      });
      await expect(page.locator('#status')).toHaveText(entry.invalid);
      // Stored descriptors also translate errors after they have been displayed.
      await page.locator('#language').selectOption('en');
      await expect(page.locator('#status')).toHaveText(cases[1].invalid);
      await page.locator('#language').selectOption(entry.language);
      await expect(page.locator('#status')).toHaveText(entry.invalid);
      await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
      await expect(page.locator('#result-title')).toHaveText(entry.result);
      await expect(page.locator('#sliders input')).toHaveCount(52);
      await page.locator('input[aria-label="JawOpen"]').fill('0.7');
      await page.locator('.result-notes summary').click();
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await fits(page);
        const canvas = await page.locator('#viewer canvas').boundingBox();
        const sliders = await page.locator('#sliders').boundingBox();
        expect(canvas.height).toBeGreaterThan(30);
        expect(
          sliders.height,
          `${entry.language} ${viewport.width}x${viewport.height}`,
        ).toBeGreaterThan(30);
      }
      await page.screenshot({ path: `_local/i18n-${entry.language}.png` });
      const originalHref = await page.locator('#download').getAttribute('href');
      for (const language of cases) {
        await page.locator('#language').selectOption(language.language);
        await expect(page.locator('#result-title')).toHaveText(language.result);
        await expect(page.locator('input[aria-label="JawOpen"]')).toHaveValue('0.7');
        await expect(page.locator('#download')).toHaveAttribute('href', originalHref);
        await expect(page.locator('#download')).toHaveAttribute(
          'download',
          'woman1_perfectsync.vrm',
        );
        await fits(page);
      }
      await page.locator('#language').selectOption(entry.language);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', entry.language);
    });
  });
}

test('switching during Worker loading translates progress and subsequent failure', async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/templates/hinzka-female.glb', async (route) => {
    await gate;
    await route.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#status')).toHaveText('表情データを準備しています');
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#status')).toHaveText('Preparing expression data…');
  await expect(page.locator('#cancel')).toHaveText('Cancel');
  await page.setViewportSize({ width: 320, height: 568 });
  await fits(page);
  release();
  await expect(page.locator('#status')).toHaveText(
    'Expression data could not be fetched. Please retry.',
  );
  await page.locator('#language').selectOption('ko');
  await expect(page.locator('#status')).toHaveText(
    '표정 데이터를 가져올 수 없습니다. 다시 시도해 주세요.',
  );
  await expect(page.locator('#drop')).toBeVisible();
});

test('preview failure and its reason translate together; download remains available', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await page.locator('#language').selectOption('en');
  await page.locator('#file').setInputFiles('_local/vrm/woman1.vrm');
  await expect(page.locator('#preview-status')).toHaveText(
    'Preview could not be opened: Preview is not available in this environment. You can still save the VRM.',
  );
  await page.locator('#language').selectOption('zh-Hant');
  await expect(page.locator('#preview-status')).toHaveText(
    '無法開啟預覽：此環境無法顯示預覽。 仍可儲存 VRM。',
  );
  await expect(page.locator('#preview-retry')).toHaveText('重試預覽');
  const download = page.waitForEvent('download');
  await page.locator('#download').click();
  expect((await download).suggestedFilename()).toBe('woman1_perfectsync.vrm');
});

test('language switching works when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.locator('#language').selectOption('ko');
  await expect(page.locator('.file-label')).toHaveText('파일 선택');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
});
