const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const I=require('../public/i18n.js'),legal=require('../legal.js'),about=require('../about.js');
const app=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
function controls(){
 const c={lang:'ja'};
 vm.runInNewContext(app.slice(app.indexOf('  var GOODBYE'),app.indexOf('  // ---------- conversation controls')),c);
 vm.runInNewContext(app.slice(app.indexOf('  var LANG_WORDS'),app.indexOf('  async function runCommand')),c);
 return c;
}
test('Japanese selection and all public-page translations are complete',()=>{
 assert.equal(I.pick(['ja-JP','en-US']),'ja');assert.equal(I.META.ja.speech,'ja-JP');
 for(const key of Object.keys(I.S.en))assert.ok(I.S.ja[key],key);
 for(const page of [legal.PRIVACY,legal.ACCESSIBILITY]){
  assert.ok(page.ja.title);assert.equal(page.ja.sections.length,page.en.sections.length);
 }
 for(const key of Object.keys(about.PAGES.en))assert.ok(about.PAGES.ja[key],key);
 assert.match(about.render('ja'),/<html lang="ja">/);assert.match(about.renderOrganizations('ja'),/試用と協力/);
 assert.doesNotMatch(about.renderOrganizations('ja'),/Teramo|uicite/);
});
test('kana answers use Japanese speech and Han-only Japanese keeps its context',()=>{
 assert.equal(I.detectLang('こんにちは。今日は何を調べますか。','en'),'ja');
 assert.equal(I.detectLang('東京','ja'),'ja');assert.equal(I.detectLang('今日は晴れです。','zh'),'ja');
 assert.equal(I.detectLang('今天北京的天气很好。','en'),'zh');
 assert.equal(I.detectLang('the answer is on the official website and you can read it there','ja'),'en');
});
test('spoken language selection and switching work without Latin word boundaries',()=>{
 const c=controls();
 for(const text of ['日本語','Japanese','giapponese','japonais','日语'])assert.equal(c.matchLanguage(text),'ja',text);
 assert.equal(c.matchLanguage('はい','japanese'),'ja');
 for(const [phrase,code] of [['日本語に切り替えて','ja'],['英語で話してください','en'],['フランス語にして','fr'],['speak Japanese','ja'],['说日语','ja']])assert.equal(c.voiceCommand(phrase),code,phrase);
 assert.equal(c.voiceCommand('言語を変更してください'),'ask');
 assert.equal(c.voiceCommand('日本語の歴史について教えてください'),null);
 assert.equal(c.voiceCommand('英語で話す人は何人いますか'),null);
});
test('Japanese repeat, help and goodbye avoid consuming ordinary questions',()=>{
 const c=controls();
 assert.equal(c.voiceCommand('もう一度お願いします。'),'repeat');assert.equal(c.voiceCommand('ヘルプ'),'help');
 assert.equal(c.voiceCommand('使い方を教えてください'),'help');
 for(const t of ['さようなら。','会話を終了してください','ストップ'])assert.equal(c.isGoodbye(t),true,t);
 for(const t of ['会話を終了するボタンはどこですか','さようならという言葉の意味は何ですか'])assert.equal(c.isGoodbye(t),false,t);
});
test('Japanese voice ranking never picks a voice from another language',()=>{
 const c={I,voices:[{lang:'en-US',name:'Very natural English'},{lang:'ja-JP',name:'Microsoft Nanami Online (Natural)'}]};
 vm.runInNewContext(app.slice(app.indexOf('  var NICE_VOICES'),app.indexOf('  function splitSentences')),c);
 assert.equal(c.pickVoice('ja').lang,'ja-JP');
});
test('Japanese current questions require research and vague places ask for location',()=>{
 const s=fs.readFileSync(require.resolve('../server.js'),'utf8');const c={};
 vm.runInNewContext(s.slice(s.indexOf('function liveResearchPlan('),s.indexOf('// One assistant turn, shared')),c);
 for(const question of ['東京の天気は？','今日の試合結果は？','最新のニュースを教えて'])assert.equal(c.liveResearchPlan([{role:'user',content:question}]).required,true,question);
 assert.equal(c.liveResearchPlan([{role:'user',content:'私の町の天気は？'}]).vaguePlace,true);
 assert.equal(c.liveResearchPlan([{role:'user',content:'昨年の試合結果は？'}]).required,false);
});
