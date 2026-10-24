const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const I = require('../public/i18n');
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise, resolve, reject}; }
function microphone(permission) {
 const request=deferred(), tracks=[{stopped:false,stop(){this.stopped=true;}}];
 const media={getTracks:()=>tracks,getAudioTracks:()=>[{getSettings:()=>({sampleRate:48000})}]};
 const context={createMediaStreamSource:()=>({connect(){},disconnect(){}}),audioWorklet:{addModule:async()=>{}},createGain:()=>({gain:{},connect(){return this;},disconnect(){}}),destination:{}};
 const c=vm.createContext({active:true,session:1,ctx:context,micPermission:{textContent:''},tt:key=>I.t('en',key),navigator:{mediaDevices:{getUserMedia:()=>request.promise},...(permission?{permissions:{query:async()=>({state:permission})}}:{})},window:{},AudioWorkletNode:function(){this.port={};this.connect=()=>this;this.disconnect=()=>{};},onFrame(){}});
 vm.runInContext(app.slice(app.indexOf('  var stream = null'),app.indexOf('  // Frames are 20 ms.')),c);
 return {c,request,media,tracks};
}
test('microphone pending guidance clears on grant',async()=>{
 const {c,request,media}=microphone();const done=c.openMic();assert.match(c.micPermission.textContent,/choose Allow/);request.resolve(media);await done;assert.equal(c.micPermission.textContent,'');assert.equal(c.stream,media);
});
test('denial clears guidance and selects actionable recovery',async()=>{
 const {c,request}=microphone();const done=c.openMic();request.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}));await assert.rejects(done,{name:'NotAllowedError'});assert.equal(c.micPermission.textContent,'');
 vm.runInContext(app.slice(app.indexOf('  function micErrorKey'),app.indexOf('  function isSpace')),c);assert.equal(c.micErrorKey({name:'NotAllowedError'}),'errMicDenied');assert.match(I.t('en','errMicDenied'),/permissions.*allow access/);
});
test('granted permission does not repeat guidance',async()=>{
 const {c,request,media}=microphone('granted');const done=c.openMic();await Promise.resolve();assert.equal(c.micPermission.textContent,'');request.resolve(media);await done;
});
test('ending while prompt is pending stops late microphone stream',async()=>{
 const {c,request,media,tracks}=microphone();const done=c.openMic();c.active=false;c.session++;c.closeMic();request.resolve(media);await assert.rejects(done,{name:'AbortError'});assert.equal(tracks[0].stopped,true);assert.equal(c.stream,null);assert.equal(c.micPermission.textContent,'');
});
test('old permission result cannot close a new session microphone',async()=>{
 const {c,request,media,tracks}=microphone();const old=c.openMic();c.closeMic();c.session++;const newer=deferred(),newMedia={getTracks:()=>[{stop(){throw Error('new stream must not stop');}}]};c.navigator.mediaDevices.getUserMedia=()=>newer.promise;const latest=c.openMic();newer.resolve(newMedia);await latest;request.resolve(media);await assert.rejects(old,{name:'AbortError'});assert.equal(c.stream,newMedia);assert.equal(tracks[0].stopped,true);
});
function keyboard(){
 const c=vm.createContext({active:true,talkBtn:{focus(){c.focused=true;}},onTalkPress(){c.talked=(c.talked||0)+1;},endConversation(){},document:{addEventListener(type,fn){c.handler=fn;}}});
 vm.runInContext(app.slice(app.indexOf('  function isOtherControl'),app.indexOf('  ["keydown"')),c);
 const start=app.indexOf('  document.addEventListener("keydown", function (e) {\n    if (isTalkShortcut');vm.runInContext(app.slice(start,app.indexOf('\n\n  langBtn.addEventListener',start)),c);return c;
}
test('Talk shortcut works from footer; Space stays native on links',()=>{
 const c=keyboard(),link={closest:()=>true},e={key:'T',code:'KeyT',altKey:true,shiftKey:true,target:link,preventDefault(){this.prevented=true;}};c.handler(e);assert.equal(e.prevented,true);assert.equal(c.talked,1);assert.equal(c.focused,true);c.handler({key:' ',target:link,preventDefault(){throw Error('Space on link must remain native');}});assert.equal(c.talked,1);
});
test('shortcut repeats suppressed; other modifier combinations rejected',()=>{
 const c=keyboard(),e={key:'T',code:'KeyT',altKey:true,shiftKey:true,repeat:true,preventDefault(){}};c.handler(e);assert.equal(c.talked,undefined);assert.equal(c.isTalkShortcut({...e,ctrlKey:true}),false);
});
test('all languages and HTML expose permission guidance and shortcut',()=>{
 for(const lang of ['en','it','fr','bg','ru','zh'])for(const key of ['micPending','errMicDenied','shortcutHelp'])assert.ok(I.S[lang][key],`${lang}/${key}`);
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');assert.match(html,/id="micPermission" role="status"/);assert.match(html,/aria-keyshortcuts="Alt\+Shift\+T"/);
});
