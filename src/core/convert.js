import {parseGlb,readAccessor,writeGlb} from './glb.js';
import {materialRole,primitiveGeometry,mapGeometry,mapWithTransform,fitAxes} from './mapping.js';
const fail = message => {throw new Error(message);};
function faceMesh(json) {
  const vrm0=json.extensions?.VRM,vrm1=json.extensions?.VRMC_vrm;
  if(!!vrm0===!!vrm1)fail('VRM形式を識別できません。');
  if(vrm1 && vrm1.specVersion!=='1.0')fail('VRM 1.0以外の新形式は未対応です。');
  const refs=new Set();
  if(vrm0)for(const g of vrm0.blendShapeMaster?.blendShapeGroups??[])for(const b of g.binds??[])refs.add(b.mesh);
  else for(const g of Object.values({...vrm1.expressions?.preset,...vrm1.expressions?.custom}))for(const b of g.morphTargetBinds??[])refs.add(json.nodes?.[b.node]?.mesh);
  const candidates=[...refs].filter(i=>json.meshes?.[i]?.primitives.some(p=>materialRole(json.materials?.[p.material]?.name)==='Face'));
  if(candidates.length!==1)fail('表情対象の顔メッシュが一意に見つかりません。');
  const index=candidates[0],mesh=json.meshes[index];
  if(mesh.primitives.some(p=>!materialRole(json.materials?.[p.material]?.name)))fail('顔と身体が結合されたモデルは、このプロトタイプでは未対応です。');
  for(const n of json.nodes??[])if(n.mesh===index && (n.matrix || n.rotation || n.scale || n.translation))fail('顔nodeに座標変換があるモデルは未対応です。');
  for(const a of json.animations??[])for(const c of a.channels??[])if(c.target.path==='weights'&&json.nodes[c.target.node]?.mesh===index)fail('顔の表情アニメーションを含むモデルは未対応です。');
  if(json.extensionsRequired?.some(x=>!['VRM','VRMC_vrm','VRMC_springBone','VRMC_materials_mtoon','VRMC_materials_hdr_emissiveMultiplier','VRMC_node_constraint','KHR_materials_unlit','KHR_texture_transform'].includes(x)))fail('未対応の必須extensionを含みます。');
  if(mesh.primitives.some(p=>p.extensions?.KHR_draco_mesh_compression))fail('圧縮された顔メッシュは未対応です。');
  return {index,mesh,vrm0,vrm1};
}
function geometryGroups(glb,mesh) {
  const groups=new Map();
  for(const p of mesh.primitives){const role=materialRole(glb.json.materials[p.material]?.name),g=primitiveGeometry(glb,p),old=groups.get(role);
    if(old){if(old.position.length!==g.position.length)fail('供体の頂点構造が不正です。');old.vertices=[...new Set([...old.vertices,...g.vertices])];old.indices=Float64Array.from([...old.indices,...g.indices]);for(const [i,s] of g.signatures)old.signatures.set(i,s);}
    else groups.set(role,g);
  }
  return groups;
}
function normalField(position,indices) {
  const field=new Float32Array(position.length);
  for(let k=0;k<indices.length;k+=3){const a=indices[k]*3,b=indices[k+1]*3,c=indices[k+2]*3;
    const u=[0,1,2].map(i=>position[b+i]-position[a+i]),v=[0,1,2].map(i=>position[c+i]-position[a+i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    for(const j of [a,b,c])for(let i=0;i<3;i++)field[j+i]+=n[i];
  }
  for(let i=0;i<field.length;i+=3){const l=Math.hypot(field[i],field[i+1],field[i+2]);if(l)for(let c=0;c<3;c++)field[i+c]/=l;}
  return field;
}
export function convert(input,templateBuffer,progress=()=>{}) {
  progress('VRMを解析しています',5);
  const glb=parseGlb(input),template=parseGlb(templateBuffer),json=glb.json;
  const {index,mesh,vrm0,vrm1}=faceMesh(json),sourceMesh=template.json.meshes[0];
  const names=sourceMesh.extras.targetNames;
  if(names.length!==52||new Set(names).size!==52)fail('テンプレートの52表情が不正です。');
  const existingNames=mesh.extras?.targetNames??[];
  const existingExpressions=vrm0?(vrm0.blendShapeMaster?.blendShapeGroups??[]).map(g=>g.name):Object.keys(vrm1.expressions?.custom??{});
  const reserved=new Set([...existingNames,...existingExpressions].map(n=>n.toLowerCase()));
  const present=names.filter(n=>reserved.has(n.toLowerCase()));
  if(present.length===52) {
    const mark=json.asset.extras?.perfectsyncAttacher;
    if(mark?.template==='hinzka-female-v1.1.3'&&names.every(n=>existingNames.includes(n[0].toLowerCase()+n.slice(1))&&existingExpressions.includes(n)))return {buffer:input,added:0,existing:52,version:vrm0?'0.x':'1.0',warnings:['このツールで変換済みです。既存データをそのまま返します。']};
    fail('既存のPerfect Sync表情があります。上書きを避けるため変換を停止しました。');
  }
  if(present.length)fail('既存のPerfect Sync表情があります。部分的な衝突の修復は未対応です。');
  const targetCount=mesh.primitives[0].targets?.length??0;
  if(existingNames.length!==targetCount||new Set(existingNames).size!==existingNames.length||mesh.primitives.some(p=>(p.targets?.length??0)!==targetCount))fail('既存の表情名またはtarget数が一致しません。');
  const sourceGroups=geometryGroups(template,sourceMesh);
  const parts=mesh.primitives.map(p=>({p,role:materialRole(json.materials[p.material]?.name),geometry:primitiveGeometry(glb,p)}));
  const skin=parts.find(p=>p.role==='Face');if(!skin)fail('顔の基準領域がありません。');
  const skinMap=mapGeometry(sourceGroups.get('Face'),skin.geometry);
  const axes=fitAxes(sourceGroups.get('Face'),skin.geometry,skinMap);
  const areaGroups=new Map();
  for(const part of parts){const source=sourceGroups.get(part.role);if(!source)fail('テンプレートに必要な顔パーツがありません。');
    const map=mapWithTransform(source,part.geometry,axes);
    if(['Face','FaceMouth'].includes(part.role)){
      const triangleKey=(a,b,c)=>[a,b,c].sort((x,y)=>x-y).join(',');
      const triangles=new Set();for(let k=0;k<source.indices.length;k+=3)triangles.add(triangleKey(...source.indices.slice(k,k+3)));
      for(let k=0;k<part.geometry.indices.length;k+=3){const tri=Array.from(part.geometry.indices.slice(k,k+3),i=>map.get(i));if(!triangles.has(triangleKey(...tri)))fail('顔または口内の三角形構造がテンプレートと一致しません。');}
    }
    const key=`${part.p.attributes.POSITION}:${part.p.attributes.NORMAL}`;
    let group=areaGroups.get(key);
    if(!group){group={geometry:part.geometry,mapping:new Map(),parts:[],indices:[]};areaGroups.set(key,group);}
    for(const [i,j] of map){if(group.mapping.has(i)&&group.mapping.get(i)!==j)fail('パーツ間の頂点対応が矛盾しています。');group.mapping.set(i,j);}
    group.parts.push(part.p);group.indices.push(...part.geometry.indices);
  }
  progress('顔の対応を確認しました',15);
  const chunks=[glb.bin.subarray(0,json.buffers[0].byteLength)];let length=chunks[0].length;
  json.bufferViews??=[];json.accessors??=[];
  function append(values){const floats=new Float32Array(values);const offset=(length+3)&~3;if(offset>length)chunks.push(new Uint8Array(offset-length));const bytes=new Uint8Array(floats.buffer);chunks.push(bytes);length=offset+bytes.length;
    const bv=json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length})-1,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<floats.length;i++){if(!Number.isFinite(floats[i]))fail('変形データの値が不正です。');min[i%3]=Math.min(min[i%3],floats[i]);max[i%3]=Math.max(max[i%3],floats[i]);}
    return json.accessors.push({bufferView:bv,componentType:5126,count:floats.length/3,type:'VEC3',min,max})-1;
  }
  for(const group of areaGroups.values())group.baseNormals=normalField(group.geometry.position,group.indices);
  for(let s=0;s<names.length;s++){
    const delta=readAccessor(template,sourceMesh.primitives[0].targets[s].POSITION);let changed=0;
    for(const group of areaGroups.values()){
      const base=group.geometry.position,moved=new Float64Array(base),d=new Float32Array(base.length);
      for(const [i,j] of group.mapping)for(let c=0;c<3;c++){d[i*3+c]=delta[j*3+c]*axes[c].scale;moved[i*3+c]+=d[i*3+c];if(Math.abs(d[i*3+c])>1e-8)changed++;}
      const target={POSITION:append(d)};
      if(group.parts[0].attributes.NORMAL!==undefined){const newNormals=normalField(moved,group.indices),nd=new Float32Array(base.length);for(let i=0;i<nd.length;i++)nd[i]=newNormals[i]-group.baseNormals[i];target.NORMAL=append(nd);}
      for(const p of group.parts){p.targets??=[];p.targets.push({...target});}
    }
    if(!changed)fail(`${names[s]}に有効な変形がありません。`);
    progress(`${names[s]}を追加しています`,15+Math.round((s+1)/52*70));
  }
  mesh.extras??={};mesh.extras.targetNames=[...existingNames,...names.map(n=>n[0].toLowerCase()+n.slice(1))];
  function weights(w){if(w&&w.length!==targetCount)fail('既存weight数が不正です。');return [...(w??Array(targetCount).fill(0)),...Array(52).fill(0)];}
  mesh.weights=weights(mesh.weights);for(const n of json.nodes??[])if(n.mesh===index&&n.weights)n.weights=weights(n.weights);
  if(vrm0){vrm0.blendShapeMaster??={blendShapeGroups:[]};for(let s=0;s<52;s++)vrm0.blendShapeMaster.blendShapeGroups.push({name:names[s],presetName:'unknown',isBinary:false,binds:[{mesh:index,index:targetCount+s,weight:100}],materialValues:[]});}
  else{vrm1.expressions??={};vrm1.expressions.custom??={};const nodes=json.nodes.flatMap((n,i)=>n.mesh===index?[i]:[]);for(let s=0;s<52;s++)vrm1.expressions.custom[names[s]]={isBinary:false,overrideBlink:'none',overrideMouth:'none',overrideLookAt:'none',morphTargetBinds:nodes.map(node=>({node,index:targetCount+s,weight:1}))};}
  json.asset.extras??={};json.asset.extras.perfectsyncAttacher={template:'hinzka-female-v1.1.3',method:'UV correspondence with axis fit',prototype:true};
  json.buffers[0].byteLength=length;const bin=new Uint8Array(length);let offset=0;for(const c of chunks){bin.set(c,offset);offset+=c.length;}
  progress('出力を検証しています',90);const buffer=writeGlb(json,bin),check=parseGlb(buffer);
  for(const p of check.json.meshes[index].primitives)for(const t of p.targets.slice(targetCount))for(const a of Object.values(t))readAccessor(check,a);
  progress('変換が完了しました',100);
  return {buffer,added:52,existing:0,version:vrm0?'0.x':'1.0',warnings:['顔形状に合わせた簡易補正を使用しています。表情の見た目を確認してください。','WebcamMotionCapture／VSeeFaceでの動作は未検証です。']};
}
