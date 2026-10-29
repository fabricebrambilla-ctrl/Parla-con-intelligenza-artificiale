const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const listen = s => new Promise(r=>s.listen(0,'127.0.0.1',r));
test('real HTTP routes use three Groq and two Tavily credentials while QA remains primary-only', {timeout:20000}, async()=>{
  const seen=[];
  const provider=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const raw=Buffer.concat(chunks).toString();const alias=req.headers.authorization;
    const body=req.headers['content-type']?.includes('application/json')?JSON.parse(raw):null;
    seen.push({path:req.url,alias,body,raw});
    const reject=(req.url==='/chat/completions'&&!alias.endsWith('fixture-c'))||
      (req.url==='/audio/transcriptions'&&!alias.endsWith('fixture-c'))||
      (req.url==='/search'&&alias.endsWith('fixture-t1'));
    res.writeHead(reject?(req.url==='/search'?432:429):200,{'content-type':'application/json','retry-after':'60'});
    if(reject)return res.end(JSON.stringify(req.url==='/search'?{detail:{error:"This request exceeds your plan's set usage limit."}}:{error:{code:'rate_limit_exceeded'}}));
    if(req.url==='/audio/transcriptions')return res.end(JSON.stringify({text:'Fixture question.'}));
    if(req.url==='/search')return res.end(JSON.stringify({results:[{title:'Fixture source',url:'https://example.org',content:'Current fixture evidence.'}]}));
    if(req.url==='/chat/completions'){
      const mustSearch=body.tool_choice?.function?.name==='web_search';
      const message=mustSearch?{tool_calls:[{id:'s',type:'function',function:{name:'web_search',arguments:JSON.stringify({query:'fixture research'})}}]}:{content:'Fixture answer.'};
      return res.end(JSON.stringify({choices:[{message}],usage:{prompt_tokens:100,completion_tokens:10,total_tokens:110}}));
    }
    res.end('{}');
  });
  await listen(provider);const probe=http.createServer();await listen(probe);const port=probe.address().port;await new Promise(r=>probe.close(r));
  const origin=`http://127.0.0.1:${provider.address().port}`;
  const app=spawn(process.execPath,[path.join(__dirname,'../server.js')],{cwd:path.join(__dirname,'..'),env:{PATH:process.env.PATH,NODE_ENV:'test',PORT:String(port),GROQ_BASE_URL:origin,TAVILY_BASE_URL:origin+'/search',GROQ_API_KEY:'fixture-a',GROQ_API_KEY_2:'fixture-b',GROQ_API_KEY_3:'fixture-c',TAVILY_API_KEY:'fixture-t1',TAVILY_API_KEY_3:'fixture-t2'},stdio:['ignore','pipe','pipe']});
  let logs='';app.stdout.on('data',x=>logs+=x);app.stderr.on('data',x=>logs+=x);
  const base=`http://127.0.0.1:${port}`;
  try{
    let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,20));}assert.ok(ready,logs);
    const capability=await (await fetch(base+'/api/qa')).json();assert.equal(capability.provider_routing.groq_keys,3);assert.equal(capability.provider_routing.tavily_keys,2);
    const chat=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lang:'en',messages:[{role:'user',content:'What is the latest research on reading tools?'}]})});
    assert.match(await chat.text(),/Fixture answer/);
    assert.deepEqual(seen.filter(x=>x.path==='/chat/completions').slice(0,3).map(x=>x.alias),['Bearer fixture-a','Bearer fixture-b','Bearer fixture-c']);
    assert.deepEqual(seen.filter(x=>x.path==='/search').map(x=>x.alias),['Bearer fixture-t1','Bearer fixture-t2']);
    const wav=Buffer.alloc(44+32000*5);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
    const stt=await fetch(base+'/api/transcribe?lang=en',{method:'POST',headers:{'content-type':'audio/wav'},body:wav});assert.equal((await stt.json()).text,'Fixture question.');
    assert.deepEqual(seen.filter(x=>x.path==='/audio/transcriptions').map(x=>x.alias),['Bearer fixture-a','Bearer fixture-b','Bearer fixture-c']);
    const before=seen.length;const envelope={primary_requests:4,primary_tokens:30000,fallback_requests:0,fallback_tokens:0,speech_requests:1,audio_seconds:25,searches:1};
    const qa=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json','x-synthetic-test':'true','x-qa-budget':JSON.stringify(envelope)},body:JSON.stringify({messages:[{role:'user',content:'Hello.'}]})});
    assert.match(await qa.text(),/error/);assert.equal(seen.length,before,'primary is cooling down; QA must not use a healthy alternate');
    assert.doesNotMatch(logs,/fixture-[abct]/);
  }finally{
    if(app.exitCode===null){const exit=new Promise(r=>app.once('exit',r));app.kill();await exit;}
    provider.closeAllConnections();await new Promise(r=>provider.close(r));
  }
});
