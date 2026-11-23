async(page)=>{
 const cdp=await page.context().newCDPSession(page);await cdp.send('Page.setBypassCSP',{enabled:true});
 const scans=[];
 for(const path of ['/?lang=en','/instructions?lang=en','/privacy?lang=en']){
  await page.goto('http://127.0.0.1:4177'+path);
  await page.addScriptTag({path:'/private/tmp/a11y-tools/node_modules/axe-core/axe.min.js'});
  const result=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),incomplete:r.incomplete.map(v=>v.id)};});
  scans.push({path,...result});
 }
 await cdp.send('Page.setBypassCSP',{enabled:false});
 await page.goto('http://127.0.0.1:4177/');
 const manifest=await cdp.send('Page.getAppManifest');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
 await page.context().setOffline(true);
 try{await page.goto('http://127.0.0.1:4177/');if(!(await page.content()).includes('offline'))throw Error('offline fallback absent');}
 finally{await page.context().setOffline(false);}
 return {scans,manifestErrors:manifest.errors,offlineFallback:true};
}
