import { readAccessor } from './glb.js';
export const uvKey = (uv, i) =>
  `${Math.round(uv[i * 2] * 100000)},${Math.round(uv[i * 2 + 1] * 100000)}`;
export function materialRole(name = '') {
  return name
    .match(
      /(?:FaceMouth|EyeIris|EyeHighlight|EyeWhite|FaceBrow|FaceEyelash|FaceEyeline|Face)_/,
    )?.[0]
    ?.slice(0, -1);
}
export function primitiveGeometry(glb, p) {
  if (p.mode !== undefined && p.mode !== 4) throw new Error('三角形以外の顔メッシュは未対応です。');
  if (
    glb.json.accessors?.[p.attributes?.POSITION]?.count > 50000 ||
    glb.json.accessors?.[p.indices]?.count > 300000
  )
    throw new Error('顔メッシュが処理上限を超えています。');
  const positionAccessor = glb.json.accessors?.[p.attributes?.POSITION];
  const uvAccessor = glb.json.accessors?.[p.attributes?.TEXCOORD_0];
  const indexAccessor = glb.json.accessors?.[p.indices];
  if (
    positionAccessor?.type !== 'VEC3' ||
    positionAccessor.componentType !== 5126 ||
    uvAccessor?.type !== 'VEC2' ||
    (p.indices !== undefined &&
      (indexAccessor?.type !== 'SCALAR' ||
        indexAccessor.normalized ||
        ![5121, 5123, 5125].includes(indexAccessor.componentType)))
  )
    throw new Error('顔メッシュのaccessor形式が不正です。');
  const position = readAccessor(glb, p.attributes.POSITION),
    uv = readAccessor(glb, p.attributes.TEXCOORD_0);
  if (position.length / 3 !== uv.length / 2) throw new Error('UVと頂点数が一致しません。');
  const indices =
    p.indices === undefined
      ? Float64Array.from({ length: position.length / 3 }, (_, i) => i)
      : readAccessor(glb, p.indices);
  if (indices.length % 3) throw new Error('三角形indicesが不正です。');
  const neighbors = new Map();
  for (let i = 0; i < indices.length; i += 3)
    for (let a = 0; a < 3; a++) {
      const v = indices[i + a];
      if (!Number.isInteger(v) || v < 0 || v >= position.length / 3)
        throw new Error('頂点indexが範囲外です。');
      const set = neighbors.get(v) ?? new Set();
      set.add(indices[i + ((a + 1) % 3)]);
      set.add(indices[i + ((a + 2) % 3)]);
      neighbors.set(v, set);
    }
  const vertices = [...neighbors.keys()];
  const signatures = new Map(
    vertices.map((i) => [
      i,
      [...neighbors.get(i)]
        .map((j) => uvKey(uv, j))
        .sort()
        .join('|'),
    ]),
  );
  return { position, uv, indices, vertices, signatures };
}
export function mapGeometry(source, target) {
  const pool = new Map();
  for (const i of source.vertices) {
    const k = uvKey(source.uv, i),
      list = pool.get(k) ?? [];
    list.push(i);
    pool.set(k, list);
  }
  const mapping = new Map();
  for (const i of target.vertices) {
    let candidates = pool.get(uvKey(target.uv, i)) ?? [];
    if (candidates.length > 1)
      candidates = candidates.filter((j) => source.signatures.get(j) === target.signatures.get(i));
    if (candidates.length !== 1)
      throw new Error(`UVの頂点対応が確定できません（頂点${i}、候補${candidates.length}）。`);
    mapping.set(i, candidates[0]);
  }
  return mapping;
}
export function fitAxes(source, target, mapping) {
  const transforms = [];
  for (let c = 0; c < 3; c++) {
    let sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0,
      n = 0;
    for (const [i, j] of mapping) {
      const x = source.position[j * 3 + c],
        y = target.position[i * 3 + c];
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
      n++;
    }
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-12) throw new Error('顔の座標補正を推定できません。');
    const scale = (n * sxy - sx * sy) / den,
      offset = (sy - scale * sx) / n;
    if (!Number.isFinite(scale) || Math.abs(scale) < 0.1 || Math.abs(scale) > 5)
      throw new Error('顔の座標補正が対応範囲外です。');
    transforms.push({ scale, offset });
  }
  return transforms;
}
export function mapWithTransform(source, target, transforms) {
  const pool = new Map();
  for (const j of source.vertices) {
    const k = uvKey(source.uv, j),
      a = pool.get(k) ?? [];
    a.push(j);
    pool.set(k, a);
  }
  const result = new Map();
  for (const i of target.vertices) {
    let choices = pool.get(uvKey(target.uv, i)) ?? [];
    if (choices.length > 1) {
      const narrowed = choices.filter((j) => source.signatures.get(j) === target.signatures.get(i));
      if (narrowed.length) choices = narrowed;
    }
    if (choices.length > 1) {
      const ranked = choices
        .map((j) => ({
          j,
          d: transforms.reduce(
            (sum, t, c) =>
              sum +
              (t.scale * source.position[j * 3 + c] + t.offset - target.position[i * 3 + c]) ** 2,
            0,
          ),
        }))
        .sort((a, b) => a.d - b.d);
      if (ranked[1].d - ranked[0].d < 1e-8) throw new Error('重複UVの左右対応が曖昧です。');
      choices = [ranked[0].j];
    }
    if (choices.length !== 1) throw new Error(`UVの頂点対応が確定できません（頂点${i}）。`);
    result.set(i, choices[0]);
  }
  return result;
}
