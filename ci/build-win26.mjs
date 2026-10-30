// A1b CI: compile an exact-Node26 native forwarder and test its real stopping flag.
// NO Tencent binaries, QQ login, account data or network operations.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const output = path.join(root, '.ci-work/build');
const official = path.join(root, '.ci-work/downloads');
const sourceRoot = path.join(root, '.ci-work/source/node-v26.7.0');
const node = path.join(official, 'node.exe');
const nodeLib = path.join(official, 'node.lib');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function insist(ok, message) {
  if (!ok) throw Error('[A1B] '+message);
}
function run(exe,args,options={}) {
  const ret = spawnSync(exe,args,{
    cwd:options.cwd||root, encoding:'utf8', windowsHide:true,
    stdio:options.capture?'pipe':'inherit',
    timeout:120000,maxBuffer:10*1024*1024,
  });
  if (ret.error || ret.status!==0) {
    throw Error('[A1B] '+exe+' failed exit='+ret.status+
      ' '+String(ret.error?.message||ret.stderr||ret.stdout||'').slice(-4200));
  }
  return ret.stdout||'';
}
insist(process.platform==='win32' && process.arch==='x64','requires native Windows x64');
insist(fs.existsSync(node)&&fs.existsSync(nodeLib),'official Node binary/library missing');
const expectedNode='e921fe5307e29bf6fd00000dd594356affd3a7b044e52720c7f10decbdc305b9';
insist(hash(node)===expectedNode,'Node binary differs from pinned runtime');
const cfg = JSON.parse(run(node,[
  '-e','console.log(JSON.stringify({version:process.version,arch:process.arch,vars:process.config.variables}))',
],{capture:true}));
insist(cfg.version==='v26.7.0'&&cfg.arch==='x64','Node version/architecture mismatch');
insist(Boolean(cfg.vars.node_use_openssl)&&Boolean(cfg.vars.v8_enable_inspector),
  'official feature configuration differs from expected');
const versionHeader=path.join(sourceRoot,'src/node_version.h');
insist(fs.existsSync(versionHeader)&&fs.existsSync(path.join(sourceRoot,'src/env-inl.h')),
  'Node complete source missing');
const header=fs.readFileSync(versionHeader,'utf8');
for(const [macro,num] of [['NODE_MAJOR_VERSION',26],['NODE_MINOR_VERSION',7],['NODE_PATCH_VERSION',0]]) {
  insist(new RegExp('#define\\s+'+macro+'\\s+'+num+'\\b').test(header),
    'official source version mismatch: '+macro);
}
fs.mkdirSync(output,{recursive:true});
fs.mkdirSync(path.join(root,'evidence'),{recursive:true});

// Validate EVERY PE forwarder points to a real export of this exact Node.exe.
// This metadata is a name-only snapshot from the local QQNT 9.9.36 PE imports.
function peExports(filename) {
  const b=fs.readFileSync(filename);
  const u16=i=>b.readUInt16LE(i),u32=i=>b.readUInt32LE(i);
  insist(b.toString('ascii',0,2)==='MZ','not PE binary');
  const nt=u32(0x3c);
  insist(b.toString('ascii',nt,nt+4)==='PE\0\0','PE header invalid');
  insist(u16(nt+4)===0x8664,'Node architecture not x64');
  const opt=nt+24;
  insist(u16(opt)===0x20b,'PE32+ required');
  const first=opt+u16(nt+20),sections=[];
  for(let i=0;i<u16(nt+6);i++){
    const p=first+i*40;
    sections.push({va:u32(p+12),size:Math.max(u32(p+8),u32(p+16)),offset:u32(p+20)});
  }
  const toFile=rva=>{
    const s=sections.find(s=>rva>=s.va&&rva<s.va+s.size);
    insist(Boolean(s),'RVA points outside PE');
    return s.offset+rva-s.va;
  };
  const readCString=at=>{
    const end=b.indexOf(0,at);
    insist(end>at && end-at<520,'invalid PE export name');
    return b.toString('ascii',at,end);
  };
  const dir=opt+112;
  const exp=toFile(u32(dir)),count=u32(exp+24),names=toFile(u32(exp+32));
  insist(count>500 && count<25000,'unexpected Node PE export count');
  const namesSet=new Set();
  for(let i=0;i<count;i++)namesSet.add(readCString(toFile(u32(names+i*4))));
  return namesSet;
}
const available=peExports(node);
const def=path.join(root,'abi/QQNT-9.9.36-x64.def');
const lines=fs.readFileSync(def,'utf8').split(/\r?\n/)
  .map(x=>x.trim()).filter(x=>x&&x!=='LIBRARY QQNT'&&x!=='EXPORTS');
insist(lines.length===99,'QQ 9.9.36 expected exactly 99 imports, got '+lines.length);
insist(lines.includes(
  '?IsEnvironmentStopping@node@@YA_NPEAVIsolate@v8@@@Z=qq_a1b_real_environment_stopping'
),'real stopping-state symbol alias missing');
insist(lines.includes('qq_magic_napi_register=node.exe.napi_module_register'),
  'QQ native register mapping absent');
