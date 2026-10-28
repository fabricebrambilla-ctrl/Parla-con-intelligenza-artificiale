// Only local stand-in providers. Never consumes API credits or uploads real audio.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http'),path=require('node:path');
const {spawn}=require('node:child_process');
const PORT=3983,UPSTREAM=3984,BASE=`http://127.0.0.1:${PORT}`;
let server,fake,sttBody='',chatBody,ttsBody;
before(async()=>{
 fake=http.createServer((req,res)=>{const chunks=[];req.on('data',d=>chunks.push(d));req.on('end',()=>{
  const raw=Buffer.concat(chunks).toString('utf8');
  if(req.url.endsWith('/audio/transcriptions')){sttBody=raw;return res.end(JSON.stringify({text:'こんにちは。質問があります。',language:'japanese'}));}
  if(req.url==='/tts'){ttsBody=JSON.parse(raw);res.setHeader('Content-Type','audio/mpeg');return res.end(Buffer.from('ID3fixture'));}
  chatBody=JSON.parse(raw);res.end(JSON.stringify({choices:[{message:{role:'assistant',content:'こんにちは。どのようなことを知りたいですか。'}}]}));
 });}).listen(UPSTREAM,'127.0.0.1');
 server=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{PATH:process.env.PATH,NODE_ENV:'test',PORT:String(PORT),GROQ_API_KEY:'fixture',GROQ_BASE_URL:`http://127.0.0.1:${UPSTREAM}`,TAVILY_API_KEY:'',FISH_API_KEY:'fixture',FISH_BASE_URL:`http://127.0.0.1:${UPSTREAM}/tts`,FISH_VOICE_JA:'japanese-voice-fixture'},stdio:'ignore'});
 for(let i=0;i<100;i++){try{if((await fetch(BASE+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw Error('local Japanese fixture did not start');
});
after(async()=>{server?.kill();if(fake)await new Promise(r=>fake.close(r));});
test('Japanese URL and browser preference render all pages without English fallback',async()=>{
 for(const page of ['/','/about','/organizations','/privacy','/accessibility']){
  const r=await fetch(BASE+page+'?lang=ja',{headers:{'Accept-Language':'en-US'}});const html=await r.text();
  assert.equal(r.status,200);assert.equal(r.headers.get('content-language'),'ja');assert.match(html,/<html lang="ja">/);assert.match(html,/[ぁ-んァ-ヶ]/);assert.doesNotMatch(html,/\{\{|undefined/);
 }
 const html=await(await fetch(BASE+'/',{headers:{'Accept-Language':'ja-JP,ja;q=0.9,en;q=0.8'}})).text();
 assert.match(html,/data-set-lang="ja">日本語/);assert.match(html,/<html lang="ja">/);
});
test('Japanese speech recognition sends ISO language ja instead of silently using English',async()=>{
 const wav=Buffer.alloc(44+32000);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(32000,40);
 const r=await fetch(BASE+'/api/transcribe?lang=ja',{method:'POST',headers:{'Content-Type':'audio/wav'},body:wav});assert.equal(r.status,200);assert.match((await r.json()).text,/こんにちは/);assert.match(sttBody,/name="language"\r\n\r\nja\r\n/);
});
test('Japanese chat uses Japanese instructions and returns the matching speech language',async()=>{
 const r=await fetch(BASE+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang:'ja',messages:[{role:'user',content:'こんにちは。'}]})});
 const last=JSON.parse((await r.text()).trim().split('\n').at(-1));assert.equal(last.lang,'ja');assert.match(last.text,/こんにちは/);assert.match(chatBody.messages[0].content,/reply in Japanese/);
});
test('Japanese output uses the Japanese voice reference and existing TTS route',async()=>{
 const r=await fetch(BASE+'/api/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang:'ja',text:'こんにちは。'})});
 assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/audio\/mpeg/);assert.equal(ttsBody.reference_id,'japanese-voice-fixture');assert.equal(ttsBody.text,'こんにちは。');
});
test('capabilities and agent documentation expose Japanese as supported',async()=>{
 assert.ok((await(await fetch(BASE+'/api/limit')).json()).aiVoice.includes('ja'));
 assert.ok((await(await fetch(BASE+'/api/agent')).json()).languages.includes('ja'));
});
