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
 const events=[],focusListeners=new Set();
 const document={activeElement:null,foreground:true,hasFocus(){return this.foreground;}};
 const talkBtn={focus(){events.push('focus Talk');document.activeElement=this;}};
 const micPermission={textContent:'',focus(){events.push('focus explanation');document.activeElement=this;}};
 document.activeElement=talkBtn;
 const window={addEventListener(type,fn){assert.equal(type,'focus');focusListeners.add(fn);},removeEventListener(type,fn){assert.equal(type,'focus');focusListeners.delete(fn);}};
 function returnToPage(){document.foreground=true;for(const fn of [...focusListeners])fn();}
 const c=vm.createContext({active:true,session:1,ctx:context,micPermission,talkBtn,document,tt:key=>I.t('en',key),navigator:{mediaDevices:{getUserMedia(){events.push('request microphone');return request.promise;}},...(permission?{permissions:{query:async()=>({state:permission})}}:{})},window,AudioWorkletNode:function(){this.port={};this.connect=()=>this;this.disconnect=()=>{};},onFrame(){}});
 vm.runInContext(app.slice(app.indexOf('  var stream = null'),app.indexOf('  // Frames are 20 ms.')),c);
 return {c,request,media,tracks,events,returnToPage,focusListeners};
}
test('microphone explanation receives focus before the browser permission request; grant restores Talk',async()=>{
 const {c,request,media,events}=microphone();const done=c.openMic();assert.match(c.micPermission.textContent,/choose Allow/);
 assert.deepEqual(events,['focus explanation','request microphone']);assert.equal(c.document.activeElement,c.micPermission);
 request.resolve(media);await done;assert.equal(c.micPermission.textContent,'');assert.equal(c.stream,media);assert.equal(c.document.activeElement,c.talkBtn);
});
test('denial clears guidance and selects actionable recovery',async()=>{
 const {c,request}=microphone();const done=c.openMic();request.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}));await assert.rejects(done,{name:'NotAllowedError'});assert.equal(c.micPermission.textContent,'');assert.equal(c.document.activeElement,c.talkBtn);
 vm.runInContext(app.slice(app.indexOf('  function micErrorKey'),app.indexOf('  function isSpace')),c);assert.equal(c.micErrorKey({name:'NotAllowedError'}),'errMicDenied');assert.match(I.t('en','errMicDenied'),/permissions.*allow access/);
});
test('granted permission does not repeat guidance',async()=>{
 const {c,request,media,events}=microphone('granted');const done=c.openMic();await Promise.resolve();assert.equal(c.micPermission.textContent,'');request.resolve(media);await done;assert.deepEqual(events,['request microphone']);
});
test('ending while prompt is pending stops late microphone stream',async()=>{
 const {c,request,media,tracks}=microphone();const done=c.openMic();c.active=false;c.session++;c.closeMic();assert.equal(c.document.activeElement,c.talkBtn);request.resolve(media);await assert.rejects(done,{name:'AbortError'});assert.equal(tracks[0].stopped,true);assert.equal(c.stream,null);assert.equal(c.micPermission.textContent,'');
});
test('permission completion preserves an explicit user focus change',async()=>{
 const {c,request,media}=microphone();const done=c.openMic();const link={};c.document.activeElement=link;request.resolve(media);await done;assert.equal(c.document.activeElement,link);
});
test('focus restoration waits while the browser permission prompt owns focus',async()=>{
 const {c,request,media,events,returnToPage,focusListeners}=microphone();const done=c.openMic();c.document.foreground=false;
 request.resolve(media);await done;assert.deepEqual(events,['focus explanation','request microphone']);assert.equal(focusListeners.size,1);
 returnToPage();assert.equal(c.document.activeElement,c.talkBtn);assert.equal(focusListeners.size,0);
});
test('denial waits for window return without taking focus from the browser prompt',async()=>{
 const {c,request,events,returnToPage}=microphone();const done=c.openMic();c.document.foreground=false;
 request.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}));await assert.rejects(done,{name:'NotAllowedError'});
 assert.deepEqual(events,['focus explanation','request microphone']);returnToPage();assert.equal(c.document.activeElement,c.talkBtn);
});
test('a window return preserves focus explicitly moved away from the explanation',async()=>{
 const {c,request,media,returnToPage,focusListeners}=microphone();const done=c.openMic();c.document.foreground=false;request.resolve(media);await done;
 const link={};c.document.activeElement=link;returnToPage();assert.equal(c.document.activeElement,link);assert.equal(focusListeners.size,0);
});
test('ending during the prompt defers restoration; an old result cannot steal newer session focus',async()=>{
 const {c,request,media,events,returnToPage,focusListeners}=microphone();const done=c.openMic();c.document.foreground=false;c.active=false;c.session++;c.closeMic();
 assert.equal(events.includes('focus Talk'),false);c.active=true;c.session++;returnToPage();assert.equal(events.includes('focus Talk'),false);assert.equal(focusListeners.size,0);
 const latestFocus={};c.document.activeElement=latestFocus;request.resolve(media);await assert.rejects(done,{name:'AbortError'});assert.equal(c.document.activeElement,latestFocus);
});
test('a late permission query cannot show or focus explanation after cancellation',async()=>{
 const {c,events}=microphone();const query=deferred();c.navigator.permissions={query:()=>query.promise};const done=c.openMic();c.active=false;c.session++;c.closeMic();
 query.resolve({state:'prompt'});await assert.rejects(done,{name:'AbortError'});assert.deepEqual(events,[]);assert.equal(c.micPermission.textContent,'');
});
test('an unfocused page never pulls focus back to show the explanation',async()=>{
 const {c,request,media,events,returnToPage}=microphone();c.document.foreground=false;const done=c.openMic();assert.deepEqual(events,['request microphone']);
 request.resolve(media);await done;returnToPage();assert.deepEqual(events,['request microphone']);
});
test('old permission result cannot close a new session microphone',async()=>{
 const {c,request,media,tracks}=microphone();const old=c.openMic();c.closeMic();c.session++;const newer=deferred(),newMedia={getTracks:()=>[{stop(){throw Error('new stream must not stop');}}]};c.navigator.mediaDevices.getUserMedia=()=>newer.promise;const latest=c.openMic();newer.resolve(newMedia);await latest;request.resolve(media);await assert.rejects(old,{name:'AbortError'});assert.equal(c.stream,newMedia);assert.equal(tracks[0].stopped,true);
});
test('old permission completion cannot clear or refocus a newer pending explanation',async()=>{
 const {c,request,media,events}=microphone();const old=c.openMic();c.closeMic();c.session++;
 const newer=deferred();c.navigator.mediaDevices.getUserMedia=()=>newer.promise;const latest=c.openMic();const count=events.length;
 request.resolve(media);await assert.rejects(old,{name:'AbortError'});assert.equal(events.length,count);assert.match(c.micPermission.textContent,/choose Allow/);assert.equal(c.document.activeElement,c.micPermission);
 newer.resolve(media);await latest;assert.equal(c.document.activeElement,c.talkBtn);
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
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');const guidance=html.match(/<div id="micPermission"[^>]*>/)[0];
 assert.match(guidance,/tabindex="-1"/);assert.doesNotMatch(guidance,/role=|aria-live=|aria-atomic=/);assert.match(html,/aria-keyshortcuts="Alt\+Shift\+T"/);
});