let forwarded=0;
for(const line of lines) {
  const idx=line.indexOf('=node.exe.');
  if(idx<0)continue;
  const exportName=line.slice(idx+'=node.exe.'.length);
  insist(available.has(exportName),'missing Node export: '+exportName);
  forwarded++;
}
insist(forwarded===98,'expected 98 Node forwarders, got '+forwarded);
console.log('[A1B] Imported symbol contract: 98 verified forwarders and 1 real predicate');

const includes=[
  'src','deps/v8/include','deps/uv/include','deps/simdjson','deps/simdutf',
  'deps/ada','deps/openssl/openssl/include','deps/openssl/config',
  'deps/openssl/config/archs/VC-WIN64A/asm/include',
].filter(rel=>fs.existsSync(path.join(sourceRoot,rel)))
 .map(rel=>'/I'+path.join(sourceRoot,rel));
const args=[
  '/nologo','/LD','/std:c++20','/Zc:__cplusplus','/Zc:inline',
  '/EHsc','/MD','/O2','/Gy','/Gw','/DNOMINMAX',
  '/D_ITERATOR_DEBUG_LEVEL=0','/DBUILDING_NODE_EXTENSION=1',
  '/DHAVE_INSPECTOR=1','/DHAVE_OPENSSL=1','/DNODE_USE_V8_PLATFORM=1',
  '/DHAVE_SQLITE='+(cfg.vars.node_use_sqlite ? '1' : '0'),
  ...(cfg.vars.node_use_amaro?['/DHAVE_AMARO=1']:[]),
  ...(cfg.vars.v8_enable_pointer_compression?['/DV8_COMPRESS_POINTERS']:[]),
  ...(cfg.vars.v8_enable_sandbox?['/DV8_ENABLE_SANDBOX']:[]),
  ...includes,
];
const shim=path.join(output,'QQNT.dll');
const sources=[
  path.join(root,'src/bootstrap.c'),
  path.join(root,'src/environment-stopping-26.cc'),
];
const simdjson=path.join(sourceRoot,'deps/simdjson/simdjson.cpp');
if(fs.existsSync(simdjson))sources.push(simdjson);
console.log('[A1B] Compile exact-Node26 native adapter...');
run('cl.exe',[...args,'/DNODE_WANT_INTERNALS=1',...sources,
  '/link','/OPT:REF',nodeLib,'/DEF:'+def,'/OUT:'+shim],{cwd:output});
const verify=path.join(output,'verify-stopping.node');
console.log('[A1B] Compile native Node::Stop transition probe...');
run('cl.exe',[...args,path.join(root,'src/verify-stopping-26.cc'),
  '/link','/OPT:REF',nodeLib,'/OUT:'+verify],{cwd:output});

// Intentionally stop Node from inside the native callback in a disposable
// child process. No QQ wrapper is needed for this precisely scoped ABI proof.
const code='const m={exports:{}};process.dlopen(m,'+
  JSON.stringify(shim)+');require('+JSON.stringify(verify)+').verify()';
const child=spawnSync(node,['-e',code],{
  cwd:output,windowsHide:true,encoding:'utf8',timeout:14000,
  maxBuffer:1024*1024,
});
const line=String(child.stdout||'').split(/\r?\n/)
  .find(x=>x.includes('"test":"Node26_is_stopping_transition"'));
let proof;
try{proof=JSON.parse(line);}catch{proof=null;}
if(child.stdout) console.log('[A1B] Child output '+String(child.stdout).slice(-1300));
if(child.stderr) console.error('[A1B] Child stderr '+String(child.stderr).slice(-1300));
const success=child.status===0 && proof?.pass===true &&
  proof?.nullIsolate===true && proof?.before===false &&
  proof?.stopRc===0 && proof?.after===true;
insist(success,'real Node26 stop-state transition failed (exit='+child.status+')');
const report={
  result:'passed',
  test:'real Node26 Environment::is_stopping() transition',
  nodeVersion:cfg.version,
  nodeExeSha256:hash(node),
  nodeLibSha256:hash(nodeLib),
  nodeVersionHeaderSha256:hash(versionHeader),
  nodeConfigSha256:crypto.createHash('sha256').update(JSON.stringify(cfg.vars)).digest('hex'),
  qqReferenceVersion:'9.9.36-53644',
  vendorBinariesIncluded:false,
  nativeShimSha256:hash(shim),
  nativeVerifierSha256:hash(verify),
  proof,
  limitations:'No QQ login/session/messages/lockscreen/real shutdown yet tested',
};
fs.writeFileSync(path.join(root,'evidence/node26-stopping.json'),JSON.stringify(report,null,2)+'\n');
console.log('[A1B] REAL_NODE_STOPPING_PASS '+JSON.stringify(proof));
