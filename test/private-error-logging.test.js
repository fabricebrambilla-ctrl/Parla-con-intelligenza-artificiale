const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', r));
const close = s => new Promise(r => s.close(r));

test('upstream errors do not leak echoed content into application logs or responses', async () => {
  const marker = 'FIXTURE_PRIVATE_CONTENT_NEVER_LOG';
  const provider = http.createServer(async (req, res) => {
    for await (const chunk of req) {} // Consume the fixture request only.
    res.writeHead(500, {'content-type':'application/json'});
    res.end(JSON.stringify({error:{message:marker + ': fixture credential and question'}}));
  });
  await listen(provider);
  const probe = http.createServer(); await listen(probe);
  const port = probe.address().port; await close(probe);
  const app = spawn(process.execPath, [path.join(__dirname, '../server.js')], {
    cwd: path.join(__dirname, '..'),
    env: {PATH:process.env.PATH, NODE_ENV:'test', PORT:String(port), GROQ_API_KEY:'fixture-only',
      GROQ_BASE_URL:`http://127.0.0.1:${provider.address().port}`, TAVILY_API_KEY:'',
      FISH_API_KEY:'', REDIS_URL:'', DATABASE_URL:''}, stdio:['ignore','pipe','pipe']
  });
  let log = ''; app.stdout.on('data', x => log += x); app.stderr.on('data', x => log += x);
  const base = `http://127.0.0.1:${port}`;
  const post = (url, body) => fetch(base+url, {method:'POST', headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try {
    let ready = false;
    for(let i=0;i<50;i++){
      try {if((await fetch(base+'/health')).ok){ready=true;break;}} catch {}
      await new Promise(r=>setTimeout(r,50));
    }
    assert.ok(ready, 'fixture server started');
    const voice = await post('/api/chat',{messages:[{role:'user',content:marker}]});
    assert.equal(voice.status,200);
    assert.deepEqual(JSON.parse((await voice.text()).trim()),{type:'error',error:'busy'});
    const agent = await post('/api/agent/chats',{message:marker});
    assert.equal(agent.status,503); assert.doesNotMatch(await agent.text(),new RegExp(marker));
    await new Promise(r=>setTimeout(r,30));
    assert.match(log,/chat: request failed \(HTTP 500\)/);
    assert.match(log,/agent chat: request failed \(HTTP 500\)/);
    assert.doesNotMatch(log,new RegExp(marker));
    assert.doesNotMatch(log,/fixture credential and question/);
  } finally {
    app.kill(); await new Promise(r=>app.once('exit',r)); await close(provider);
  }
});
