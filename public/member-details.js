'use strict';
const MemberDetails = (() => {
  const symbols = [
    [/@|at sign|at|arobase|chiocciola|arroba|apenstaartje|собака|кльомба/gu,'@'],
    [/dot|point|punto|ponto|punt|точка/gu,'.'],
    [/underscore|tiret bas|trattino basso|sublinhado|onderstrepingsteken|нижнее подчёркивание|долна черта/gu,'_'],
    [/dash|hyphen|tiret|trattino|hífen|koppelteken|дефис|тире/gu,'-']
  ];
  const emailFormat=/^(?!\.)(?!.*\.\.)[a-z0-9_%+.-]+(?<!\.)@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i;
  function email(raw) {
    let s=String(raw).normalize('NFKC').trim();
    if(s.length<=254 && emailFormat.test(s))return s;
    for(const [pattern,symbol] of symbols) s=s.replace(new RegExp('(?<![\\p{L}\\p{N}])(?:'+pattern.source+')(?![\\p{L}\\p{N}])','giu'),symbol);
    s=s.replace(/アットマーク|艾特符号|艾特/gu,'@').replace(/ドット|点/gu,'.').replace(/アンダースコア|下划线/gu,'_').replace(/ハイフン|连字符/gu,'-').replace(/\s+/gu,'');
    return s.length<=254 && emailFormat.test(s)?s:null;
  }
  const rows=['zero one two three four five six seven eight nine','zéro un deux trois quatre cinq six sept huit neuf','zero uno due tre quattro cinque sei sette otto nove','zero um dois três quatro cinco seis sete oito nove','nul een twee drie vier vijf zes zeven acht negen','ноль один два три четыре пять шесть семь восемь девять','нула едно две три четири пет шест седем осем девет','ゼロ いち に さん よん ご ろく なな はち きゅう'];
  function phone(raw) {
    let s=String(raw).normalize('NFKC').trim().toLowerCase().replace(/^(plus|mais|più|плюс|プラス|加)/u,'+');
    for(const row of rows) row.split(' ').forEach((word,n)=>{s=s.replace(new RegExp('(?<!\\p{L})'+word+'(?!\\p{L})','gu'),String(n));});
    s=s.replace(/[零〇一二两三四五六七八九]/gu,c=>String('零一二三四五六七八九'.indexOf(c==='〇'?'零':c==='两'?'二':c))).replace(/[ ().-]/g,'');
    return /^\+?\d{7,15}$/.test(s)?s:null;
  }
  function forget(storage,org){storage.removeItem('org:'+org+':profile');}
  return {email,phone,forget};
})();
if(typeof module!=='undefined') module.exports=MemberDetails;
