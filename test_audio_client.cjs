const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{value:id==='engine'?'edge':id==='voice'?'th-TH-PremwadeeNeural':'1',classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return []},querySelector(){return null}});return elements.get(id)}
let calls=0; const ctx={document:{getElementById:element,addEventListener(){}},Audio:class{addEventListener(){}},localStorage:{getItem(){return null}},navigator:{},URL:{createObjectURL(){return 'blob:ok'},revokeObjectURL(){}},fetch:async()=>{calls++;return {ok:false,json:async()=>({detail:'service down'})}},AbortController,setTimeout,clearTimeout};
vm.createContext(ctx); let src=fs.readFileSync('public/app.js','utf8').replace(/boot\(\);\s*$/,'');vm.runInContext(src,ctx);
(async()=>{
 await vm.runInContext("state.chunks=['ไทย'];fetchAudio(0)",ctx).catch(()=>{});
 await vm.runInContext('fetchAudio(0)',ctx).catch(()=>{});
 assert.equal(calls,2,'manual retry must perform a fresh request');
 let release;
 ctx.fetch=()=>new Promise(resolve=>{release=resolve});
 const old=vm.runInContext('fetchAudio(0)',ctx);
 vm.runInContext('clearBlobs()',ctx);
 release({ok:true,blob:async()=>({size:8})});
 assert.equal(await old,null,'stale voice response must be discarded');
 assert.equal(vm.runInContext('state.blobs.size',ctx),0);
 ctx.Audio.prototype.pause=function(){};
 vm.runInContext('state.audio.pause=()=>{}',ctx);
 const playback=vm.runInContext('play()',ctx);
 vm.runInContext('pause()',ctx);
 release({ok:true,blob:async()=>({size:8})});
 await playback;
 assert.equal(vm.runInContext('state.playing',ctx),false,'pause while loading must stay paused');
 assert.equal(vm.runInContext('state.audio.src',ctx),undefined,'paused load must not set audio source');
 console.log('PASS retry, stale voice cleanup, pause during load');
})().catch(e=>{console.error(e);process.exitCode=1});
