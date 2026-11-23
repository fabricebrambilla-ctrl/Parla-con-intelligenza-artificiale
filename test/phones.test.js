const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const app=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
const I=require('../public/i18n.js');
function harness(touch=true){
 const events=[],timers=[],values={};let now=0;
 const doc={body:{setAttribute(){}},documentElement:{},hasFocus:()=>true,activeElement:null};
 const el=()=>({hidden:false,textContent:'unchanged',setAttribute(){events.push('attribute');},removeAttribute(){events.push('attribute');},focus(){events.push('focus');doc.activeElement=this;},contains:()=>false});
 const talkBtn=el(),endBtn=el(),lastBox=el(),lastBtn=el(),lastText=el(),copyStatus=el();doc.activeElement=talkBtn;
 const c=vm.createContext({C:require("../public/app-capabilities"),device:{},paused:false,continuous:false,speed:1,spokenEcho:"",echoUntil:0,mics:[],IS_TOUCH:touch,IS_IOS:false,active:true,session:1,state:'ready',talkLabel:true,pendingTalk:false,stream:{},rec:null,
 document:doc,talkBtn,endBtn,lastBox,lastBtn,lastText,copyStatus,alertBox:el(),lastAnswer:'answer',navigator:{clipboard:{writeText:async()=>{}}},
 tt:k=>I.t('en',k),tk:k=>I.t('en',touch&&I.S.en[k+'Touch']?k+'Touch':k),set:(k,v)=>values[k]=v,
 performance:{now:()=>now},setTimeout:(fn,ms)=>{timers.push({fn,ms});},sounds:{turn:()=>events.push('tone')},buzz:()=>events.push('buzz'),
 ensureMic:async()=>{if(!c.stream)throw Error("microphone unavailable");},fail:()=>events.push('error'),micErrorKey:()=> 'errMic',stopSpeaking:null});
 const load=(a,b)=>vm.runInContext(app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a))),c);
 load('  function setState(', '  // ---------- mute gate');
 load('  var muteUntil', '  // Preserve native controls');
 load('  function announce(', '  // ---------- audio context');
 load('  function showConversationControls(', '  function buzz(');
 load('  function goReady(', '  var recResolve');
 load('  function rememberAnswer(', '  lastBtn.addEventListener(');
 return {c,events,timers,values,load,async tick(){const t=timers.shift();assert.ok(t);now+=t.ms;t.fn();await Promise.resolve();await Promise.resolve();}};
}
test('G1 touch starts recording and the speak-now cue only after 1500 ms',async()=>{
 const h=harness();const p=h.c.startRecording(false);
 assert.equal(h.c.rec,null);assert.deepEqual(h.events,[]);assert.equal(h.timers[0].ms,1500);
 await h.tick();await p;assert.ok(h.c.rec);assert.deepEqual(h.events,['tone','buzz']);
});
test('G1 desktop still records and cues immediately',async()=>{
 const h=harness(false);await h.c.startRecording(false);assert.ok(h.c.rec);assert.deepEqual(h.events,['tone','buzz']);assert.equal(h.timers.length,0);
});
test('G1 ending during touch delay cannot record or cue later',async()=>{
 const h=harness();const p=h.c.startRecording(false);h.c.active=false;h.c.session++;await h.tick();await p;
 assert.equal(h.c.rec,null);assert.deepEqual(h.events,[]);
});
test('G2 Copy status and last-answer attributes wait for speech to end',async()=>{
 const h=harness();h.c.state='speaking';const before=h.c.copyStatus.textContent;
 await h.c.copyLast();h.c.showLast();assert.equal(h.c.copyStatus.textContent,before);assert.deepEqual(h.events,[]);
 h.c.setState('ready');assert.ok(h.events.includes('attribute'));
});
test('G2 conversation labels wait for speech to end',()=>{
 const h=harness();h.c.state='speaking';h.c.showConversationControls(false);
 assert.equal(h.c.talkBtn.textContent,'unchanged');assert.deepEqual(h.events,[]);
 h.c.setState('idle');assert.equal(h.c.talkBtn.textContent,I.t('en','start'));
});
test('G2 non-error announcements wait; errors can interrupt',async()=>{
 const h=harness();h.c.state='speaking';h.c.announce('copied');assert.equal(h.timers.length,0);
 h.c.setState('ready');await h.tick();assert.equal(h.c.alertBox.textContent,I.t('en','copied'));
 h.c.state='speaking';h.c.announce('errMic');assert.equal(h.timers.length,1);
});
for(const path of ['normal answer','nothing heard','retry','language switch','show last answer','page command','pendingTalk']){
 test('G3 goReady restores lost page focus: '+path,()=>{
  const h=harness();h.c.state='speaking';h.c.document.activeElement=h.c.document.body;h.c.pendingTalk=path==='pendingTalk';
  h.c.goReady();assert.equal(h.c.document.activeElement,h.c.talkBtn);assert.equal(h.events.filter(x=>x==='focus').length,1);
 });
}
test('G3 does not refocus Talk or steal deliberately chosen focus',()=>{
 const h=harness();h.c.goReady();assert.equal(h.events.includes('focus'),false);
 for(const control of [h.c.endBtn,{id:'copyBtn'},{id:'lang'}]){h.c.document.activeElement=control;h.c.goReady();assert.equal(h.c.document.activeElement,control);}
 h.c.document.activeElement=h.c.document.body;h.c.document.hasFocus=()=>false;h.c.goReady();assert.equal(h.c.document.activeElement,h.c.document.body);
});
test('G4 headphones advice exists only in touch first-use/help in all nine languages',()=>{
 for(const lang of I.ALL_LANGS){const s=I.S[lang];assert.ok(s.phoneHeadphones,lang);assert.ok(s.greetingTouch.includes(s.phoneHeadphones),lang);assert.ok(s.voiceHelpTouch.includes(s.phoneHeadphones),lang);assert.ok(!s.greeting.includes(s.phoneHeadphones));assert.ok(!s.voiceHelp.includes(s.phoneHeadphones));}
 assert.match(app,/reply = tk\("voiceHelp"\)/);
});

