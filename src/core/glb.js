export function parseGlb(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) throw new Error('有効なGLB形式のVRMではありません。');
  let json, bin;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new Error('GLBチャンクが途中で切れています。');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > bytes.length) throw new Error('GLBチャンクの長さが不正です。');
    if (offset === 12 && type !== 0x4e4f534a) throw new Error('JSONチャンクが先頭にありません。');
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) {
      if (json) throw new Error('JSONチャンクが重複しています。');
      json = JSON.parse(new TextDecoder().decode(chunk));
    } else if (type === 0x004e4942) {
      if (bin) throw new Error('BINチャンクが重複しています。');
      bin = chunk;
    } else throw new Error('未対応のGLBチャンクを含みます。');
    offset += 8 + length;
  }
  if (!json || !bin || json.asset?.version !== '2.0') throw new Error('JSONまたはBINがありません。');
  if (json.buffers?.length !== 1 || json.buffers[0].uri || json.buffers[0].byteLength > bin.length) throw new Error('外部バッファまたは複数バッファは未対応です。');
  if (json.images?.some(x => x.uri)) throw new Error('外部画像参照は未対応です。');
  return { json, bin };
}
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const formats = { 5120: ['getInt8',1],5121:['getUint8',1],5122:['getInt16',2],5123:['getUint16',2],5125:['getUint32',4],5126:['getFloat32',4] };
export function readAccessor(glb, index) {
  const a = glb.json.accessors?.[index];
  if (!a || !components[a.type] || !formats[a.componentType] || !Number.isSafeInteger(a.count) || a.count < 0 || a.count > 10000000) throw new Error('未対応または不正なaccessorです。');
  const width = components[a.type], [method,size] = formats[a.componentType];
  const out = new Float64Array(a.count * width);
  function read(viewIndex, offset, count, stride, write) {
    const b = glb.json.bufferViews?.[viewIndex];
    if (!b || b.buffer !== 0) throw new Error('bufferViewの参照が不正です。');
    const start = (b.byteOffset ?? 0) + offset;
    const end = count ? offset + (count-1)*stride + width*size : offset;
    if (offset < 0 || stride < width*size || end > b.byteLength || start < 0 || start + (end-offset) > glb.json.buffers[0].byteLength) throw new Error('accessorがバッファ範囲外です。');
    const dv = new DataView(glb.bin.buffer, glb.bin.byteOffset, glb.bin.byteLength);
    for (let i=0;i<count;i++) for (let c=0;c<width;c++) {
      let v = dv[method](start+i*stride+c*size,true);
      if (a.normalized && a.componentType !== 5126) v = a.componentType===5120?Math.max(v/127,-1):a.componentType===5122?Math.max(v/32767,-1):v/({5121:255,5123:65535,5125:4294967295}[a.componentType]);
      if (!Number.isFinite(v)) throw new Error('頂点データに非有限値があります。');
      write(i,c,v);
    }
  }
  if (a.bufferView !== undefined) read(a.bufferView,a.byteOffset??0,a.count,glb.json.bufferViews[a.bufferView]?.byteStride??width*size,(i,c,v)=>out[i*width+c]=v);
  if (a.sparse) {
    const s=a.sparse;
    if (!Number.isInteger(s.count) || s.count<1 || s.count>a.count || ![5121,5123,5125].includes(s.indices.componentType)) throw new Error('sparse accessorが不正です。');
    const indices = readAccessor({...glb,json:{...glb.json,accessors:[{bufferView:s.indices.bufferView,byteOffset:s.indices.byteOffset??0,count:s.count,type:'SCALAR',componentType:s.indices.componentType}]}},0);
    let previous=-1;
    for (const i of indices) {if(i<=previous || i>=a.count) throw new Error('sparse indexが不正です。');previous=i;}
    read(s.values.bufferView,s.values.byteOffset??0,s.count,width*size,(i,c,v)=>out[indices[i]*width+c]=v);
  }
  return out;
}
export function writeGlb(json, bin) {
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jl=(encoded.length+3)&~3, bl=(bin.length+3)&~3;
  const output=new ArrayBuffer(28+jl+bl), bytes=new Uint8Array(output), dv=new DataView(output);
  dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,bytes.length,true);
  dv.setUint32(12,jl,true);dv.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+jl);bytes.set(encoded,20);
  dv.setUint32(20+jl,bl,true);dv.setUint32(24+jl,0x004e4942,true);bytes.set(bin,28+jl);
  return output;
}
