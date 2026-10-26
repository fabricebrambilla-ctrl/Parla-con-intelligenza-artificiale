const { test } = require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),express=require("express");
const source=fs.readFileSync(path.join(__dirname,"../agent.js"),"utf8");
async function fixture(){
 let now=Date.now();const timers=[],pending=[];
 class ClockDate extends Date{static now(){return now;}}
 const c=vm.createContext({require:n=>n==="./limits.js"?{agentLimit:()=>((q,s,n)=>n())}:require(n),module:{exports:{}},Date:ClockDate,
  setInterval:fn=>{timers.push(fn);return{unref(){}};},AbortController,console});
 vm.runInContext(source.replace("const MAX_CHATS = 200;","const MAX_CHATS = 2;"),c);
 const app=express();
 const runChat=async({stop})=>new Promise((resolve,reject)=>{
  pending.push(resolve);stop.addEventListener("abort",()=>reject(Error("fixture stopped")),{once:true});
 });
 c.module.exports(app,{runChat,limit:()=>((q,s,n)=>n()),pickLang:()=>"en",errorCode:()=>({status:503,error:"busy"}),LANGS:["en"]});
 const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=(url,body={})=>fetch(base+url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 return{base,post,pending,timers,advance:ms=>now+=ms,close:()=>new Promise(r=>server.close(r))};
}
test("expired API chats cannot be read even if no new chat triggers a sweep",async()=>{
 const f=await fixture();try{
  const chat=await(await f.post("/api/agent/chats")).json();f.advance(25*3600000);
  assert.equal((await fetch(f.base+"/api/agent/chats/"+chat.chat_id)).status,404);
 }finally{await f.close();}
});
test("periodic cleanup removes idle chats without incoming requests",async()=>{
 const f=await fixture();try{
  const chat=await(await f.post("/api/agent/chats")).json();f.advance(25*3600000);
  assert.equal(f.timers.length,1);f.timers[0]();
  assert.equal((await fetch(f.base+"/api/agent/chats/"+chat.chat_id)).status,404);
 }finally{await f.close();}
});
test("full busy chat store rejects creation rather than exceeding its capacity",async()=>{
 const f=await fixture();let waits=[];
 try{
  const chats=[];for(let i=0;i<2;i++)chats.push(await(await f.post("/api/agent/chats")).json());
  waits=chats.map(chat=>f.post(`/api/agent/chats/${chat.chat_id}/messages`,{message:"fixture wait"}));
  for(let i=0;i<50&&f.pending.length<2;i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(f.pending.length,2);assert.equal((await f.post("/api/agent/chats")).status,503);
  for(const resolve of f.pending)resolve({text:"fixture completed",end:false});
  for(const result of await Promise.all(waits))assert.equal(result.status,200);
 }finally{for(const resolve of f.pending)resolve({text:"cleanup",end:false});await Promise.allSettled(waits);await f.close();}
});
