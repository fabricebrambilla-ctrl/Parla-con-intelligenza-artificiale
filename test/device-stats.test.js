const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');
const source = fs.readFileSync(require('node:path').join(__dirname,'../device-stats.js'),'utf8');
function fixture(database = false) {
  const calls = [], rows = new Map();
  let options, failure = false, pause, now = Date.parse('2026-10-27T12:00:00Z');
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  class Pool {
    constructor(value) { options = value; } on() {}
    async query(sql,args=[]) {
      calls.push({sql,args});
      if (sql.startsWith('INSERT')) {
        if (pause) await pause;
        if (failure) { failure=false; throw Error('offline'); }
        for(let i=0;i<args.length;i+=5) {
          const [date,os,browser,major,visits]=args.slice(i,i+5), key=JSON.stringify([date,os,browser,major]);
          rows.set(key,{date,os,browser,major,visits:visits+(rows.get(key)?.visits||0)});
        }
      }
      if (sql.startsWith('DELETE')) for(const [key,row] of rows) if(row.date<args[0])rows.delete(key);
      return {rows:sql.startsWith('SELECT')?[...rows.values()].filter(row=>row.date>=args[0]):[]};
    }
  }
  const context=vm.createContext({require:n=>n==='pg'?{Pool}:require(n), module:{exports:{}},
    process:{env:database?{DATABASE_URL:'postgres://fixture@db.example.org/test?sslmode=no-verify'}:{}},
    Date:Clock, URL, console:{error(){}}, setTimeout(){return{unref(){}};},setInterval(){return{unref(){}};}});
  vm.runInContext(source,context);
  return {stats:context.module.exports,calls,rows,options:()=>options, fail:()=>{failure=true;},
    setNow:value=>{now=Date.parse(value);},hold:()=>{pause=new Promise(resolve=>{pauseRelease=resolve;});},release:()=>{pauseRelease();pause=null;}};
  var pauseRelease;
}
const device={os:'Windows',browser:'Chrome',major:131};
test('counts visits without retaining request identifiers or unknown fields',async()=>{
  const {stats}=fixture();
  const app=express();app.use(stats.router);const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/device-count`;
  try {
    for(let i=0;i<2;i++) assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'private-UA','X-Anon-Id':'private-ID'},body:JSON.stringify(device)})).status,204);
    const bad=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...device,userId:'private-ID'})});
    assert.equal(bad.status,400);
    const counts=await stats.readCounts();assert.equal(counts.visits,2);assert.equal(counts.rows[0].os,'windows');
    assert.doesNotMatch(JSON.stringify(counts),/private-UA|private-ID|userId|userAgent/);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('device categories and numeric major are bounded, with normalized detection values',()=>{
  const {stats}=fixture();
  for(const value of [null,[],{}, {...device,major:1000},{...device,major:-1},{...device,major:1.2},{...device,major:'131'},{...device,os:'private-machine'},{...device,browser:'custom'}])assert.equal(stats.recordDevice(value),false);
  assert.equal(stats.normalizeDevice({os:'Android',browser:'Samsung Internet',major:25}).browser,'samsung');
  assert.equal(stats.normalizeDevice({os:'Unknown',browser:'Unknown',major:null}).major,0);
});
test('Postgres writes only date/category totals and verifies external TLS',async()=>{
  const f=fixture(true);f.stats.recordDevice(device);f.stats.recordDevice(device);await f.stats.flush();
  const insert=f.calls.find(call=>call.sql.startsWith('INSERT'));
  assert.deepEqual(Array.from(insert.args),['2026-10-27','windows','chrome',131,2]);
  assert.equal(f.options().ssl.rejectUnauthorized,true);assert.doesNotMatch(f.options().connectionString,/sslmode/);
  assert.equal((await f.stats.readCounts()).visits,2);
});
test('concurrent flushes and counts during a failed flush preserve each visit once',async()=>{
  const f=fixture(true);f.stats.recordDevice(device);f.hold();f.fail();
  const first=f.stats.flush();
  while(!f.calls.some(call=>call.sql.startsWith('INSERT')))await new Promise(resolve=>setImmediate(resolve));
  f.stats.recordDevice(device);const second=f.stats.flush();f.release();await Promise.all([first,second]);
  assert.equal((await f.stats.readCounts()).visits,2);
  assert.equal(f.calls.filter(call=>call.sql.startsWith('INSERT')).length,2);
});
test('seven Zurich calendar days govern database and memory retention over DST',async()=>{
  for(const database of [false,true]) {
    const f=fixture(database);f.setNow('2026-10-20T22:30:00Z');f.stats.recordDevice(device);await f.stats.flush();
    f.setNow('2026-10-27T12:00:00Z');assert.equal((await f.stats.readCounts()).visits,1);
    f.setNow('2026-10-28T12:00:00Z');await f.stats.cleanup();assert.equal((await f.stats.readCounts()).visits,0);assert.equal(f.rows.size,0);
  }
});
test('in-memory fallback has bounded category capacity',async()=>{
  const {stats}=fixture();
  for(const os of ['Windows','Mac','iPhone','iPad','Android'])for(let major=0;major<1000;major++)stats.recordDevice({os,browser:'Chrome',major});
  const counts=await stats.readCounts();assert.equal(counts.rows.length,4096);assert.equal(counts.incomplete,true);assert.equal(counts.persistent,false);
});
test('storage failure leaves useful in-memory totals and never rejects a visit',async()=>{
  const f=fixture(true);f.stats.recordDevice(device);f.fail();const counts=await f.stats.readCounts();
  assert.equal(counts.visits,1);assert.equal(counts.persistent,false);assert.equal(counts.incomplete,true);
  assert.equal((await f.stats.readCounts()).visits,1);
});
test('all nine privacy notices describe device aggregates and preserve provider disclosures',()=>{
  const notices=require('../privacy-notice');
  assert.equal(Object.keys(notices).length,9);
  for(const notice of Object.values(notices)) {
    assert.match(notice.sections[4][1],/Europe\/Zurich/);
    assert.match(notice.sections[5][1],/Render/);
  }
  assert.match(notices.en.sections[4][1],/operating system, browser and major version/);
  assert.match(notices.en.sections[4][1],/not linked to conversations/);
  assert.match(notices.en.sections[4][1],/current session/);
});
