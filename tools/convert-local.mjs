import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { convert } from '../src/core/convert.js';
const array = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const template = array(await readFile('public/templates/hinzka-female.glb'));
await mkdir('_local/output', { recursive: true });
for (const file of (await readdir('_local/vrm')).sort()) {
  const start = performance.now();
  try {
    const input = array(await readFile('_local/vrm/' + file)),
      r = convert(input, template);
    await writeFile(
      '_local/output/' + file.replace(/\.vrm$/i, '_perfectsync.vrm'),
      new Uint8Array(r.buffer),
    );
    const again = convert(r.buffer, template);
    if (again.added !== 0) throw new Error('Idempotence failed');
    console.log(
      file,
      'OK',
      r.added,
      'shapes',
      Math.round(performance.now() - start) + 'ms',
      r.buffer.byteLength,
      'bytes',
    );
  } catch (e) {
    console.log(file, 'UNSUPPORTED:', e.message);
  }
}
