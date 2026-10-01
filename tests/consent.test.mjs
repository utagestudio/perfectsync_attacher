import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readConsent,
  saveConsent,
  CONSENT_MS,
  CONSENT_KEY,
  measuredPage,
  clearAnalyticsCookies,
} from '../src/analytics/consent.js';
import { containerId, analyticsHeaders } from '../tools/analytics.mjs';

test('consent is scoped to container, expires after 90 days, and ignores invalid or unavailable storage', () => {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
  };
  for (const choice of ['accepted', 'rejected']) {
    const { record, persisted } = saveConsent(storage, 'GTM-TEST', choice, 1000);
    assert.equal(persisted, true);
    assert.deepEqual(readConsent(storage, 'GTM-TEST', 1001), record);
    assert.equal(readConsent(storage, 'GTM-OTHER', 1001), undefined);
    assert.equal(readConsent(storage, 'GTM-TEST', 1000 + CONSENT_MS), undefined);
    assert.equal(readConsent(storage, 'GTM-TEST', 999), undefined);
  }
  data.set(CONSENT_KEY, 'broken');
  assert.equal(readConsent(storage, 'GTM-TEST'), undefined);
  const blocked = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  };
  assert.equal(readConsent(blocked, 'GTM-TEST'), undefined);
  assert.equal(saveConsent(blocked, 'GTM-TEST', 'accepted').persisted, false);
});
test('counted page URLs exclude query, hash and arbitrary paths; cookie cleanup stays on this host', () => {
  assert.equal(measuredPage('https://example.com', '/en/'), 'https://example.com/en/');
  assert.equal(measuredPage('https://example.com', '/sensitive/path'), 'https://example.com/');
  assert.equal(measuredPage('https://example.com', '/en/?name=private'), 'https://example.com/');
  const writes = [];
  const doc = {
    get cookie() {
      return '_ga=1; _ga_ABC=2; _gid=3; unrelated=4';
    },
    set cookie(value) {
      writes.push(value);
    },
  };
  clearAnalyticsCookies(doc, 'perfectsync.utage.games');
  assert.equal(writes.length, 9);
  assert.ok(
    !writes.some((value) => value.includes('unrelated') || value.includes('domain=.utage.games')),
  );
});
test('only the requested GTM container key is accepted; Google CSP sources are conditional', () => {
  assert.equal(containerId(' GTM-ABC123 '), 'GTM-ABC123');
  assert.equal(containerId(''), '');
  for (const id of ['G-ABC123', 'GTM-<script>', 'GTM-ABC&x=1'])
    assert.throws(() => containerId(id));
  assert.ok(!analyticsHeaders('').includes('googletagmanager'));
  assert.ok(analyticsHeaders('').includes("connect-src 'self' blob:"));
  const enabled = analyticsHeaders('GTM-ABC123');
  assert.ok(enabled.includes('https://www.googletagmanager.com'));
  assert.ok(enabled.includes("frame-src 'self'"));
  assert.ok(!enabled.includes('unsafe-eval') && !enabled.includes('doubleclick'));
});
