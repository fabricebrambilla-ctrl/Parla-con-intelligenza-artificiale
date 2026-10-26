const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");
const source = fs.readFileSync(path.join(__dirname,"../stats.js"),"utf8");
function fixture(database=false, failInsert=false) {
  const calls=[], values=new Map(); let options;
  class Pool {
    constructor(o) { options=o; }
    on() {}
    async query(sql,args=[]) {
      calls.push({sql,args});
      if (sql.includes('INSERT INTO')) {
        if (failInsert) { failInsert=false; throw Error('fixture failure'); }
        for(let i=0;i<args.length;i+=2)values.set(args[i],(values.get(args[i])||0)+args[i+1]);
      }
      if(sql.startsWith('SELECT'))return {rows:[...values].map(([d,visits])=>({d,visits}))};
      if(sql==='DELETE FROM stat_daily_visits')values.clear();
      return {rows:[]};
    }
  }
  const env={STATS_PASSWORD:'fixture-password', ...(database?{DATABASE_URL:'postgres://fixture@db.example.org/test?sslmode=no-verify'}:{})};
  const context=vm.createContext({require:n=>n==='pg'?{Pool}:require(n),module:{exports:{}},process:{env},console:{log(){},error(){}},Buffer,URL,
    setTimeout(){return{unref(){}};},setInterval(){return{unref(){}};}});
  vm.runInContext(source,context);
  return {stats:context.module.exports,calls,getOptions:()=>options};
}
async function serverFor(stats) {
  const app=express();
  app.get('/',(req,res)=>{stats.recordVisit();res.send('home');});app.use(stats.router);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
const auth={Authorization:'Basic '+Buffer.from('owner:fixture-password').toString('base64')};
test('aggregate counts include refreshes without identifying or deduplicating visitors',async()=>{
  const {stats}=fixture();const server=await serverFor(stats);
  try {
    for(let i=0;i<3;i++)await fetch(server.base+'/',{headers:{'X-Anon-Id':'never-store-me','User-Agent':'fixture bot'}});
    const s=await stats.readStats();assert.equal(s.today.visits,3);assert.equal(s.week.visits,3);
    assert.equal(s.persistent,false);assert.doesNotMatch(JSON.stringify(s),/never-store-me|anon_id|users|conversations|ip_address/);
  }finally{await server.close();}
});
test('old visit beacons are harmless no-ops and cannot inject identities into counts',async()=>{
  const {stats}=fixture();const server=await serverFor(stats);
  try {
    const r=await fetch(server.base+'/api/stats/visit',{method:'POST',headers:{'content-type':'text/plain'},body:'{"id":"never-store-me"}'});
    assert.equal(r.status,204);assert.equal((await stats.readStats()).today.visits,0);
  }finally{await server.close();}
});
test('private counter is protected, uncacheable and labels counts as visits not people',async()=>{
  const {stats}=fixture();stats.recordVisit();const server=await serverFor(stats);
  try {
    assert.equal((await fetch(server.base+'/stats')).status,401);
    const r=await fetch(server.base+'/stats',{headers:auth}),html=await r.text();
    assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
    assert.match(html,/not unique people/);assert.match(html,/Today .*<strong>1<\/strong>/);
    assert.doesNotMatch(html,/Unique users|Conversations:|anon_id/);
  }finally{await server.close();}
});
test('reset requires the private form token even with valid Basic credentials',async()=>{
  const {stats}=fixture();stats.recordVisit();const server=await serverFor(stats);
  try {
    for(const csrf of ['', 'wrong', 'é'.repeat(64)]) {
      const r=await fetch(server.base+'/stats/clear',{method:'POST',headers:{...auth,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf}),redirect:'manual'});
      assert.equal(r.status,403);
    }
    assert.equal((await stats.readStats()).today.visits,1);
    const html=await(await fetch(server.base+'/stats',{headers:auth})).text();
    const csrf=html.match(/name="csrf" value="([a-f0-9]{64})"/)[1];
    const r=await fetch(server.base+'/stats/clear',{method:'POST',headers:{...auth,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf}),redirect:'manual'});
    assert.equal(r.status,303);assert.equal((await stats.readStats()).today.visits,0);
  }finally{await server.close();}
});
test('public database TLS verifies certificates and URL options cannot disable it',async()=>{
  const f=fixture(true);f.stats.recordVisit();await f.stats.flush();
  const options=f.getOptions();assert.equal(options.ssl.rejectUnauthorized,true);
  assert.doesNotMatch(options.connectionString,/sslmode/);
});
test('migration removes identifier tables and stores only date/count aggregates',async()=>{
  const f=fixture(true);f.stats.recordVisit();f.stats.recordVisit();await f.stats.flush();
  const ddl=f.calls.find(c=>c.sql.includes('CREATE TABLE')).sql;
  assert.match(ddl,/DROP TABLE IF EXISTS stat_events/);assert.match(ddl,/DROP TABLE IF EXISTS stat_visits/);
  const insert=f.calls.find(c=>c.sql.includes('INSERT INTO'));
  assert.equal(insert.args.length,2);assert.equal(insert.args[1],2);
  assert.doesNotMatch(insert.sql,/anon_id|ip_address|conversation/);
  assert.equal((await f.stats.readStats()).today.visits,2);
});
test('failed aggregate writes preserve the batch and do not duplicate on retry',async()=>{
  const f=fixture(true,true);f.stats.recordVisit();f.stats.recordVisit();
  await f.stats.flush();await f.stats.flush();
  assert.equal((await f.stats.readStats()).today.visits,2);
  const writes=f.calls.filter(c=>c.sql.includes('INSERT INTO'));
  assert.equal(writes.length,2);assert.deepEqual(writes[0].args,writes[1].args);
});
test('cleanup applies seven-day aggregate retention without reading visitor records',async()=>{
  const f=fixture(true);await f.stats.cleanup();
  const cleanup=f.calls.find(c=>c.sql.startsWith('DELETE FROM stat_daily_visits WHERE'));
  assert.match(cleanup.args[0],/^\d{4}-\d{2}-\d{2}$/);
  assert.doesNotMatch(cleanup.sql,/anon_id|ip_address/);
});