test('G1 microphone removed during phone delay reports failure without a false cue',async()=>{
 const h=harness();const p=h.c.startRecording(false);h.c.stream=null;await h.tick();await p;
 assert.equal(h.c.rec,null);assert.deepEqual(h.events,['error']);
});
for(const path of ['normal','nothing heard','retry','language','show','page command','interruption']) {
 test('G3 actual completion path returns lost focus: '+path,async()=>{
  const h=harness(false),c=h.c;c.document.activeElement=c.document.body;
  Object.assign(c,{lang:'en',I,transcript:[],context:'',readingPage:null,failures:0,lastSaid:'',lastSaidLang:null,
    startThinking(){},stopThinking(){},isGoodbye:()=>false,voiceCommand:()=>null,renderTexts(){},
    say:async()=>{c.setState('speaking');c.setState('processing');},
    api:async()=>({text:path==='nothing heard'?'':'question'}),
    chat:async()=>{if(path==='retry')throw Error('local test');return {text:'answer',command:path==='page command'?'show_last_answer':undefined};},
    PAGE_COMMANDS:{show_last_answer:'show'}});
  h.load('  async function nothingHeard(', '  // ---------- language question');
  h.load('  async function runCommand(', '  function recordOnce(');
  h.load('  async function handleUtterance(', '  function announcePause(');
  if(path==='interruption')c.pendingTalk=true;
  if(path==='language')await c.runCommand('fr');
  else if(path==='show')await c.runCommand('show');
  else await c.handleUtterance(new Uint8Array());
  assert.equal(c.document.activeElement,c.talkBtn);assert.equal(h.events.filter(x=>x==='focus').length,1);
 });
}
test('G2 actual speech completion flushes queued Copy without changing voice rate',async()=>{
 const h=harness(),c=h.c;let finish;
 Object.assign(c,{lang:'en',window:{},IS_IOS:false,aiVoiceLangs:[],aiVoiceFailures:0,
 splitSentences:t=>[t],speakBrowser:()=>new Promise(resolve=>finish=resolve)});
 h.load('  async function say(', '  // ---------- microphone +');
 const speaking=c.say('test');await c.copyLast();assert.equal(c.copyStatus.textContent,'unchanged');
 finish();await speaking;assert.equal(c.copyStatus.textContent,I.t('en','copied'));assert.notEqual(c.state,'speaking');
});

test('G2 a status scheduled just before speech also waits for its end',async()=>{
 const h=harness();h.c.announce('copied');h.c.state='speaking';await h.tick();
 assert.equal(h.c.alertBox.textContent,'');h.c.setState('ready');await h.tick();assert.equal(h.c.alertBox.textContent,I.t('en','copied'));
});
test('G2 queued updates from an ended conversation are discarded',async()=>{
 const h=harness();h.c.state='speaking';await h.c.copyLast();h.c.session++;h.c.setState('idle');
 assert.equal(h.c.copyStatus.textContent,'unchanged');
});
test('G2 translated labels are not rendered during speech',()=>{
 const h=harness();let applied=0;const c=h.c;
 Object.assign(c,{I:{applyPage(){applied++;}},lang:'en',micBtn:{},copyBtn:{},langsBox:{querySelectorAll:()=>[]},micPermission:{textContent:''},$:()=>({})});
 h.load('  function renderTexts()', '  // ---------- state ----------');
 c.state='speaking';c.renderTexts();assert.equal(applied,0);c.setState('ready');assert.equal(applied,1);
});

test('G1 a microphone removed during language recording does not leave its caller waiting',async()=>{
 const h=harness();let result='waiting';h.c.recResolve=value=>result=value;
 const p=h.c.startRecording(true);h.c.stream=null;await h.tick();await p;
 assert.equal(result,null);assert.equal(h.c.recResolve,null);assert.deepEqual(h.events,[]);
});
