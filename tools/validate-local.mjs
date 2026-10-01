import{readFile,readdir,writeFile}from'node:fs/promises';
import{validateBytes}from'gltf-validator';
const reports=[];
for(const file of (await readdir('_local/output')).sort()){
 const inputName=file.replace('_perfectsync.vrm','.vrm');
 const before=await validateBytes(new Uint8Array(await readFile('_local/vrm/'+inputName)),{maxIssues:10000});
 const after=await validateBytes(new Uint8Array(await readFile('_local/output/'+file)),{maxIssues:10000});
 const signature=m=>`${m.code}|${m.pointer}|${m.message}`;
 const known=new Set(before.issues.messages.map(signature));
 const added=after.issues.messages.filter(m=>!known.has(signature(m))&&m.severity<=1);
 reports.push({file,beforeErrors:before.issues.numErrors,afterErrors:after.issues.numErrors,newIssues:added});
 console.log(file,'errors',before.issues.numErrors,'→',after.issues.numErrors,'new issues',added.length);
 if(added.length)process.exitCode=1;
}
await writeFile('_local/validation.json',JSON.stringify(reports,null,2));
