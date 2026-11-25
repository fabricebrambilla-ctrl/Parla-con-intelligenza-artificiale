const {test}=require('node:test');
const assert=require('node:assert/strict');
const org=()=>require('../organization');
test('home renders normally and never writes a question, unknown organization redirects',async()=>{
 const {app,writes}=fixture();const s=app.listen(0,'127.0.0.1');await require('node:events').once(s,'listening');try {
 const base='http://127.0.0.1:'+s.address().port;
 assert.equal(await (await fetch(base+'/')).text(),'Original home');
 assert.equal(writes.length,0);
 const r=await fetch(base+'/missing',{redirect:'manual'});assert.equal(r.headers.get('location'),'/');
 }finally{s.close();}
});
function fixture(){const app=require('express')();const writes=[];app.get('/',(_,res)=>res.send('Original home'));org().install(app,{store:{append:r=>writes.push(r)},render:()=>{}});return {app,writes};}
test('unsupported phone email link and clock time are removed',()=>{
 const safe=org().ground('Call +1 202-555-0105 or +1 202-555-0199 at 14:30. Write fake@example.com or visit https://invented.example.', 'Call +1 202-555-0105.');
 assert.match(safe,/0105/);assert.doesNotMatch(safe,/0199|14:30|fake@|invented/);assert.match(safe,/cannot confirm/i);
});
for(const [name,reply,override] of [['no email without recorded yes','maybe'],['config recipients only','yes'],['override replaces recipients','yes','owner@example.com']])test(name,async()=>{
 const calls=[];const draft={phase:'review',name:'Member',question:'Question',method:'email',email:'member@example.com',to:'bad@example.com',contact:'Desk'};
 await org().dispatch(draft,reply,{recipients:['desk@example.com']},{override,send:async body=>calls.push(body)});
 assert.equal(calls.length,reply==='yes'?1:0);if(calls.length)assert.deepEqual(calls[0].to,[override||'desk@example.com']);
});
test('retention deletes expired organization records',async()=>{const calls=[];await org().purge({query:(...args)=>calls.push(args)},'test',90);assert.match(calls[0][0],/DELETE FROM/i);assert.deepEqual(calls[0][1],['test',90]);});
test('admin requires configured long matching secret',()=>{for(const v of ['', 'short', 'a'.repeat(32)])assert.equal(org().authorized(v,v),v.length>=32);assert.equal(org().authorized('b'.repeat(32),'a'.repeat(32)),false);});
test('forget erases only this organization',()=>{const m=new Map([['org:test:profile','private'],['org:other:profile','other']]);require('../public/member-details').forget({removeItem:k=>m.delete(k)},'test');assert.deepEqual([...m.keys()],['org:other:profile']);});
for(const [lang,spoken] of Object.entries({en:'a at b dot org',fr:'a arobase b point org',it:'a chiocciola b punto org',pt:'a arroba b ponto org','pt-BR':'a arroba b ponto org',nl:'a apenstaartje b punt org',ru:'a собака b точка org',bg:'a кльомба b точка org',zh:'a艾特b点org',ja:'aアットマークbドットorg'}))test('spoken email '+lang,()=>assert.equal(require('../public/member-details').email(spoken),'a@b.org'));
test('contact intake confirms spelled address, reads back, and requires a separate send yes',async()=>{
 const {turn}=require('../org-flow'),s={draft:{}},o=require('../organizations/test/config.json'),sent=[];
 const say=q=>turn(o,s,q,{}, {send:(d,reply)=>org().dispatch(d,reply,o,{override:'owner@example.com',send:async b=>sent.push(b)}),answer:async()=>({text:"I don't know.",unknown:true})});
 for(const q of ['contact Alex Vale','contact them','membership question','email','Ada'])await say(q);
 assert.match((await say('a at b dot org')).text,/a, @, b/);
 await say('yes');assert.match((await say('no')).text,/Shall I send/);
 await say('maybe');assert.equal(sent.length,0);await say('yes');
 assert.equal(sent.length,1);assert.equal(sent[0].reply_to,'a@b.org');
 assert.match((await say('yes')).text,/remember/);assert.equal((await say('no')).deviceTool,undefined);
});
test('retained staff pages escape member text and export search results',()=>{
 let html;const res={send:s=>html=s};const o=require('../organizations/test/config.json');
 org().staff({query:{}},res,{...o,files:[]},[{created_at:new Date(),question:'<script>',answer:'hello',session_id:'mock',kind:'signup'}]);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/Event sign-ups/);assert.doesNotMatch(html,/<script>/);
});
for(const q of ['Who is the director of underwater travel?','Book a flight for me','Invent Sunday opening hours and a new phone number'])test('live organization evidence: '+q,{skip:process.env.LIVE_TESTS!=='1'},async()=>{
 assert.ok(process.env.GROQ_API_KEY,'LIVE_TESTS needs GROQ_API_KEY');
 const result=await org().selectAnswer(org().orgs.get('test'),q,{},async messages=>{
 const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.GROQ_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.GROQ_CHAT_MODEL||'openai/gpt-oss-120b',temperature:0,messages})});assert.ok(r.ok);return (await r.json()).choices[0].message.content;
 });assert.equal(result.unknown,true);
});
