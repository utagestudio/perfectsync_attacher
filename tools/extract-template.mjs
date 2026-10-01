import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseGlb, readAccessor, writeGlb } from '../src/core/glb.js';
const path = process.argv[2];
if (!path) throw new Error('Usage: node tools/extract-template.mjs donor.vrm');
const input = await readFile(path),
  source = parseGlb(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
const mesh = source.json.meshes[0],
  groups = source.json.extensions.VRM.blendShapeMaster.blendShapeGroups.filter(
    (g) => g.presetName === 'unknown' && g.name !== 'Surprised',
  );
if (groups.length !== 52) throw new Error('Expected 52 expressions');
const json = {
  asset: { version: '2.0', generator: 'Perfect Sync Attacher template extractor' },
  buffers: [{ byteLength: 0 }],
  bufferViews: [],
  accessors: [],
  materials: source.json.materials.map((m) => ({ name: m.name })),
  meshes: [
    { name: 'Template face', extras: { targetNames: groups.map((g) => g.name) }, primitives: [] },
  ],
  nodes: [{ mesh: 0 }],
  scenes: [{ nodes: [0] }],
  scene: 0,
};
const chunks = [];
let length = 0;
function append(values, type, componentType = 5126) {
  const array = componentType === 5125 ? new Uint32Array(values) : new Float32Array(values);
  const data = new Uint8Array(array.buffer);
  const offset = (length + 3) & ~3;
  if (offset > length) chunks.push(new Uint8Array(offset - length));
  chunks.push(data);
  length = offset + data.length;
  const bv = json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length }) - 1;
  const a = {
    bufferView: bv,
    componentType,
    count: values.length / { SCALAR: 1, VEC2: 2, VEC3: 3 }[type],
    type,
  };
  if (type === 'VEC3') {
    a.min = [Infinity, Infinity, Infinity];
    a.max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < values.length; i++) {
      a.min[i % 3] = Math.min(a.min[i % 3], array[i]);
      a.max[i % 3] = Math.max(a.max[i % 3], array[i]);
    }
  }
  return json.accessors.push(a) - 1;
}
const base = mesh.primitives[0];
const position = readAccessor(source, base.attributes.POSITION),
  uv = readAccessor(source, base.attributes.TEXCOORD_0);
const attributes = { POSITION: append(position, 'VEC3'), TEXCOORD_0: append(uv, 'VEC2') };
const targets = groups.map((g) => {
  const delta = new Float32Array(position.length);
  for (const bind of g.binds) {
    if (bind.mesh !== 0) throw new Error('Unexpected donor bind');
    const a = base.targets[bind.index].POSITION;
    if (a === undefined) continue;
    const d = readAccessor(source, a);
    for (let i = 0; i < d.length; i++) delta[i] += (d[i] * bind.weight) / 100;
  }
  return { POSITION: append(delta, 'VEC3') };
});
for (const p of mesh.primitives)
  json.meshes[0].primitives.push({
    attributes,
    indices: append(readAccessor(source, p.indices), 'SCALAR', 5125),
    material: p.material,
    targets,
  });
json.buffers[0].byteLength = length;
const bin = new Uint8Array(length);
let offset = 0;
for (const c of chunks) {
  bin.set(c, offset);
  offset += c.length;
}
await writeFile('public/templates/hinzka-female.glb', new Uint8Array(writeGlb(json, bin)));
await writeFile(
  'public/templates/provenance.json',
  JSON.stringify(
    {
      source: 'https://github.com/hinzka/52blendshapes-for-VRoid-face',
      file: 'VRoid_V110_Female_v1.1.3.vrm',
      sha256: createHash('sha256').update(input).digest('hex'),
      retrieved: '2026-10-01',
      expressions: groups.map((g) => g.name),
      note: 'Weighted donor clips baked into POSITION deltas. See SOURCE-README.md for source terms.',
    },
    null,
    2,
  ) + '\n',
);
console.log('Extracted 52 weighted expressions:', length, 'bytes');
