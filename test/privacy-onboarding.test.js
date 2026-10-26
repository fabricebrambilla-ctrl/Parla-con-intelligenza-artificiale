const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I = require("../public/i18n.js"), privacy = require("../privacy-notice.js");
const app = fs.readFileSync(path.join(__dirname,"../public/app.js"),"utf8");
function start(saved={}, cancel=false) {
  const events=[], values={...saved};
  const c=vm.createContext({active:false,session:0,lang:"en",aiVoiceLangs:[],failures:0,pendingTalk:false,choosing:false,
    transcript:[],context:"",lastSaid:"",alertBox:{textContent:""},window:{AudioWorkletNode:function(){}},
    navigator:{mediaDevices:{getUserMedia(){}}},ensureContext(){},showConversationControls(){},setState(){},
    get:k=>values[k],set:(k,v)=>{values[k]=v;},tt:k=>I.t("en",k),tk:k=>I.t("en",k),
    api:async()=>({aiVoice:[]}),say:async text=>{events.push(["say",text]);if(cancel)c.session++;return false;},
    openMic:async()=>events.push(["microphone"]),chooseLanguage:async()=>events.push(["language recording"]),
    sounds:{start(){}},setTimeout:f=>f(),goReady:()=>events.push(["ready"]),
    closeMic(){},announce(){throw Error("unexpected failure");},fail(){throw Error("unexpected failure");}});
  vm.runInContext(app.slice(app.indexOf("  async function startConversation"),app.indexOf("  function endConversation")),c);
  return {c,events,values};
}
test("first AI and privacy disclosure precede microphone and language recording",async()=>{
  const f=start();await f.c.startConversation();
  const mic=f.events.findIndex(e=>e[0]==="microphone"),language=f.events.findIndex(e=>e[0]==="language recording");
  assert.ok(mic>0&&language>mic);assert.match(f.events[0][1],/AI assistant.*cloud services/);
  const spoken=f.events.filter(e=>e[0]==="say").map(e=>e[1]).join(" ");
  assert.equal(spoken.match(/AI assistant/g).length,1);
  assert.ok(f.values.privacyNoticeVersion);
});
test("return greeting keeps one AI disclosure without repeating the full privacy notice",async()=>{
  const f=start({introHeard:"1",privacyNoticeVersion:"2026-10-26",langChosen:"1"});await f.c.startConversation();
  const spoken=f.events.filter(e=>e[0]==="say").map(e=>e[1]).join(" ");
  assert.equal(spoken.match(/AI assistant/g).length,1);assert.doesNotMatch(spoken,/cloud services/);
});
test("ending during disclosure never opens the microphone",async()=>{
  const f=start({},true);await f.c.startConversation();
  assert.equal(f.events.filter(e=>e[0]==="microphone").length,0);assert.equal(f.values.privacyNoticeVersion,undefined);
});
test("ending clears conversation memory; finishing a recording preserves existing context",()=>{
  const c=vm.createContext({active:true,session:1,choosing:false,pendingTalk:false,stopThinking(){},stopSpeaking:null,
    closeMic(){},rec:{},recResolve:null,transcript:[{content:"private fixture"}],context:"private fixture",lastSaid:"private fixture",lastSaidLang:"en",
    setState(){},showConversationControls(){},sounds:{end(){}}});
  vm.runInContext(app.slice(app.indexOf("  function endConversation"),app.indexOf("  function fail(")),c);
  c.endConversation();assert.equal(c.transcript.length,0);assert.equal(c.context,"");assert.equal(c.lastSaid,"");
  c.rec=null;c.ctx=null;c.transcript=[{content:"keep history"}];
  vm.runInContext(app.slice(app.indexOf("  function finishRecording"),app.indexOf("  async function nothingHeard",app.indexOf("  function finishRecording"))),c);
  c.finishRecording();assert.equal(c.transcript.length,1);
});
test("all six notices name the Swiss operator and distinguish aggregate counts from API chat storage",()=>{
  for(const lang of I.LANGS){
    const text=JSON.stringify(privacy[lang]);assert.match(text,/Fabrice Brambilla/);assert.match(text,/brambillafabrice@gmail.com/);
    assert.match(text,/Europe\/Zurich/);assert.match(text,/24/);assert.ok(I.S[lang].aiDisclosure);
    assert.doesNotMatch(I.S[lang].greeting,/AI assistant/);
  }
  assert.doesNotMatch(app,/localStorage\.setItem\("anonId"|set\("anonId"/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"../public/index.html"),"utf8"),/src="\/stats.js"/);
});
