const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../public/style.css'),'utf8');
const themes=[...css.matchAll(/:root\s*\{([^}]+)\}/g)].map(m=>Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*(#[a-f0-9]{6})/gi)].map(x=>[x[1],x[2]])));
function luminance(hex){return hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [i,override] of themes.entries()){
 const t={...themes[0],...override},name=i?'dark':'light';
 test(`${name} theme text and active controls retain readable contrast`,()=>{
  for(const [fg,bg] of [['fg','bg'],['muted','bg'],['btn-fg','btn'],['btn2-fg','btn2'],['btn-fg','end']])assert.ok(contrast(t[fg],t[bg])>=4.5,`${fg}/${bg}: ${contrast(t[fg],t[bg]).toFixed(2)}`);
 });
 test(`${name} focus outline is visible against the page background`,()=>assert.ok(contrast(t.focus,t.bg)>=3,`${name}: ${contrast(t.focus,t.bg).toFixed(2)}`));
}
