import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Read-only local inventory. No model data is uploaded or modified.
export function readGlbJson(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67)
    throw new Error('Invalid GLB header');
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length)
    throw new Error('Invalid GLB version or length');
  let json;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new Error('Truncated chunk header');
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    if (length % 4 || offset + 8 + length > bytes.length)
      throw new Error('Invalid chunk length');
    if (offset === 12 && type !== 0x4e4f534a)
      throw new Error('First chunk must be JSON');
    if (type === 0x4e4f534a) {
      if (json) throw new Error('Duplicate JSON chunk');
      json = JSON.parse(bytes.toString('utf8', offset + 8, offset + 8 + length));
    }
    offset += 8 + length;
  }
  if (!json || typeof json !== 'object' || Array.isArray(json))
    throw new Error('Missing glTF object');
  return json;
}

export function summarize(json) {
  const vrm0 = json.extensions?.VRM;
  const vrm1 = json.extensions?.VRMC_vrm;
  if (!!vrm0 === !!vrm1) throw new Error('Missing or ambiguous VRM extension');
  const groups = vrm0?.blendShapeMaster?.blendShapeGroups ?? [];
  const expressions = vrm1?.expressions ?? {};
  const faceMeshes = new Set();
  for (const group of groups) {
    for (const bind of group.binds ?? []) faceMeshes.add(bind.mesh);
  }
  for (const group of Object.values({ ...expressions.preset, ...expressions.custom })) {
    for (const bind of group.morphTargetBinds ?? []) {
      const mesh = json.nodes?.[bind.node]?.mesh;
      if (mesh === undefined) throw new Error('Expression references a missing mesh node');
      faceMeshes.add(mesh);
    }
  }
  return {
    version: vrm0 ? `0.x (${vrm0.specVersion ?? 'unspecified'})` : vrm1.specVersion,
    generator: json.asset?.generator,
    expressionCount: vrm0 ? groups.length
      : Object.keys(expressions.preset ?? {}).length + Object.keys(expressions.custom ?? {}).length,
    expressionMeshes: [...faceMeshes].map(index => {
      const mesh = json.meshes?.[index];
      if (!mesh) throw new Error('Expression references a missing mesh');
      return {
        index, name: mesh.name,
        targetNames: mesh.extras?.targetNames ?? [],
        primitives: mesh.primitives.map(p => ({
          vertices: json.accessors?.[p.attributes.POSITION]?.count,
          indices: p.indices === undefined ? null : json.accessors?.[p.indices]?.count,
          targets: p.targets?.length ?? 0,
        })),
      };
    }),
  };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const directory = process.argv[2] ?? '_local/vrm';
  let failed = false;
  for (const name of (await readdir(directory)).sort()) {
    if (!name.toLowerCase().endsWith('.vrm')) continue;
    try {
      const bytes = await readFile(join(directory, name));
      console.log(JSON.stringify({ file: name, bytes: bytes.length, ...summarize(readGlbJson(bytes)) }));
    } catch (error) {
      console.error(`${name}: ${error.message}`);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}
