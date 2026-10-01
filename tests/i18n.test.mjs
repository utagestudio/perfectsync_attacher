import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogs,
  detectLanguage,
  initialLanguage,
  saveLanguage,
  translate,
  LANGUAGE_STORAGE_KEY,
} from '../src/i18n/index.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
test('all five catalogs have matching keys and interpolation parameters', () => {
  const reference = Object.keys(catalogs.ja).sort();
  assert.equal(Object.keys(catalogs).length, 5);
  for (const [language, catalog] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(catalog).sort(), reference, language);
    for (const key of reference) {
      assert.ok(catalog[key].trim(), `${language}: ${key}`);
      assert.deepEqual(
        placeholders(catalog[key]),
        placeholders(catalogs.ja[key]),
        `${language}: ${key}`,
      );
    }
    assert.ok(translate(language, 'progress.adding', { name: 'JawOpen' }).includes('JawOpen'));
    assert.ok(!translate(language, 'error.uvAmbiguous', { vertex: 12, count: 2 }).includes('{'));
  }
});

test('detects preferred supported language with explicit Chinese script taking priority', () => {
  for (const [languages, expected] of [
    [['ja-JP'], 'ja'],
    [['en-GB'], 'en'],
    [['ko-KR'], 'ko'],
    [['zh-TW'], 'zh-Hant'],
    [['zh-HK'], 'zh-Hant'],
    [['zh-MO'], 'zh-Hant'],
    [['zh-CN'], 'zh-Hans'],
    [['zh-SG'], 'zh-Hans'],
    [['zh'], 'zh-Hans'],
    [['zh-Hant-CN'], 'zh-Hant'],
    [['zh-Hans-TW'], 'zh-Hans'],
    [['fr-FR', 'ko-KR', 'en-US'], 'ko'],
    [['fr-FR'], 'en'],
    [[], 'en'],
  ])
    assert.equal(detectLanguage(languages), expected, languages.join(','));
});

test('manual preference overrides detection; invalid or unavailable storage is harmless', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  saveLanguage('zh-Hant', storage);
  assert.equal(initialLanguage(['ja-JP'], storage), 'zh-Hant');
  saveLanguage('invalid', storage);
  assert.equal(values.get(LANGUAGE_STORAGE_KEY), 'zh-Hant');
  values.set(LANGUAGE_STORAGE_KEY, '__proto__');
  assert.equal(initialLanguage(['ja-JP'], storage), 'ja');
  const blocked = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  };
  assert.equal(initialLanguage(['ko-KR'], blocked), 'ko');
  assert.doesNotThrow(() => saveLanguage('en', blocked));
  assert.equal(translate('invalid', 'cancel'), 'Cancel');
});
