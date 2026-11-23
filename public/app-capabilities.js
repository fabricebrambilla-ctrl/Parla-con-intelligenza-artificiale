/* Shared, maintained description and pure controls. No identifiers or storage. */
(function(root){
 'use strict';
 function detectDevice(n,coarse){
  n=n||{};var ua=n.userAgent||'',data=n.userAgentData||{},os='Unknown',browser='Unknown',major=null;
  function platform(p){if(/iPad/.test(p))return 'iPad';if(/iPhone|iPod/.test(p))return 'iPhone';if(/Android/.test(p))return 'Android';if(/Win/.test(p))return 'Windows';if(/Mac/.test(p))return 'Mac';if(/Linux/.test(p))return 'Linux';return 'Unknown';}
  os=platform(data.platform||'');
  if(os==='Unknown')os=platform(ua);
  if(os==='Unknown')os=platform(n.platform||'');
  if(os==='Mac'&&n.maxTouchPoints>1)os='iPad';
  var brands=Array.isArray(data.brands)?data.brands:[];
  ['Microsoft Edge','Google Chrome'].some(function(b){var x=brands.find(function(v){return v&&v.brand===b;});if(!x)return false;browser=b==='Microsoft Edge'?'Edge':'Chrome';major=parseInt(x.version,10)||null;return true;});
  if(browser==='Unknown'){
   var patterns=[['Edge',/Edg(?:A|iOS)?\/(\d+)/],['Opera',/OPR\/(\d+)/],['Samsung Internet',/SamsungBrowser\/(\d+)/],['Firefox',/(?:Firefox|FxiOS)\/(\d+)/],['Chrome',/(?:Chrome|CriOS)\/(\d+)/],['Safari',/Version\/(\d+).*Safari/]];
   patterns.some(function(x){var m=ua.match(x[1]);if(!m)return false;browser=x[0];major=Number(m[1]);return true;});
   if(browser==='Unknown'){var chromium=brands.find(function(v){return v&&v.brand==='Chromium';});if(chromium){browser='Chrome';major=parseInt(chromium.version,10)||null;}}
  }
  var md=n.mediaDevices||{},supported={};
  try{if(typeof md.getSupportedConstraints==='function')supported=md.getSupportedConstraints()||{};}catch(_){}
  return {os:os,browser:browser,major:major,mobile:/iPhone|iPad|Android/.test(os)||(os==='Unknown'&&!!coarse),capabilities:{microphone:typeof md.getUserMedia==='function',enumerateDevices:typeof md.enumerateDevices==='function',serviceWorker:!!n.serviceWorker,echoCancellation:!!supported.echoCancellation,noiseSuppression:!!supported.noiseSuppression,autoGainControl:!!supported.autoGainControl}};
 }
 function clampSpeed(v){return Number.isFinite(v)?Math.round(Math.min(1.6,Math.max(.6,v))*10)/10:1;}
 function createCtrlTap(callback){var armed=false,held=new Set();return {
  keydown:function(e){var id=e.code||e.key;if(e.repeat)return;if(e.key==='Control')armed=held.size===0&&!e.altKey&&!e.shiftKey&&!e.metaKey;else armed=false;held.add(id);},
  keyup:function(e){held.delete(e.code||e.key);if(e.key==='Control'){var fire=armed&&held.size===0&&!e.ctrlKey&&!e.altKey&&!e.shiftKey&&!e.metaKey;armed=false;if(fire)callback();}},
  reset:function(){armed=false;held.clear();}
 };}
 function tokens(s){return Array.from(String(s||'').matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+/gu)).flatMap(function(m){
  // Split CJK runs even when a preceding Latin token consumed them.
  return Array.from(m[0].matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu)).map(function(t){return {word:t[0].toLowerCase(),end:m.index+t.index+t[0].length};});
 });}
 function similar(a,b){if(a===b)return true;if(Math.min(a.length,b.length)<4||Math.abs(a.length-b.length)>1)return false;var i=0,j=0,errors=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++errors>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return true;}
 function stripEcho(text,spoken){
  var a=tokens(text),b=tokens(spoken),best=0,min=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(String(text))?8:5;if(a.length<min||b.length<min)return text;
  // Only trim a sufficiently long leading echo. Never remove isolated words or novel suffixes.
  for(var start=0;start<=b.length-min;start++){var k=0,exact=0;while(k<a.length&&start+k<b.length&&similar(a[k].word,b[start+k].word)){if(a[k].word===b[start+k].word)exact++;k++;}if(k>=min&&exact/k>=.8)best=Math.max(best,k);}
  return best?String(text).slice(a[best-1].end).replace(/^[\s.,!?;:，。！？]+/u,''):text;
 }
 var commands=['choose_language','show_last_answer','change_microphone','list_microphones','speed_up','slow_down','pause','resume','read_footer','repeat_instructions','install_app','read_privacy','read_terms','read_about','read_accessibility','read_instructions'];
 function description(d){d=d||{};var os=['Windows','Mac','iPhone','iPad','Android','Linux'].includes(d.os)?d.os:'Unknown';var browser=['Chrome','Edge','Firefox','Safari','Opera','Samsung Internet'].includes(d.browser)?d.browser:'Unknown';var install=/iPhone|iPad/.test(os)?'In Safari use Share, Add to Home Screen, then Add.':os==='Mac'&&browser==='Safari'?'In Safari use File, Add to Dock, then Add if available (requires macOS Sonoma or later).':browser==='Edge'?'In Edge open the menu, Apps, Install this site as an app, if available.':browser==='Chrome'?'In Chrome use the available Install button or browser menu Install app/Add to Home screen; desktop Chrome may place installation under Cast, save, and share.':'If your browser offers installation, use its install option. Otherwise open the site in Safari on Apple mobile devices or Chrome/Edge on desktop; you can also bookmark it.';return 'Talk with AI: after Start and browser permission, listen continuously. Speak to interrupt. A lone Ctrl tap or main button pauses speech and closes the microphone; press again to resume. Voice resume cannot work while the microphone is closed. Screen readers may intercept Ctrl. Ask to repeat instructions, talk faster/slower (0.6 to 1.6, session only), change language, list microphones, change microphone, show the last answer, hide the last answer, or read the website pages. Say goodbye or press Escape to end the session. Device for this request: '+os+'; browser: '+browser+(Number.isInteger(d.major)&&d.major>0&&d.major<1000?' '+d.major:'')+'. Never claim to control other apps, see the screen, send emails or create downloadable files. Installation: '+install+' Installation may require a physical tap; voice alone cannot grant browser permissions. Offline mode shows connection advice, not AI answers. Use page_command to perform supported controls; named microphone selection is handled by the page.';}
 var api={detectDevice:detectDevice,clampSpeed:clampSpeed,stripEcho:stripEcho,createCtrlTap:createCtrlTap,description:description,commands:commands};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.AppCapabilities=api;
})(this);
