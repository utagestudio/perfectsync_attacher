import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { languages, siteOrigin, seoHtml, seoPlugin } from '../tools/seo.mjs';
import { languageFromPath } from '../src/i18n/index.js';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const origin = 'https://perfectsync.utage.games';

test('SEO configuration accepts only HTTPS origins and supports a disabled public URL', () => {
  assert.equal(siteOrigin(origin + '/'), origin);
  assert.equal(siteOrigin(''), undefined);
  for (const value of [
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/app/',
    'https://example.com/?x=1',
    'https://example.com/#fragment',
    'not a url',
  ])
    assert.throws(() => siteOrigin(value));
});
test('all localized initial documents have self canonicals and reciprocal alternates', () => {
  const titles = {
    ja: 'VRMに52表情を追加',
    en: 'Add 52 expressions',
    ko: 'VRM에 표정 52개 추가',
    'zh-Hant': '為 VRM 新增',
    'zh-Hans': '为 VRM 添加',
  };
  for (const language of languages) {
    const out = seoHtml(html, language, origin);
    assert.ok(out.includes(`<html lang="${language}">`));
    assert.ok(out.includes(titles[language]));
    assert.ok(out.includes(`rel="canonical" href="${origin}/${language}/"`));
    assert.equal((out.match(/rel="alternate"/g) ?? []).length, 6);
    for (const alternate of languages)
      assert.ok(out.includes(`hreflang="${alternate}" href="${origin}/${alternate}/"`));
    assert.ok(out.includes(`hreflang="x-default" href="${origin}/"`));
    assert.ok(out.includes(`value="${language}" lang="${language}" selected`));
    assert.ok(out.includes('og.png'));
    assert.ok(out.includes('index, follow'));
    assert.equal(languageFromPath(`/${language}/`), language);
    assert.equal(languageFromPath(`/${language}/index.html`), language);
  }
  const english = seoHtml(html, 'en', origin);
  assert.ok(english.includes('Result &amp; preview'));
  assert.ok(english.includes('aria-label="Choose a VRM file"'));
  assert.match(english, /data-i18n="drop.button">Choose file<\/span\s*>/);
  assert.ok(!english.includes('あなたのアバターに'));
  assert.equal(languageFromPath('/en/extra'), undefined);
});

test('build plugin generates static pages, sitemap and robots, excluding unknown-route SPA fallback', () => {
  for (const indexable of [true, false]) {
    const files = {};
    const bundle = { 'index.html': { type: 'asset', source: html } };
    seoPlugin(origin, indexable).generateBundle.handler.call(
      {
        emitFile: ({ fileName, source }) => {
          files[fileName] = source;
        },
      },
      {},
      bundle,
    );
    for (const language of languages) assert.ok(files[`${language}/index.html`]);
    assert.ok(files['404.html'].includes('noindex'));
    if (indexable) {
      assert.ok(files['robots.txt'].includes(`Sitemap: ${origin}/sitemap.xml`));
      assert.equal((files['sitemap.xml'].match(/<loc>/g) ?? []).length, 6);
    } else {
      assert.ok(files['robots.txt'].includes('Disallow: /'));
      assert.equal(files['sitemap.xml'], undefined);
      assert.ok(bundle['index.html'].source.includes('noindex, nofollow'));
    }
  }
  assert.ok(!seoHtml(html, 'en', undefined).includes('rel="canonical"'));
});
