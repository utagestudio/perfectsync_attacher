import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseGlb, writeGlb, readAccessor } from '../src/core/glb.js';
import { convert } from '../src/core/convert.js';
const b = await readFile('public/templates/hinzka-female.glb');
const template = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
function fixture(version) {
  const { json, bin } = parseGlb(template);
  const mesh = json.meshes[0];
  mesh.extras.targetNames = ['Existing'];
  for (const p of mesh.primitives) p.targets = p.targets.slice(0, 1);
  mesh.weights = [0];
  json.extensions =
    version === 0
      ? {
          VRM: {
            specVersion: '0.0',
            meta: { title: 'Preserve me' },
            blendShapeMaster: {
              blendShapeGroups: [
                { name: 'Blink', presetName: 'blink', binds: [{ mesh: 0, index: 0, weight: 100 }] },
              ],
            },
          },
        }
      : {
          VRMC_vrm: {
            specVersion: '1.0',
            meta: { name: 'Preserve me' },
            expressions: {
              preset: { blink: { morphTargetBinds: [{ node: 0, index: 0, weight: 1 }] } },
            },
          },
        };
  return writeGlb(json, bin);
}
for (const version of [0, 1])
  test(`VRM${version}: preserve original data, append 52 live expressions, repeat safely`, () => {
    const input = fixture(version),
      original = parseGlb(input);
    const result = convert(input, template),
      out = parseGlb(result.buffer);
    assert.equal(result.added, 52);
    assert.deepEqual(
      out.bin.slice(0, original.json.buffers[0].byteLength),
      original.bin.slice(0, original.json.buffers[0].byteLength),
    );
    assert.deepEqual(out.json.materials, original.json.materials);
    assert.equal(out.json.meshes[0].weights.length, 53);
    assert.equal(out.json.meshes[0].primitives[0].targets.length, 53);
    const ext = version === 0 ? out.json.extensions.VRM : out.json.extensions.VRMC_vrm;
    assert.deepEqual(
      ext.meta,
      version === 0 ? original.json.extensions.VRM.meta : original.json.extensions.VRMC_vrm.meta,
    );
    const groups =
      version === 0
        ? ext.blendShapeMaster.blendShapeGroups.slice(1)
        : Object.values(ext.expressions.custom);
    assert.equal(groups.length, 52);
    for (const group of groups) {
      const bind = version === 0 ? group.binds[0] : group.morphTargetBinds[0];
      assert.equal(bind.weight, version === 0 ? 100 : 1);
      const target = out.json.meshes[0].primitives[0].targets[bind.index];
      assert.ok(readAccessor(out, target.POSITION).some((v) => Math.abs(v) > 1e-8));
    }
    assert.equal(convert(result.buffer, template).buffer, result.buffer);
  });
test('corrupt GLB lengths and out-of-bounds accessors are rejected', () => {
  const broken = template.slice(0);
  new DataView(broken).setUint32(8, 20, true);
  assert.throws(() => parseGlb(broken));
  const g = parseGlb(template);
  g.json.accessors[0].byteOffset = 1e9;
  assert.throws(() => readAccessor(g, 0));
});
test('sparse accessors with no base buffer are decoded and invalid indices rejected', () => {
  const bin = new Uint8Array(16);
  bin[0] = 1;
  new DataView(bin.buffer).setFloat32(4, 2, true);
  const g = {
    bin,
    json: {
      buffers: [{ byteLength: 16 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 1 },
        { buffer: 0, byteOffset: 4, byteLength: 12 },
      ],
      accessors: [
        {
          type: 'VEC3',
          componentType: 5126,
          count: 2,
          sparse: {
            count: 1,
            indices: { bufferView: 0, componentType: 5121 },
            values: { bufferView: 1 },
          },
        },
      ],
    },
  };
  assert.deepEqual([...readAccessor(g, 0)], [0, 0, 0, 2, 0, 0]);
  bin[0] = 2;
  assert.throws(() => readAccessor(g, 0));
});
test('partial pre-existing expressions do not get overwritten', () => {
  const g = parseGlb(fixture(1));
  g.json.extensions.VRMC_vrm.expressions.custom = { JawOpen: {} };
  assert.throws(() => convert(writeGlb(g.json, g.bin), template), /衝突/);
});
