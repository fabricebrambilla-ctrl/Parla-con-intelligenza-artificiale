'use strict';
const {email,phone}=require('./public/member-details');
const affirmative=q=>/^(yes|yes please|oui|si|sì|sim|ja|да|はい|是|对)[.!。]?$/iu.test(q.trim());
const negative=q=>/^(no|no thanks|non|não|nee|нет|не|いいえ|不)[.!。]?$/iu.test(q.trim());
async function dispatch(d,reply,org,{override,send}){
  if(d.phase!=='review'||!affirmative(reply))return false;
  d.phase='sending';d.confirmed=reply;
  const target=org.contacts?.find(c=>c.name===d.contact)?.email;
  const to=override?[override]:org.recipients.includes(target)?[target]:org.recipients;
  if(!to.length)throw Error('No configured recipient');
  await send({to,...(d.email?{reply_to:d.email}:{}),subject:d.event?'Event sign-up request':'Member contact request',
    text:summary(d)});return true;
}
function summary(d){return ['Intended contact: '+d.contact,'Member: '+d.name,'Reply by: '+d.method,d.email,d.phone,'Question: '+d.question,d.callback&&'Callback: '+d.callback,d.event&&'Event: '+d.event].filter(Boolean).join('. ');}
function contact(o,q){
  const score=c=>[c.name,...c.topics].reduce((sum,t)=>sum+(q.toLowerCase().includes(t.toLowerCase())?t.length:0),0);
  return o.contacts.reduce((a,b)=>score(b)>score(a)?b:a);
}
const prompts={choice:'Would you like the contact details, or shall I contact them?',question:'What would you like me to pass on?',method:'How would you like a reply: email, message or phone call?',name:'What name should I use?',email:'Please spell your email address. You can also type it instead.',phone:'Please say your phone number digit by digit. You can also type it instead.',callback:'Would you like a callback on a particular day and time? Include your time zone, or say no.',own:'Is this your own device?',remember:'Shall I remember this on this device?'};
const explanation='I can give you the contact details or pass on a request. I will ask for your message, name and reply preference, read it all back, and send only if you confirm. You can interrupt or cancel at any time.';
function openNow(o,now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:o.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  const h=o.hours[parts.weekday],t=parts.hour+':'+parts.minute;return !!h&&t>=h[0]&&t<h[1];
}
async function turn(o,s,q,state,services){
  const d=s.draft;
  if(/^read (?:the |your )?newsletter/i.test(q))return {text:'I cannot read the newsletter aloud. I can answer questions about information in it.'};
  function ask(phase,text){d.phase=phase;return {text:text||prompts[phase],input:['email','phone'].includes(phase)?phase:null};}
  function done(text,extra){s.draft={};return {text,...extra};}
  const events=o.events.flatMap(e=>e.sessions.map(t=>e.name+' '+t));
  if(/^(cancel|never mind)(?: request)?[.!]?$/i.test(q))return done('Request cancelled.');
  if(/\burgent\b/i.test(q)){const c=contact(o,q+' '+(d.contact||''));return {text:c.name+'. '+c.phone+'.'};}
  if(/forget (all |my )?(details|data|information)/i.test(q))return done('Clearing your saved details.',{deviceTool:{name:'forget_all'}});
  if(/what details|read my details/i.test(q))return {text:'Checking the saved details on this device.',deviceTool:{name:'read_details'}};
  const edit=q.match(/^(change|save|remember|delete) my (phone|email|name|language|speed|answer preferences?)/i);
  if(edit){
    const field=edit[2].toLowerCase().replace(/^answer preferences?$/,'preferences');
    if(edit[1].toLowerCase()==='delete')return done('Removing '+field+'.',{deviceTool:{name:'delete_detail',field}});
    s.draft={edit:field,phase:field};return {text:prompts[field]||'What '+field+' should I remember?',input:['email','phone'].includes(field)?field:null};
  }
  if(/explain (again|the process)|how does (this|it) work/i.test(q))return {text:explanation+' '+(prompts[d.phase]||'')};
  if(d.repeatOffer&&(affirmative(q)||negative(q))){
    d.repeatOffer=false;if(negative(q))s.declined=true;
    return {text:(s.declined?'Okay. ':explanation+' ')+(prompts[d.phase]||events.join('; '))};
  }
  d.repeatOffer=false;
  if(/\boffice open|\bopen (right )?now/i.test(q))return {text:'The office is '+(openNow(o)?'open':'closed')+' now in '+o.timezone+'.'};
  // A question may interrupt any prompt. Resume by reading the pending question again.
  if(d.phase && /^(?:search|look up)\b/i.test(q))return services.answer();
  if(d.phase && d.phase!=='question' && /^(what|who|where|when|why|how|can you|is there)\b/i.test(q)){
    const res=await services.answer();return {...res,text:res.text+' '+(d.phase==='review'?summary(d)+'. Shall I send it?':prompts[d.phase]||'')};
  }
  if(['name','email','phone'].includes(d.phase)&&/^use (?:my )?saved/i.test(q)){
    const value=state.details?.[d.phase];if(typeof value!=='string'||!value)return ask(d.phase,'I have no saved '+d.phase+'. '+prompts[d.phase]);q=value;
  }
  if(d.phase)switch(d.phase){
    case 'choice':{
      const c=o.contacts.find(c=>c.name===d.contact);
      if(/detail|number|address/i.test(q))return done([c.name,c.job,c.phone,c.email,c.hours,...c.languages].join('. '));
      if(/contact|send|pass on/i.test(q)||affirmative(q))return ask('question');if(negative(q))return done('Okay.');return ask('choice');
    }
    case 'event':{const matches=events.filter(e=>e.toLowerCase().includes(q.toLowerCase()));if(matches.length!==1)return ask('event','Please choose a session: '+events.join('; '));d.event=matches[0];return ask('question');}
    case 'question':d.question=q;{const selected=contact(o,q);if(selected!==o.contacts[0]&&!d.event)d.contact=selected.name;}return ask('method');
    case 'method':if(!/^(email|e-mail|message|text message|phone|call|phone call)[.!]?$/i.test(q))return ask('method');d.method=q;return ask('name');
    case 'name':case 'language':case 'speed':case 'preferences':d[d.phase]=q;return d.edit?ask('own'):ask(/mail/i.test(d.method)?'email':'phone');
    case 'email':case 'phone':{
      const type=d.phase,value=(type==='email'?email:phone)(q);
      if(!value)return ask(type,'I could not confirm that format. '+prompts[type]);d[type]=value;d.check=type;return ask('check',Array.from(value).join(', ')+'. Is that right?');
    }
    case 'check':if(negative(q))return ask(d.check);if(!affirmative(q))return ask('check',Array.from(d[d.check]).join(', ')+'. Is that right?');return ask(d.edit?'own':'callback');
    case 'callback':d.callback=negative(q)?'':q;return ask('review',summary(d)+'. Shall I send this request?');
    case 'review':
      if(negative(q))return done('I have not sent the request.');if(!affirmative(q))return ask('review',summary(d)+'. Shall I send this request?');
      try{await services.send(d,q);}catch{return done('I could not confirm that your request was sent. Please contact '+d.contact+' directly.',{unknown:true});}
      return {...ask('own','Your request was sent. '+prompts.own),kind:d.event?'signup':'message',requestSummary:summary(d)};
    case 'own':if(negative(q))return done('Okay. Your details will not be saved on this device.');return ask(affirmative(q)?'remember':'own');
    case 'remember':if(negative(q))return done('Okay. Your details will not be saved on this device.');if(!affirmative(q))return ask('remember');
      return done('Saving confirmed details.',{deviceTool:{name:'save_details',values:Object.fromEntries(['name','email','phone','language','speed','preferences'].filter(k=>d[k]).map(k=>[k,d[k]]))}});
  }
  const event=/sign[ -]?up|register|book a place/i.test(q);
  if(event||/contact|talk to|speak to|person|phone number/i.test(q)||o.contacts.some(c=>q.toLowerCase().includes(c.name.toLowerCase()))){
    d.contact=contact(o,event?'event':q).name;const process=event?'event':'contact',seen=state.explained?.includes(process);
    const next=event?ask('event','Which event and session? '+events.join('; ')):ask('choice');
    d.repeatOffer=seen&&!s.declined;
    return {...next,text:(seen?'Same as before. '+(d.repeatOffer?'Shall I explain again? ':''):explanation+' ')+next.text,deviceTool:{name:'mark_explained',field:process}};
  }
  let res=o.guardrailTopics.some(t=>q.toLowerCase().includes(t))?{text:"I don't know.",unknown:true}:await services.answer();
  if(res.unknown){d.contact=contact(o,q).name;return {...ask('choice',res.text+' '+prompts.choice+' You can also ask me to search.'),unknown:true};}
  return res;
}
module.exports={turn,dispatch,openNow};
