import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contactFormUrl } from '../config/contact.js';
import { seoHtml, languages } from '../tools/seo.mjs';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('contact URLs preserve encoded values and select Japanese or English forms', () => {
  for (const language of languages) {
    const href = contactFormUrl(language, '日本語 1.0');
    const url = new URL(href);
    assert.equal(url.pathname, language === 'ja' ? '/r/kdVdDR' : '/r/KYqY78');
    assert.equal(url.searchParams.get('product'), 'PerfectSync Attacher');
    assert.equal(url.searchParams.get('version'), '日本語 1.0');
    assert.ok(href.includes('PerfectSync%20Attacher'));
    assert.ok(!href.includes('+'));
    assert.equal(new URL(contactFormUrl(language)).searchParams.has('version'), false);
  }
});

test('initial HTML includes localized contact before Issues with automatic version', () => {
  for (const language of languages) {
    const output = seoHtml(html, language, undefined);
    assert.ok(
      output.includes(`href="${contactFormUrl(language, version).replaceAll('&', '&amp;')}"`),
    );
    assert.ok(output.indexOf('id="contact-link"') < output.indexOf('>Issues</a'));
  }
  for (const [file, language] of [
    ['README.md', 'ja'],
    ['README.en.md', 'en'],
  ]) {
    const readme = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(readme.includes(`](${contactFormUrl(language)})`));
  }
});
