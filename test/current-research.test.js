const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const I18N = require('../public/i18n.js');
const source=fs.readFileSync(require.resolve('../server.js'),'utf8');
const code=source.slice(source.indexOf('function systemPrompt('),source.indexOf('// The answer is streamed as lines of JSON'));
const searchCall={id:'search',function:{name:'web_search',arguments:JSON.stringify({query:'weather Bassano Italy'})}};
function fixture({tool=true,error=false,result={results:[{title:'Forecast',content:'Forecast for fixture date.'}]},onSearch=()=>{}}={}) {
  const calls=[],searches=[];
  const c={I18N,CHAT_MODEL:'mock',TOOLS:[],qa:{lastModelCall:()=>false},
    groqAnswer:async body=>{calls.push(structuredClone(body));if(error)throw Object.assign(Error('bad tools'),{status:400});
      return {choices:[{message:calls.length===1&&tool?{tool_calls:[searchCall]}:{content:'Fixture answer.'}}]};},
    webSearch:async(...args)=>{searches.push(args);onSearch();return result;}};
  vm.runInNewContext(code,c);return {c,calls,searches,run:(text,extra={})=>c.runChat({lang:'en',messages:[{role:'user',content:text}],...extra})};
}
for(const [lang,text] of Object.entries({en:'Weather in Bassano?',it:'Meteo a Bassano?',fr:'Météo à Bassano ?',bg:'Каква е прогнозата за времето в София?',ru:'Какая погода в Москве?',zh:'北京天气怎么样？'})) {
  test(`${lang}: recognized weather requires live results before answering`,async()=>{
    const f=fixture();const answer=await f.run(text,{lang});assert.equal(answer.text,'Fixture answer.');
    assert.equal(f.calls[0].tool_choice.function.name,'web_search');assert.equal(f.searches.length,1);
    assert.equal(f.searches[0][1].requireResults,true);
    assert.equal(f.searches[0][1].timeRange,undefined,'evergreen weather pages must remain eligible');
  });
}
test('current sports search carries current date and recency filter',async()=>{
  const f=fixture();await f.run('What are the latest football scores?');
  assert.match(f.searches[0][0],/as of \d{4}-\d{2}-\d{2}/);assert.equal(f.searches[0][1].timeRange,'week');
});
for(const text of ['Mi dai informazioni sportive?','Che tempo fa a Thiene?','Novità nella ricerca per la cecità?']) {
  test(`ordinary Italian research wording cannot return an unsearched answer: ${text}`,async()=>{
    const searching=fixture();await searching.run(text,{lang:'it'});
    assert.equal(searching.calls[0].tool_choice.function.name,'web_search');
    assert.equal(searching.searches[0][1].requireResults,true);
    const ignoring=fixture({tool:false});
    assert.equal((await ignoring.run(text,{lang:'it'})).text,I18N.t('it','liveInfoUnavailable'));
  });
}
test('colloquial weather without a location asks instead of guessing',async()=>{
  const f=fixture();assert.equal((await f.run('Che tempo fa qui?',{lang:'it'})).text,I18N.t('it','askWeatherPlace'));
  assert.equal(f.calls.length,0);
});
for(const [lang,text] of Object.entries({en:'What research could help blind people?',it:'Nuove invenzioni per persone non vedenti?',fr:'Quelles recherches pourraient aider les personnes aveugles ?',bg:'Нови изследвания за незрящи хора?',ru:'Новые исследования для незрячих людей?',zh:'帮助盲人的新研究有哪些？',ja:'視覚障害者のための新しい研究は？'})) {
  test(`${lang}: research requires actual sources without a one-day publication cutoff`,async()=>{
    const f=fixture();await f.run(text,{lang});
    assert.equal(f.calls[0].tool_choice.function.name,'web_search');
    assert.equal(f.searches[0][1].requireResults,true);
    assert.equal(f.searches[0][1].timeRange,undefined);
  });
}
test('model ignoring the forced search cannot return an unverified current answer',async()=>{
  const f=fixture({tool:false});assert.equal((await f.run('Weather in Bassano?')).text,I18N.t('en','liveInfoUnavailable'));
  assert.equal(f.calls.length,1);
});
test('malformed forced tool call cannot fall back to a stale plain completion',async()=>{
  const f=fixture({error:true});assert.equal((await f.run('Latest sports scores?')).text,I18N.t('en','liveInfoUnavailable'));
  assert.equal(f.calls.length,1);
});
for(const result of [null,{error:'unavailable'},{results:[]},{report:'Unsupported claimed live answer'}]) {
  test(`unusable research ${JSON.stringify(result)} is disclosed`,async()=>{
    const f=fixture({result});assert.equal((await f.run('Weather in Bassano?')).text,I18N.t('en','liveInfoUnavailable'));assert.equal(f.calls.length,1);
  });
}
test('vague weather location asks for place and country without spending provider quota',async()=>{
  const f=fixture();const r=await f.run('Il meteo del mio paese?',{lang:'it'});
  assert.equal(r.text,I18N.t('it','askWeatherPlace'));assert.equal(f.calls.length,0);
});
test('weather follow-up preserves a previously supplied town',async()=>{
  const f=fixture();await f.run('',{messages:[{role:'user',content:'I live in Bassano, Italy.'},{role:'assistant',content:'Understood.'},{role:'user',content:'Weather in my town?'}]});
  assert.equal(f.calls.length,2);assert.equal(f.calls[0].messages[1].content,'I live in Bassano, Italy.');
});
test('short contextual follow-up still requires research',async()=>{
  const f=fixture();await f.run('',{messages:[{role:'user',content:'Latest sports scores?'},{role:'assistant',content:'Fixture.'},{role:'user',content:'And Milan?'}]});
  assert.equal(f.calls[0].tool_choice.function.name,'web_search');
});
test('historical requests and stable explanations do not get a current-date search restriction',async()=>{
  for(const text of ['Who won the 1998 World Cup?','Weather last month in Rome?','Explain how weather forecasts work in 1980.','How does photosynthesis work?']) {
    const f=fixture({tool:false});await f.run(text);assert.equal(f.calls[0].tool_choice,'auto',text);
  }
});
test('a stopped request cannot answer after research finishes',async()=>{
  const controller=new AbortController();const f=fixture({onSearch:()=>controller.abort(Error('stopped'))});
  await assert.rejects(f.run('Weather in Bassano?',{stop:controller.signal}),/stopped/);assert.equal(f.calls.length,1);
});
test('QA with no model allowance refuses unverifiable current answers',async()=>{
  const f=fixture();f.c.qa.lastModelCall=()=>true;
  assert.equal((await f.run('Weather in Bassano?')).text,I18N.t('en','liveInfoUnavailable'));assert.equal(f.calls.length,0);
});
test('ordinary conversation remains a single model call',async()=>{
  const f=fixture({tool:false});assert.equal((await f.run('Hello, how are you?')).text,'Fixture answer.');assert.equal(f.calls.length,1);
});
test('Vicenza exact singular result wording and transcription typo must still search',async()=>{
 const f=fixture({tool:false});
 const answer=await f.run("Dimmi l'utlimo risultato dell'AC Milan in campionato serie A",{lang:'it'});
 assert.equal(f.calls[0].tool_choice.function.name,'web_search');
 assert.equal(answer.text,I18N.t('it','liveInfoUnavailable'));
});
test('weather search retains Sandrigo even when the model proposes a different city',async()=>{
 const f=fixture();await f.run('Dimmi il meteo di oggi a Sandrigo provincia di Vicenza',{lang:'it'});
 assert.match(f.searches[0][0],/Sandrigo/i);
});
test('a third follow-up retains its research topic and the complete dialogue',async()=>{
 const f=fixture();const messages=[{role:'user',content:'New research for blind people?'},{role:'assistant',content:'A fixture study.'},{role:'user',content:'Tell me more.'},{role:'assistant',content:'Study details.'},{role:'user',content:'And its limitations?'}];
 await f.run('',{messages});assert.equal(f.calls[0].tool_choice.function.name,'web_search');
 assert.deepEqual(f.calls[0].messages.slice(1),messages);
});
test('voice and automatic-download requests never pretend to execute unsupported controls',async()=>{
 for(const text of ['Cambia la voce da femminile a maschile','Scarica automaticamente quel file']) {
  const f=fixture({tool:false});const reply=await f.run(text,{lang:'it'});
  assert.equal(f.calls.length,0);
  assert.match(reply.text,/non posso/i);
 }
});
test('every language has microphone guidance, current-data fallback and location clarification',()=>{
  for(const lang of I18N.LANGS)for(const key of ['micGuide','micGuideTouch','liveInfoUnavailable','askWeatherPlace'])assert.ok(I18N.S[lang][key],`${lang}/${key}`);
});
test('organization pages retain contacts without regional listings or logos',()=>{
  const about=require('../about.js');for(const lang of I18N.LANGS){
    const html=about.renderOrganizations(lang);assert.doesNotMatch(html,/Teramo|uicite\.it|pilot-list-section|<img/);
    assert.match(html,/mailto:brambillafabrice@gmail.com/);assert.equal((html.match(/<h1>/g)||[]).length,1);
  }
});
test('Tavily keeps basic search and applies recency only when requested',async()=>{
  const bodies=[];const c={tavilyKeys:new (require('../provider-keys.js').ProviderKeys)(['TAVILY_API_KEY'],{env:{TAVILY_API_KEY:'fixture'}}),qa:{current:()=>null,searchAvailable:()=>true,search(){}},takeTavilySearch:async()=>true,
    TAVILY_URL:'https://fixture.invalid',AbortSignal,URL,logFailure(){},fetch:async(url,opts)=>{bodies.push(JSON.parse(opts.body));return {ok:true,json:async()=>({results:[]})};}};
  vm.runInNewContext(source.slice(source.indexOf('async function tavilySearch('),source.indexOf('async function compoundSearch(')),c);
  await c.tavilySearch('fixture',{timeRange:'week'});await c.tavilySearch('fixture');
  assert.equal(bodies[0].time_range,'week');assert.equal(bodies[0].search_depth,'basic');assert.equal(bodies[1].time_range,undefined);
});
