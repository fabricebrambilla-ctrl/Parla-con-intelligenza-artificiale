const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");
let mock, child, port, modelCalls=0, searches=0;
const base="http://127.0.0.1:4017";
const budget=()=>({primary_requests:2,primary_tokens:30000,fallback_requests:0,fallback_tokens:0,
  speech_requests:1,audio_seconds:25,searches:1});
const headers=(b=budget())=>({"content-type":"application/json","x-synthetic-test":"true","x-qa-budget":JSON.stringify(b)});
before(async()=>{
  mock=http.createServer(async(req,res)=>{
    let raw="";for await(const chunk of req)raw+=chunk;
    let data;
    if(req.url==="/chat/completions"){
      modelCalls++;
      const b=JSON.parse(raw);
      data={usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150},
        choices:[{message:b.tool_choice==="none"?{content:"Fixture spoken answer."}:{content:"",tool_calls:[
          {id:"one",type:"function",function:{name:"web_search",arguments:'{"query":"one"}'}},
          {id:"two",type:"function",function:{name:"web_search",arguments:'{"query":"two"}'}}]}}]};
    }else if(req.url==="/search"){searches++;data={results:[{title:"Fixture",url:"https://example.org",content:"test"}]};}
    else data={text:"Fixture spoken question."};
    res.writeHead(200,{"content-type":"application/json","x-request-id":"fixture-qa-request"});
    res.end(JSON.stringify(data));
  });
  await new Promise(resolve=>mock.listen(0,"127.0.0.1",resolve));port=mock.address().port;
  child=spawn(process.execPath,[path.join(__dirname,"..","server.js")],{env:{...process.env,NODE_ENV:"test",
    PORT:"4017",GROQ_API_KEY:"fixture-not-real",TAVILY_API_KEY:"fixture-not-real",GROQ_BASE_URL:`http://127.0.0.1:${port}`,
    TAVILY_BASE_URL:`http://127.0.0.1:${port}/search`,REDIS_URL:"",DATABASE_URL:""},stdio:"ignore"});
  for(let i=0;i<60;i++){try{if((await fetch(base+"/health")).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}
  throw new Error("QA fixture server did not start");
});
after(async()=>{child?.kill();await new Promise(resolve=>mock.close(resolve));});
async function chat(b){
  const r=await fetch(base+"/api/chat",{method:"POST",headers:headers(b),body:JSON.stringify({lang:"en",messages:[{role:"user",content:"Test"}]})});
  return (await r.text()).trim().split("\n").map(JSON.parse).at(-1);
}
test("capability check exposes only safe model/configuration contract",async()=>{
  const d=await(await fetch(base+"/api/qa")).json();
  assert.equal(d.version,1);assert.equal(d.primary_model,"openai/gpt-oss-120b");
  assert.equal(d.output_voice_budgeted,false);assert.doesNotMatch(JSON.stringify(d),/fixture-not-real/);
});
test("actual chat counts both model calls, permits only one search, reports usage",async()=>{
  const beforeModels=modelCalls,beforeSearch=searches;
  const r=await chat(budget());
  assert.equal(r.type,"reply");assert.equal(r.telemetry.qa.spent.primary_requests,2);
  assert.equal(r.telemetry.qa.spent.primary_tokens,300);
  assert.equal(r.telemetry.qa.spent.searches,1);
  assert.equal(modelCalls-beforeModels,2);assert.equal(searches-beforeSearch,1);
});
test("exhausted tokens refuse paid dispatch and exhausted search makes no Tavily call",async()=>{
  let before=modelCalls;const denied=await chat({...budget(),primary_tokens:1});
  assert.equal(denied.error,"qa_budget");assert.equal(modelCalls,before);
  before=searches;const noSearch=await chat({...budget(),searches:0});
  assert.equal(noSearch.type,"reply");assert.equal(searches,before);
});
test("actual speech route charges measured audio, before contacting provider",async()=>{
  const b=Buffer.alloc(44+16000*2*5);b.write("RIFF",0);b.writeUInt32LE(b.length-8,4);
  b.write("WAVEfmt ",8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
  b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
  b.write("data",36);b.writeUInt32LE(b.length-44,40);
  const r=await fetch(base+"/api/transcribe?lang=en",{method:"POST",headers:{...headers(),"content-type":"audio/wav"},body:b});
  const d=await r.json();assert.equal(d.telemetry.qa.spent.speech_requests,1);
  assert.equal(d.telemetry.qa.spent.audio_seconds,10);
  const failed=await fetch(base+"/api/transcribe?lang=en",{method:"POST",headers:{...headers({...budget(),speech_requests:0}),"content-type":"audio/wav"},body:b});
  assert.equal(failed.status,429);
});
test("missing explicit synthetic label rejects budget envelope",async()=>{
  const h=headers();delete h["x-synthetic-test"];
  const r=await fetch(base+"/api/chat",{method:"POST",headers:h,body:"{}"});
  assert.equal(r.status,400);
});
