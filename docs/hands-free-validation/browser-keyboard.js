async (page) => {
 const requests=[]; page.on('request', r=>{if(r.url().includes('/api/'))requests.push(r.url());});
 await page.route('**/api/limit',r=>r.fulfill({json:{aiVoice:[]}}));
 await page.addInitScript(()=>{
   window.__spoken=[];
   Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){},speak(u){window.__spoken.push(u.text);setTimeout(()=>u.onend&&u.onend(),20);}}});
   navigator.permissions.query=async()=>({state:'granted'});
   navigator.mediaDevices.getUserMedia=async()=>{const ctx=new AudioContext();const out=ctx.createMediaStreamDestination();window.__mockMic=out.stream;window.__mockContext=ctx;return out.stream;};
   navigator.mediaDevices.enumerateDevices=async()=>[];
   localStorage.setItem('introHeard','1');localStorage.setItem('agreementHeard','2026-11-23');
 });
 await page.reload();
 await page.getByRole('button',{name:'Start conversation',exact:true}).focus();
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.body.dataset.state==='listening',{timeout:10000});
 const welcome=await page.evaluate(()=>window.__spoken.filter(t=>t.trim()));
 await page.keyboard.press('Control');
 await page.waitForFunction(()=>document.body.dataset.state==='paused');
 const closed=await page.evaluate(()=>window.__mockMic.getTracks().every(t=>t.readyState==='ended'));
 await page.keyboard.press('Control');await page.waitForFunction(()=>document.body.dataset.state==='listening');
 await page.keyboard.press('Control+a');
 const chordState=await page.locator('body').getAttribute('data-state');
 await page.getByRole('link',{name:'Instructions',exact:true}).focus();await page.keyboard.press('Space');
 const nativeSpace=await page.locator('body').getAttribute('data-state');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.body.dataset.state==='idle');
 console.log(JSON.stringify({welcome,closed,chordState,nativeSpace,requests},null,2));
 if(!closed||chordState!=='listening'||nativeSpace!=='listening'||welcome.length!==1||!welcome[0].startsWith('Welcome back.'))throw Error('hands-free keyboard regression');
}
