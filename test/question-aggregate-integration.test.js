// Real local HTTP ingress, stand-in providers and memory-only counters.
// No real provider credentials, network calls or quota are used.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs"), vm = require("node:vm");
let fake, child, base, providerCalls=0;
const listen = server => new Promise(resolve => server.listen(0,"127.0.0.1",()=>resolve(server.address().port)));
const auth={Authorization:'Basic '+Buffer.from('owner:aggregate-fixture').toString('base64')};
const post=(route,body,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const question=(message,headers={},history=[])=>post('/api/chat',{lang:'en',messages:[...history,{role:'user',content:message}]},headers);
async function totals() {
  const html=await(await fetch(base+'/stats',{headers:auth})).text();
  return {
    visits:Number(html.match(/Today.*?<strong>(\d+)<\/strong> page visits/)[1]),
    questions:Number(html.match(/Today.*?<strong>\d+<\/strong> page visits; <strong>(\d+)<\/strong> questions submitted/)[1]),
  };
}
before(async()=>{
  fake=http.createServer((req,res)=>{
    let raw='';req.on('data',x=>raw+=x);req.on('end',()=>{
      const body=JSON.parse(raw||'{}');res.setHeader('Content-Type','application/json');
      if(req.url==='/tavily')return res.end(JSON.stringify({results:[{title:'Source',url:'https://example.org',content:'fixture'}]}));
      providerCalls++;
      const last=[...(body.messages||[])].reverse().find(m=>m.role==='user')?.content;
      if(last==='provider fails'){res.statusCode=503;return res.end(JSON.stringify({error:{message:'fixture only'}}));}
      if(last==='retry then search' && body.model==='openai/gpt-oss-120b'){
        res.statusCode=429;return res.end(JSON.stringify({error:{message:'tokens per minute limit'}}));
      }
      const answer=message=>res.end(JSON.stringify({choices:[{message}],usage:{prompt_tokens:120,completion_tokens:30}}));
      if(last==='retry then search'&&!body.messages.some(m=>m.role==='tool'))return answer({role:'assistant',content:'',tool_calls:[{id:'s1',type:'function',function:{name:'web_search',arguments:'{"query":"fixture"}'}}]});
      answer({role:'assistant',content:'A fixture reply.'});
    });
  });
  const upstream=await listen(fake);
  const probe=http.createServer();const port=await listen(probe);await new Promise(resolve=>probe.close(resolve));
  base='http://127.0.0.1:'+port;
  let log='';
  child=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{env:{
    PATH:process.env.PATH,NODE_ENV:'test',PORT:String(port),STATS_PASSWORD:'aggregate-fixture',
    GROQ_API_KEY:'fixture',GROQ_BASE_URL:'http://127.0.0.1:'+upstream,
    TAVILY_API_KEY:'fixture',TAVILY_BASE_URL:'http://127.0.0.1:'+upstream+'/tavily',
  },stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
  child.on('error',error=>{log+=error.message;});
  for(let i=0;i<200;i++){
    try{if((await fetch(base+'/health')).ok)return;}catch{}
    if(child.exitCode!==null)throw Error('local app exited: '+log);
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('local app did not start: '+log);
});
after(async()=>{
  if(child&&child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}
  if(fake)await new Promise(resolve=>fake.close(resolve));
});
test('one valid voice request counts once, regardless of retained history',async()=>{
  let before=await totals();
  await(await question('first question')).text();
  assert.equal((await totals()).questions,before.questions+1);
  before=await totals();
  await(await question('new question',{},[{role:'user',content:'old one'},{role:'assistant',content:'old answer'},{role:'user',content:'old two'},{role:'assistant',content:'another answer'}])).text();
  assert.equal((await totals()).questions,before.questions+1);
  assert.equal((await totals()).visits,0);
});
test('model fallback and web-tool rounds add no extra question submissions',async()=>{
  const before=await totals(),calls=providerCalls;
  const rows=(await(await question('retry then search')).text()).trim().split('\n').map(x=>JSON.parse(x));
  assert.equal(rows[0].type,'searching');assert.equal(rows.at(-1).type,'reply');
  assert.ok(providerCalls-calls>=3,'fixture must actually exercise fallback/tool rounds');
  assert.equal((await totals()).questions,before.questions+1);
});
test('invalid requests and payloads without a latest user question do not count',async()=>{
  const before=await totals();
  for(const body of [{messages:[]},{messages:[{role:'assistant',content:'only assistant'}]},
    {messages:[{role:'user',content:'   '}]},{messages:[{role:'user',content:'valid'}],context:[]}] ){
    const r=await post('/api/chat',body);assert.equal(r.status,400);await r.text();
  }
  // Historical user text followed only by an assistant message is not a new question.
  await(await post('/api/chat',{messages:[{role:'user',content:'old'},{role:'assistant',content:'already answered'}]})).text();
  assert.equal((await totals()).questions,before.questions);
});
test('synthetic flag alone, QA envelope and invalid QA requests never count',async()=>{
  const before=await totals();
  await(await question('test without budget',{'X-Synthetic-Test':'true'})).text();
  await(await question('test uppercase',{'X-Synthetic-Test':'TRUE'})).text();
  const budget={primary_requests:5,primary_tokens:100000,fallback_requests:5,fallback_tokens:100000,speech_requests:10,audio_seconds:100,searches:5};
  await(await question('budgeted QA',{'X-Synthetic-Test':'true','X-QA-Budget':JSON.stringify(budget)})).text();
  assert.equal((await question('invalid QA',{'X-QA-Budget':'{}'})).status,400);
  await(await question('empty envelope',{'X-QA-Budget':''})).text();
  assert.equal((await totals()).questions,before.questions);
});
test('a failed answer still counts one submitted question and the text API remains excluded',async()=>{
  const before=await totals();
  const rows=(await(await question('provider fails')).text()).trim().split('\n').map(x=>JSON.parse(x));
  assert.equal(rows.at(-1).type,'error');assert.equal((await totals()).questions,before.questions+1);
  const created=await post('/api/agent/chats',{message:'text API question',lang:'en'});
  assert.equal(created.status,201);const chat=await created.json();
  await(await post('/api/agent/chats/'+chat.chat_id+'/messages',{message:'text follow-up'})).text();
  assert.equal((await totals()).questions,before.questions+1);
});
test('a counter failure cannot prevent a validated voice question from being answered',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  const start=source.indexOf('app.post("/api/chat"');
  const end=source.indexOf('// Hidden text API',start);
  let handler,attempts=0;const output=[],logs=[];
  const context=vm.createContext({
    app:{post(route,...handlers){handler=handlers.at(-1);}},express:{json(){return ()=>{};}},limit(){return ()=>{};},
    cleanMessages:messages=>messages,qa:{current:()=>null,decorate:x=>x},
    stats:{recordQuestionSubmission(){attempts++;throw Error('counter fixture failure');}},
    console:{error:value=>logs.push(value)},pickLang:()=> 'en',
    runChat:async()=>({text:'Still answered.',end:false}),I18N:{detectLang:()=> 'en'},
    logFailure(){throw Error('voice should not fail');},errorCode:()=>({error:'busy'}),
  });
  vm.runInContext(source.slice(start,end),context);
  const res={set(){},write:text=>output.push(JSON.parse(text)),end(){},status(){return this;},json(){throw Error('unexpected rejection');}};
  await handler({body:{lang:'en',messages:[{role:'user',content:'a valid question'}]},get:()=>undefined},res);
  assert.equal(attempts,1);assert.equal(output.at(-1).type,'reply');assert.equal(output.at(-1).text,'Still answered.');
  assert.deepEqual(logs,['stats: question counter unavailable']);
});
