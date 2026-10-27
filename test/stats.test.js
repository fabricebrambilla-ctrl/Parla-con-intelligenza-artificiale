const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");
const source = fs.readFileSync(path.join(__dirname,"../stats.js"),"utf8");
function fixture(database=false, failInsert=false) {
  const calls=[], values=new Map(); let options, currentTime=Date.now();
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [currentTime])); }
    static now() { return currentTime; }
  }
  class Pool {
    constructor(o) { options=o; }
    on() {}
    async query(sql,args=[]) {
      calls.push({sql,args});
      if (sql.includes('INSERT INTO')) {
        if (failInsert) { failInsert=false; throw Error('fixture failure'); }
        for(let i=0;i<args.length;i+=3) {
          const value=values.get(args[i])||{visits:0,questions_submitted:0};
          values.set(args[i],{visits:value.visits+args[i+1],questions_submitted:value.questions_submitted+args[i+2]});
        }
      }
      if(sql.startsWith('SELECT'))return {rows:[...values].map(([d,value])=>({d,...value}))};
      if(sql.startsWith('DELETE FROM stat_daily_visits WHERE'))for(const d of values.keys())if(d<args[0])values.delete(d);
      if(sql==='DELETE FROM stat_daily_visits')values.clear();
      return {rows:[]};
    }
  }
  const env={STATS_PASSWORD:'fixture-password', ...(database?{DATABASE_URL:'postgres://fixture@db.example.org/test?sslmode=no-verify'}:{})};
  const context=vm.createContext({require:n=>n==='pg'?{Pool}:require(n),module:{exports:{}},process:{env},console:{log(){},error(){}},Buffer,URL,Date:ClockDate,
    setTimeout(){return{unref(){}};},setInterval(){return{unref(){}};}});
  vm.runInContext(source,context);
  return {stats:context.module.exports,calls,getOptions:()=>options, values, setNow:value=>{currentTime=new Date(value).getTime();}};
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
  const {stats}=fixture();stats.recordVisit();stats.recordQuestionSubmission();stats.recordQuestionSubmission();const server=await serverFor(stats);
  try {
    for(const csrf of ['', 'wrong', 'é'.repeat(64)]) {
      const r=await fetch(server.base+'/stats/clear',{method:'POST',headers:{...auth,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf}),redirect:'manual'});
      assert.equal(r.status,403);
    }
    assert.equal((await stats.readStats()).today.visits,1);assert.equal((await stats.readStats()).today.questions,2);
    const html=await(await fetch(server.base+'/stats',{headers:auth})).text();
    const csrf=html.match(/name="csrf" value="([a-f0-9]{64})"/)[1];
    const r=await fetch(server.base+'/stats/clear',{method:'POST',headers:{...auth,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf}),redirect:'manual'});
    assert.equal(r.status,303);assert.equal((await stats.readStats()).today.visits,0);assert.equal((await stats.readStats()).today.questions,0);
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
  assert.equal(insert.args.length,3);assert.equal(insert.args[1],2);assert.equal(insert.args[2],0);
  assert.doesNotMatch(insert.sql,/anon_id|ip_address|conversation/);
  assert.equal((await f.stats.readStats()).today.visits,2);
});
test('failed aggregate writes preserve the batch and do not duplicate on retry',async()=>{
  const f=fixture(true,true);f.stats.recordVisit();f.stats.recordVisit();f.stats.recordQuestionSubmission();
  await f.stats.flush();await f.stats.flush();
  assert.equal((await f.stats.readStats()).today.visits,2);assert.equal((await f.stats.readStats()).today.questions,1);
  const writes=f.calls.filter(c=>c.sql.includes('INSERT INTO'));
  assert.equal(writes.length,2);assert.deepEqual(writes[0].args,writes[1].args);
});
test('cleanup applies seven-day aggregate retention without reading visitor records',async()=>{
  const f=fixture(true);await f.stats.cleanup();
  const cleanup=f.calls.find(c=>c.sql.startsWith('DELETE FROM stat_daily_visits WHERE'));
  assert.match(cleanup.args[0],/^\d{4}-\d{2}-\d{2}$/);
  assert.doesNotMatch(cleanup.sql,/anon_id|ip_address/);
});
test('visits and voice questions are independent day-only counters in memory and the database',async()=>{
  for(const persistent of [false,true]) {
    const f=fixture(persistent);f.stats.recordVisit();
    f.stats.recordQuestionSubmission();f.stats.recordQuestionSubmission();
    const s=await f.stats.readStats();
    assert.equal(s.today.visits,1);assert.equal(s.today.questions,2);
    assert.equal(s.week.visits,1);assert.equal(s.week.questions,2);
    assert.deepEqual(Object.keys(s.today).sort(),['date','questions','visits']);
    if(persistent) {
      const ddl=f.calls.find(c=>c.sql.includes('CREATE TABLE')).sql;
      assert.match(ddl,/ADD COLUMN IF NOT EXISTS questions_submitted/);
      const insert=f.calls.find(c=>c.sql.includes('INSERT INTO'));
      assert.equal(insert.args.length,3);assert.deepEqual(Array.from(insert.args).slice(1),[1,2]);
      assert.doesNotMatch(insert.sql,/user_id|anon_id|ip_address|timestamp|content|message/);
    }
  }
});
test('seven Zurich calendar days, not UTC dates or 168 elapsed hours, govern both counters',async()=>{
  for(const persistent of [false,true]) {
    const f=fixture(persistent);
    // Summer time: this UTC instant is already 21 October in Zurich.
    f.setNow('2026-10-20T22:30:00Z');
    f.stats.recordVisit();f.stats.recordQuestionSubmission();await f.stats.flush();
    assert.equal((await f.stats.readStats()).today.date,'2026-10-21');
    // Clocks changed on 25 October; the oldest included day is 21 October.
    f.setNow('2026-10-27T12:00:00Z');await f.stats.cleanup();
    let s=await f.stats.readStats();assert.equal(s.week.visits,1);assert.equal(s.week.questions,1);
    assert.equal(s.rows.length,7);assert.equal(s.rows.at(-1).date,'2026-10-21');
    f.setNow('2026-10-28T12:00:00Z');await f.stats.cleanup();
    s=await f.stats.readStats();assert.equal(s.week.visits,0);assert.equal(s.week.questions,0);
    if(persistent)assert.equal(f.values.size,0);
  }
});
test('private activity page labels submitted voice questions without claiming answered or human counts',async()=>{
  const {stats}=fixture();stats.recordQuestionSubmission();const server=await serverFor(stats);
  try {
    const html=await(await fetch(server.base+'/stats',{headers:auth})).text();
    assert.match(html,/<strong>1<\/strong> questions submitted/);
    assert.match(html,/including requests whose answers fail/);
    assert.match(html,/Flagged synthetic tests and the separate text API are excluded/);
    assert.match(html,/not verified humans or successful answers/);
    assert.match(html,/in memory/);
  }finally{await server.close();}
});
test('database reset clears both aggregates with the existing date-only table delete',async()=>{
  const f=fixture(true);f.stats.recordVisit();f.stats.recordQuestionSubmission();
  await f.stats.flush();assert.equal((await f.stats.readStats()).today.questions,1);
  await f.stats.clearAll();
  const s=await f.stats.readStats();assert.equal(s.week.visits,0);assert.equal(s.week.questions,0);
  assert.ok(f.calls.some(c=>c.sql==='DELETE FROM stat_daily_visits'));
});
