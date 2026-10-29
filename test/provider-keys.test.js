const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ProviderKeys, retryDelay } = require('../provider-keys.js');
const env = { one: 'fixture-secret-a', two: 'fixture-secret-b', three: 'fixture-secret-c' };
const reply = (status, data = {}, retry = null) => ({ response: {status, ok: status >= 200 && status < 300,
  headers: { get: () => retry } }, data });
test('empty and duplicated credentials cannot multiply routing capacity or expose keys', async () => {
  const p = new ProviderKeys(['one','missing','duplicate','two'], {env:{...env,duplicate:env.one}});
  assert.equal(p.size,2);assert.deepEqual(p.aliases(),['one','two']);
  assert.doesNotMatch(JSON.stringify(p),/fixture-secret/);
  assert.doesNotMatch(JSON.stringify(p.snapshot()),/fixture-secret/);
});
test('normal traffic stays on the first usable key, and records only measured tokens', async () => {
  const p = new ProviderKeys(['one','two','three'],{env});const used=[];
  for(let i=0;i<2;i++) await p.run('chat:model', async (key,alias)=>{
    used.push(alias);return reply(200,{usage:{prompt_tokens:10,completion_tokens:2}});
  });
  assert.deepEqual(used,['one','one']);
  assert.equal(p.snapshot()[0].observed_since_process_start['chat:model'].measured_tokens,24);
});
test('definite 429 selects second then third key, respects cooldown, and separates model scopes', async () => {
  let now=100000;const p=new ProviderKeys(['one','two','three'],{env,now:()=>now});const used=[];
  const result=await p.run('chat:model', async(key,alias)=>{used.push(alias);return alias==='three'?reply(200):reply(429,{},'120');});
  assert.equal(result.account,'three');assert.deepEqual(used,['one','two','three']);
  await p.run('chat:model',async(key,alias)=>{assert.equal(alias,'three');return reply(200);});
  await p.run('audio:whisper',async(key,alias)=>{assert.equal(alias,'one');return reply(200);});
  now+=120001;await p.run('chat:model',async(key,alias)=>{assert.equal(alias,'one');return reply(200);});
});
test('all rejected keys return the last response then suppress dispatch until retry is due', async () => {
  const p=new ProviderKeys(['one','two'],{env});let calls=0;
  assert.equal((await p.run('x',async()=>{calls++;return reply(429);})).response.status,429);
  await assert.rejects(p.run('x',async()=>{calls++;return reply(200);}),e=>e.status===429&&e.retryAfter>0);
  assert.equal(calls,2);
});
test('network failure and uncertain POST are never replayed', async () => {
  const p=new ProviderKeys(['one','two'],{env});let calls=0;
  await assert.rejects(p.run('x',async()=>{calls++;throw Error('connection lost');}),/connection lost/);
  assert.equal(calls,1);
});
for(const status of [400,401,403,404,432,500,503]) test(`HTTP ${status} does not silently switch accounts`,async()=>{
  const p=new ProviderKeys(['one','two'],{env});let calls=0;
  assert.equal((await p.run('x',async()=>{calls++;return reply(status);})).response.status,status);assert.equal(calls,1);
});
test('billing/account access blocks never trigger alternate-account requests',async()=>{
  const p=new ProviderKeys(['one','two'],{env});let calls=0;
  await p.run('x',async()=>{calls++;return reply(429,{error:{code:'blocked_api_access'}});});assert.equal(calls,1);
});
test('QA primary-only mode cannot spend another account allowance after 429',async()=>{
  const p=new ProviderKeys(['one','two'],{env});let calls=0;
  await p.run('x',async(key,alias)=>{calls++;assert.equal(alias,'one');return reply(429);},{primaryOnly:true});
  assert.equal(calls,1);
});
test('missing primary credential cannot silently turn a secondary into the QA account',async()=>{
  const p=new ProviderKeys(['one','two'],{env:{two:env.two}});let calls=0;
  await assert.rejects(p.run('x',async()=>{calls++;return reply(200);},{primaryOnly:true}),/credential is missing/);
  assert.equal(calls,0);
});
test('cancelled work cannot dispatch or fail over',async()=>{
  const p=new ProviderKeys(['one','two'],{env});const controller=new AbortController();let calls=0;
  await assert.rejects(p.run('x',async()=>{calls++;controller.abort();return reply(429);},{signal:controller.signal}));
  assert.equal(calls,1);
});
test('Retry-After handles seconds, dates and malformed headers without a hot loop',()=>{
  assert.equal(retryDelay('120',0),120000);assert.equal(retryDelay('Thu, 29 Oct 2026 13:00:00 GMT',Date.parse('2026-10-29T12:00:00Z')),3600000);
  assert.equal(retryDelay(null,0),60000);assert.equal(retryDelay('nonsense',0),60000);assert.equal(retryDelay('0',0),1000);
});
test('every privacy locale avoids claiming zero retention across unverified additional accounts',()=>{
  const fs=require('node:fs');const s=fs.readFileSync(require.resolve('../privacy-notice.js'),'utf8');
  for(const prior of ['Inference zero data retention is enabled for this project','Per questo progetto è attiva la conservazione zero','La rétention zéro des contenus d’inférence est activée','За проекта е включено нулево съхранение','Для проекта включено нулевое хранение','本项目已启用推理内容零保留','このプロジェクトでは推論内容のゼロデータ保持を有効にしています'])assert.ok(!s.includes(prior),prior);
});
