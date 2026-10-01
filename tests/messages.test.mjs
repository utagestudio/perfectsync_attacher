import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, errorMessage, formatMessage } from '../src/i18n/messages.js';
import ja from '../src/i18n/locales/ja.js';
import { parseGlb } from '../src/core/glb.js';

test('engine errors carry stable codes and parameters across the Worker boundary', () => {
  assert.throws(() => parseGlb(new ArrayBuffer(0)), { code: 'error.glbInvalid' });
  const error = new AppError('error.uvAmbiguous', { vertex: 12, count: 2 });
  const wireMessage = structuredClone(errorMessage(error));
  assert.deepEqual(wireMessage, {
    code: 'error.uvAmbiguous',
    params: { vertex: 12, count: 2 },
  });
  assert.equal(formatMessage(ja, wireMessage.code, wireMessage.params), error.message);
  assert.deepEqual(errorMessage(new Error('untrusted internal detail')), { code: 'error.unknown' });
});
