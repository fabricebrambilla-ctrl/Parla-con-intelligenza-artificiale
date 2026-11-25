'use strict';
// Loaded exclusively by the organization template.
window.orgClient=(()=>{
  const slug=document.body.dataset.org,prefix='org:'+slug+':',key=prefix+'profile';
  let sid,profile={},input=null,explained=[],temporaryLanguage;
  try{profile=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
  function count(stage){
    try{if(localStorage.getItem(prefix+'count:'+stage))return;localStorage.setItem(prefix+'count:'+stage,'1');}catch{}
    fetch('/api/org/'+slug+'/count',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage})}).catch(()=>{});
  }
  function show(mode,focus){
    input=mode;const form=document.getElementById('detailForm'),field=form.elements[0];
    if(!mode&&form.contains(document.activeElement)&&focus)focus();
    form.hidden=!mode;field.value='';
    if(mode){document.getElementById('detailLabel').textContent='Type your '+mode+' instead';field.type=mode==='email'?'email':'tel';}
  }
  function apply(tool,lang,speed){
    if(!tool)return '';
    try{
      if(tool.name==='mark_explained'){if(!explained.includes(tool.field))explained.push(tool.field);return '';}
      if(tool.name==='forget_all'){MemberDetails.forget(localStorage,slug);profile={};explained=[];return 'I have cleared the saved details for this organization.';}
      const list=p=>Object.entries(p).map(([k,v])=>k+': '+v).join('. ');
      if(tool.name==='read_details')return list(profile)||'There are no saved details.';
      const next={...profile};
      if(tool.name==='delete_detail')delete next[tool.field];
      else if(tool.name==='save_details'){
        Object.assign(next,{language:lang,speed},tool.values);
        if(!I18N.LANGS.includes(next.language))return 'I could not confirm that language setting.';
        const n=Number(next.speed);if(!Number.isFinite(n)||n<0.6||n>1.6)return 'I could not confirm that speed.';next.speed=n;
      }else return '';
      localStorage.setItem(key,JSON.stringify(next));profile=next;
      return tool.name==='delete_detail'?'Deleted '+tool.field+'.':'Remembered: '+list(next)+'.';
    }catch{return 'I could not change the saved details on this device.';}
  }
  function record(question,answer){
    if(!sid)return;
    fetch('/api/org/'+slug+'/local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sid,question,answer}),keepalive:true}).catch(()=>{});
  }
  return {slug,prefix,record,count,apply,show,get profile(){return profile;},get input(){return input;},get language(){return temporaryLanguage||profile.language;},set language(v){temporaryLanguage=v;},
    start(){sid=crypto.randomUUID();count('start');},get sid(){return sid;},get explained(){return explained;},
    end(){sid=null;show(null,()=>document.getElementById('talk').focus());}};
})();
