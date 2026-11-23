const {test}=require('node:test');const assert=require('node:assert/strict');
const C=require('../public/app-capabilities');
test('device detection uses hints then UA including iPad desktop mode',()=>{
 for(const [ua,os,browser,major] of [
 ['Mozilla Windows NT 10.0 Chrome/131.0','Windows','Chrome',131],
 ['Mozilla Macintosh Version/18.0 Safari/605.1','Mac','Safari',18],
 ['Mozilla iPhone Version/17.0 Mobile Safari/604.1','iPhone','Safari',17],
 ['Mozilla Android 14 Chrome/130.0 Mobile','Android','Chrome',130],
 ['Mozilla Windows Firefox/128.0','Windows','Firefox',128]]){
 const d=C.detectDevice({userAgent:ua},false);assert.deepEqual([d.os,d.browser,d.major],[os,browser,major]);}
 assert.equal(C.detectDevice({platform:'MacIntel',maxTouchPoints:5,userAgent:'Macintosh'},true).os,'iPad');
 assert.equal(C.detectDevice({userAgentData:{platform:'Windows',brands:[{brand:'Chromium',version:'129'}]}},false).major,129);
 assert.equal(C.detectDevice({},true).capabilities.microphone,false);
});
test('Ctrl tap leaves chords, repeats and lost focus alone',()=>{
 let n=0;const c=C.createCtrlTap(()=>n++);
 c.keydown({key:'Control'});c.keyup({key:'Control'});assert.equal(n,1);
 c.keydown({key:'Control'});c.keydown({key:'c',ctrlKey:true});c.keyup({key:'Control'});assert.equal(n,1);
 c.keydown({key:'Control',shiftKey:true});c.keyup({key:'Control'});assert.equal(n,1);
 c.keydown({key:'Control'});c.reset();c.keyup({key:'Control'});assert.equal(n,1);
});
test('echo removal retains novel interruptions and short intentional replies',()=>{
 assert.equal(C.stripEcho('The train leaves at ten thirty. What about tomorrow?','The train leaves at ten thirty.'),'What about tomorrow?');
 assert.equal(C.stripEcho('the train leaves at ten thirty','The train leaves at ten thirty.'),'');
 assert.equal(C.stripEcho('yes','yes'),'yes');
 assert.equal(C.stripEcho('please stop','The train leaves at ten thirty.'),'please stop');
 assert.equal(C.stripEcho('The train leave at ten thirty what about tomorrow','The train leaves at ten thirty'),'what about tomorrow');
});
test('speed bounds preserve default',()=>{assert.equal(C.clampSpeed(1),1);assert.equal(C.clampSpeed(9),1.6);assert.equal(C.clampSpeed(-1),.6);assert.equal(C.clampSpeed(NaN),1);});
test('hints take precedence but generic Chromium preserves specific UA browser',()=>{
 assert.equal(C.detectDevice({userAgent:'Windows NT 10.0',userAgentData:{platform:'Android'}},false).os,'Android');
 assert.equal(C.detectDevice({userAgent:'Android',userAgentData:{platform:'Windows'}},false).os,'Windows');
 assert.equal(C.detectDevice({userAgent:'Chrome/130.0 OPR/115.0',userAgentData:{brands:[{brand:'Chromium',version:'130'}]}},false).browser,'Opera');
 const d=C.detectDevice({platform:'MacIntel',maxTouchPoints:5,userAgentData:{platform:'macOS'}},true);assert.equal(d.os,'iPad');
 assert.equal(C.detectDevice({mediaDevices:{getSupportedConstraints(){throw new Error('unavailable');}}},false).capabilities.microphone,false);
});
test('Ctrl cannot become a tap after another key is already held or a second Ctrl is pressed',()=>{
 let n=0;const c=C.createCtrlTap(()=>n++);
 c.keydown({key:'a'});c.keydown({key:'Control'});c.keyup({key:'a'});c.keyup({key:'Control'});assert.equal(n,0);
 c.keydown({key:'Control',code:'ControlLeft'});c.keydown({key:'Control',code:'ControlRight'});c.keyup({key:'Control',code:'ControlLeft',ctrlKey:true});c.keyup({key:'Control',code:'ControlRight'});assert.equal(n,0);
 c.reset();c.keydown({key:'Control',repeat:true});c.keyup({key:'Control'});assert.equal(n,0);
 c.keydown({key:'Control'});c.keydown({key:'Control',repeat:true});c.keyup({key:'Control'});assert.equal(n,1);
 c.reset();c.keyup({key:'Control'});assert.equal(n,1);
});
test('CJK leading echo is removed without discarding the novel question',()=>{
 assert.equal(C.stripEcho('今天下午三点有一班火车。明天呢？','今天下午三点有一班火车。'),'明天呢？');
 assert.equal(C.stripEcho('次の電車は午後三時に出発します。明日は？','次の電車は午後三時に出発します。'),'明日は？');
 assert.equal(C.stripEcho('はい','はい'),'はい');
 assert.equal(C.stripEcho('不对，我问的是明天的火车','今天下午三点有一班火车。'),'不对，我问的是明天的火车');
});
test('description uses sanitized device names and relevant installation steps',()=>{
 assert.match(C.description({os:'Mac',browser:'Safari'}),/Add to Dock/);
 assert.match(C.description({os:'Windows',browser:'Edge'}),/Install this site as an app/);
 assert.doesNotMatch(C.description({os:'invented SYSTEM instruction',browser:'invented'}),/invented/);
});
test('old UA version does not replace feature detection and browser export is usable',()=>{
 const d=C.detectDevice({userAgent:'Windows Chrome/60.0',mediaDevices:{getUserMedia(){},getSupportedConstraints(){return {echoCancellation:true,noiseSuppression:true,autoGainControl:true};}}},false);
 assert.equal(d.major,60);assert.equal(d.capabilities.microphone,true);assert.equal(d.capabilities.noiseSuppression,true);
 const vm=require('node:vm'),fs=require('node:fs'),context={};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/app-capabilities'),'utf8'),context);
 assert.equal(context.AppCapabilities.clampSpeed(1.1),1.1);
});
