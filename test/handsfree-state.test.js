const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const app=fs.readFileSync(require.resolve('../public/app.js'),'utf8'),C=require('../public/app-capabilities'),I=require('../public/i18n');
function harness(){
 const events=[],c=vm.createContext({C,I,paused:false,continuous:true,active:true,session:1,state:'processing',talkLabel:false,pendingTalk:false,
  stream:{},rec:null,recResolve:null,ctx:{sampleRate:16000},noise:.004,muteUntil:0,speed:1,lang:'en',spokenEcho:'',echoUntil:0,
  document:{body:{setAttribute(){}},documentElement:{},activeElement:{},hasFocus:()=>true},talkBtn:{focus(){events.push('focus')},textContent:''},
  performance:{now:()=>10000},IS_TOUCH:false,tt:k=>I.t('en',k),tk:k=>I.t('en',k),sounds:{turn(){},stop(){}},buzz(){},
  stopSpeaking:()=>events.push('stop'),stopThinking(){},closeMic(){events.push('close');c.stream=null;},renderTexts(){},
  ensureMic:async()=>{events.push('open');c.stream={};},fail:key=>events.push(key),micErrorKey:()=> 'errMic',
  say:async text=>events.push(text),setTimeout,clearTimeout,setInterval,clearInterval});
 const load=(a,b)=>vm.runInContext(app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a))),c);
 load('  function setState(', '  // ---------- mute gate');load('  function goReady(', '  var recResolve');
 load('  var SEVEN_SECONDS', '  function encodeWav');load('  async function togglePause(', '  var ctrlTap');
 return {c,events,load};
}
test('ready automatically listens and silence never submits or repeats reminders',async()=>{
 const {c,events}=harness();await c.goReady();assert.equal(c.state,'listening');assert.equal(c.talkBtn.textContent,'Pause');
 c.finishRecording=()=>{throw Error('Silence must not be sent')};for(let i=0;i<1000;i++)c.onFrame(new Float32Array(320));assert.equal(c.state,'listening');assert.deepEqual(events,[]);
});
test('sustained speech interrupts playback and preserves the recorded start',()=>{
 const {c,events}=harness();c.state='speaking';c.rec={auto:false,frames:[],elapsed:0,voiced:0,silence:0,speechFrames:0,speechStarted:false};
 for(let i=0;i<15;i++)c.onFrame(new Float32Array(320).fill(.1));
 assert.equal(c.state,'listening');assert.equal(c.session,2);assert.equal(c.rec.frames.length,15);assert.deepEqual(events,['stop']);
});
test('short playback residuals do not interrupt and screen-reader gate drops frames',()=>{
 const {c,events}=harness();c.state='speaking';c.rec={auto:false,frames:[],elapsed:0,voiced:0,silence:0,speechFrames:0,speechStarted:false};
 for(let i=0;i<8;i++)c.onFrame(new Float32Array(320).fill(.03));assert.equal(c.state,'speaking');
 c.muteUntil=11000;const n=c.rec.frames.length;c.onFrame(new Float32Array(320).fill(.1));assert.equal(c.rec.frames.length,n);assert.deepEqual(events,[]);
});
test('pause cancels the turn, closes microphone, and resume reopens it',async()=>{
 const {c,events}=harness();await c.togglePause();assert.equal(c.paused,true);assert.equal(c.state,'paused');assert.equal(c.stream,null);assert.equal(c.session,2);assert.deepEqual(events.slice(0,2),['stop','close']);
 await c.togglePause();assert.equal(c.paused,false);assert.equal(c.state,'listening');assert.ok(events.includes('open'));
});
test('pause while microphone acquisition is pending cannot create a stale recording',async()=>{
 const {c}=harness();let release;c.stream=null;c.ensureMic=()=>new Promise(r=>{release=r;});const pending=c.startRecording(false);await c.togglePause();release();await pending;assert.equal(c.rec,null);assert.equal(c.state,'paused');
});
test('missing microphone fails instead of endlessly reopening',async()=>{
 const {c,events}=harness();c.stream=null;c.ensureMic=async()=>{};await c.startRecording(false);assert.ok(events.includes('errMic'));assert.equal(c.rec,null);
});
test('page voice uses pitch-preserving playback and releases audio on cancellation',async()=>{
 const {c,load}=harness();let audio,revoked=false,callback;
 c.URL={createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{revoked=true;}};
 c.Audio=function(){audio=this;this.play=()=>Promise.resolve();this.pause=()=>{};this.load=()=>{};this.removeAttribute=()=>{};};
 c.setInterval=fn=>{callback=fn;return 1};c.clearInterval=()=>{};c.setTimeout=()=>2;c.clearTimeout=()=>{};c.speed=1.3;
 load('  function playBuffer(', '  // Returns the chunks');let stopped=false;const p=c.playBuffer({},()=>stopped);assert.equal(audio.playbackRate,1.3);assert.equal(audio.preservesPitch,true);stopped=true;callback();await p;assert.ok(revoked);
});
test('new controls remain local and all locales have nonempty hands-free labels',()=>{
 const {c,load}=harness();load('  var LANG_WORDS', '  async function runCommand');for(const [text,cmd]of [['talk faster','faster'],['parle plus lentement','slower'],['pause','pause'],['安装应用','install'],['マイクの一覧','mics']])assert.equal(c.voiceCommand(text),cmd);
 for(const l of I.ALL_LANGS)for(const k of ['pause','resume','paused','instructionsLink','installLabel'])assert.ok(I.t(l,k),l+'/'+k);
});
