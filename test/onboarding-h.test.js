const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const app=fs.readFileSync(require.resolve('../public/app.js'),'utf8'),I=require('../public/i18n');
test('H repeat instructions is a local command in every supported language',()=>{
 const c=vm.createContext({I,lang:'en'});vm.runInContext(app.slice(app.indexOf('  var LANG_WORDS'),app.indexOf('  async function runCommand')),c);
 for(const words of ['repeat the instructions','ripeti le istruzioni','répète les instructions','повтори инструкциите','повтори инструкции','重复使用说明','使い方をもう一度教えて','herhaal de instructies','repete as instruções'])assert.equal(c.voiceCommand(words),'help',words);
});
test('H the opening no longer asks for a language recording',()=>{
 const start=app.slice(app.indexOf('  async function startConversation'),app.indexOf('  function endConversation'));
 assert.doesNotMatch(start,/await chooseLanguage/);
});
test('H help repeats the operating instructions as well as available commands',()=>{
 assert.match(app,/cmd === "help"\) reply = tk\("greeting"\) \+ " " \+ tk\("voiceHelp"\)/);
});
