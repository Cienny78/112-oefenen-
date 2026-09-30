
(function(){
const T=TEKST;
/* =====================================================================
   LOCATIES — hier kun je later adressen toevoegen of aanpassen.
   naam:      wat de student in de lijst ziet
   adres:     het volledige adres (staat op het toetsenscherm)
   herken:    woorden waarop de meldkamer het adres goedkeurt (kleine letters)
   bevestig:  wat de meldkamer terugzegt als het adres goed is
   Laat 'naam' leeg ('') voor een plek die nog niet in gebruik is.
   ===================================================================== */
let SC = SCENARIOS[0];
// GPS en aanrijtijden zijn gesimuleerd; de app haalt geen echte GPS-gegevens op.
const $ = id => document.getElementById(id);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;
let voice=null;
const vkey=v=>v.voiceURI||v.name;
// hoe de stem woorden moet uitspreken: 112 als losse cijfers, AED als losse letters (aa-ee-dee)
// Elke stem spreekt afkortingen anders uit; kies op het eerste scherm wat het natuurlijkst klinkt.
let aedUitspraak=AED_STANDAARD;
try{ aedUitspraak=localStorage.getItem('aedUitspraak2')||aedUitspraak; }catch(e){}
function speakable(t){
  return t.replace(/\b112\b/g,'één één twee')
          .replace(/\bAED'?s\b/g, aedUitspraak+"'s")
          .replace(/\bAED\b/g, aedUitspraak);
}
function voiceQuality(v){
  const n=((v.name||'')+' '+(v.voiceURI||'')).toLowerCase();
  if(/premium/.test(n)) return 'Premium';
  if(/enhanced|verbeterd|uitgebreid/.test(n)) return 'Verbeterd';
  if(/natural|neural|online/.test(n)) return 'Natuurlijk';
  if(/compact/.test(n)) return 'Standaard';
  return '';
}
function voiceScore(v){
  const n=((v.name||'')+' '+(v.voiceURI||'')).toLowerCase(); let sc=0;
  if(v.lang==='nl-NL'||v.lang==='nl_NL') sc+=10; else if((v.lang||'').toLowerCase().startsWith('nl')) sc+=5; else return -1;
  if(/premium/.test(n)) sc+=9; if(/enhanced|verbeterd|uitgebreid/.test(n)) sc+=7;
  if(/natural|neural|online/.test(n)) sc+=7; if(/google/.test(n)) sc+=3;
  if(/claire|xander|fenna|maarten|colette|ellen/.test(n)) sc+=2;
  if(/compact/.test(n)) sc-=3;
  if(/eloquence|grandma|grandpa|\boma\b|\bopa\b|rocko|shelley|\bflo\b|\breed\b|sandy|eddy/.test(n)) sc-=6;
  return sc;
}
function listAllVoices(){
  const ol=document.getElementById('voiceAll'); if(!ol||!synth) return;
  const vs=synth.getVoices(); ol.innerHTML='';
  if(!vs.length){ const li=document.createElement('li'); li.textContent='Safari geeft (nog) geen stemmen door.'; ol.appendChild(li); return; }
  vs.slice().sort((a,b)=>(voiceScore(b)>=0)-(voiceScore(a)>=0) || (a.lang||'').localeCompare(b.lang||'')).forEach(v=>{
    const li=document.createElement('li'); const q=voiceQuality(v);
    li.textContent=v.name+'  ['+(v.lang||'?')+']'+(q?'  '+q:'')+(voiceScore(v)>=0?'  ✓ bruikbaar':'');
    if(voiceScore(v)>=0) li.style.fontWeight='600';
    ol.appendChild(li);
  });
}
function nlVoices(){ return synth ? synth.getVoices().filter(v=>voiceScore(v)>=0).sort((a,b)=>voiceScore(b)-voiceScore(a)) : []; }
let voice112=null;
function pickVoice(){
  if(!synth) return; const vs=nlVoices(); let s112=null, sAmb=null;
  try{ s112=localStorage.getItem('stem112'); sAmb=localStorage.getItem('stemAmb')||localStorage.getItem('meldkamerStem'); }catch(e){}
  const pick=k=>vs.find(v=>vkey(v)===k||v.name===k);
  voice = pick(sAmb) || vs[0] || null;
  voice112 = pick(s112) || vs.find(v=>!voice || v.name!==voice.name) || voice;
  [['voiceSel112',voice112],['voiceSelAmb',voice]].forEach(([id,cur])=>{
    const sel=document.getElementById(id); if(!sel) return; sel.innerHTML='';
    vs.forEach(v=>{ const o=document.createElement('option'); o.value=vkey(v); const q=voiceQuality(v); o.textContent=v.name.replace(/\s*\(.*?\)\s*/g,' ').trim()+(q?' ('+q+')':'')+((v.lang||'').toLowerCase().includes('be')?', Vlaams':''); if(cur&&vkey(v)===vkey(cur)) o.selected=true; sel.appendChild(o); });
    listAllVoices();
    const cnt=document.getElementById('voiceCount'); if(cnt && Date.now()>(window.voiceMsgUntil||0)) cnt.textContent=vs.length+' Nederlandse stem'+(vs.length===1?'':'men')+' gevonden.';
    if(!vs.length){ const o=document.createElement('option'); o.textContent='Geen Nederlandse stem gevonden'; sel.appendChild(o); }
  });
}
// dezelfde stem voor beide? Dan klinkt de centralist iets lager, zodat je het verschil hoort
function roleVoice(role){
  const v = role==='112' ? voice112 : voice;
  const same = voice112 && voice && vkey(voice112)===vkey(voice);
  return { v, pitch: same ? (role==='112' ? 0.8 : 1.12) : 1 };
}
if(synth){ [0,400,1500,4000].forEach(t=>setTimeout(pickVoice,t)); synth.onvoiceschanged=pickVoice; }
$('supportNote').textContent = SR
  ? T.zin001
  : T.zin002;

/* ---------------- state ---------------- */
let S;
function reset(){
  S={ phase:'idle', t0:0, micOk:!!SR, speaking:false, busy:false, rec:null,
      heardNumbers:false, sawTen:false, lastSpeech:0, openStart:0, counted:false,
      slots:{address:null, unresp:false, noBreath:false, cpr:false}, vol:{address:false,unresp:false,noBreath:false,cpr:false},
      pendingQ:null, asked:new Set(), reprompts:0, retries:{}, wrongBreath:false, wrongUnresp:false,
      tHelp:null, speaker:false, tSpeaker:null, tDial:0, cprBefore:false, aed:false, stoppedEarly:false, timers:[], beatId:null, wake:null };
}
reset();
const now=()=>performance.now();
const elapsed=()=>(now()-S.t0)/1000;
const fmt=s=>{ s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
const later=(fn,ms)=>{ const id=setTimeout(fn,ms); S.timers.push(id); return id; };

/* ---------------- ui ---------------- */
function setInd(mode, txt){ const el=$('listenInd'); el.className='pill'+(mode?' '+mode:''); $('listenTxt').textContent=txt; }
let transcript=[];
function addMsg(kind, text){
  transcript.push([kind,text]);
  if(kind==='disp'){ $('capDisp').textContent=text; $('capMe').textContent=''; }
  else if(kind==='me'||kind==='count'){ $('capMe').textContent='Jij: '+text; }
}
function note(t){ addMsg('note', t); }

/* ---------------- audio ---------------- */
let actx=null, master=null;
const EAR=0.35, SPK=1; // zonder luidspreker klinkt alles zacht, zoals aan je oor
function out(){ if(!master){ master=actx.createGain(); master.gain.value=1; master.connect(actx.destination); } return master; }
function setVolume(v){ if(actx) out().gain.setTargetAtTime(v, actx.currentTime, 0.03); }
function beep(freq,dur,vol){ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain();
  o.frequency.value=freq; g.gain.value=vol; o.connect(g); g.connect(out()); o.start(); o.stop(actx.currentTime+dur); }
function setSpeaker(on){
  S.speaker=on; $('spkBtn').setAttribute('aria-pressed', on?'true':'false');
  setVolume(on?SPK:EAR);
  if(on && S.tSpeaker===null && S.t0) S.tSpeaker=(now()-S.tDial)/1000;
}
function startMetronome(){
  if(S.beatId) return;
  $('cprPill').classList.remove('hidden');
  S.beatId=setInterval(()=>{ const h=$('cprDot'); h.classList.add('beat'); setTimeout(()=>h.classList.remove('beat'),110); }, 60000/110);
}
function stopMetronome(){ clearInterval(S.beatId); S.beatId=null; }

/* ---------------- speech out ---------------- */
function say(text, then){
  const zij=S.pron==='zij';
  text=text.replace(/\{door\}/g, S.aed ? 'Volg de instructies van de AED.' : 'Blijf doordrukken.');
  text=text.replace(/\{hij\}/g,zij?'zij':'hij').replace(/\{hem\}/g,zij?'haar':'hem').replace(/\{zijn\}/g,zij?'haar':'zijn');
  addMsg('disp', text);
  stopRec(); S.speaking=true; setInd('talk','Meldkamer spreekt…');
  // elke zin krijgt een eigen nummer, zodat een oude zin nooit nog een keer het vervolg start
  const id=S.sayId=(S.sayId||0)+1;
  let fired=false;
  const done=()=>{ if(fired || S.sayId!==id) return; fired=true; S.speaking=false; if(S.phase!=='done' && then) then(); };
  if(!synth){ setTimeout(done,500); return; }
  synth.cancel();
  const u=new SpeechSynthesisUtterance(speakable(text)); u.lang='nl-NL'; const rv=roleVoice(S.role||'112'); if(rv.v) u.voice=rv.v; u.pitch=rv.pitch; u.rate=1.08; u.volume=S.speaker?1:0.25;
  u.onend=done; u.onerror=done; later(done, 1800+text.length*85);
  synth.speak(u);
}

/* ---------------- speech in ---------------- */
const NUMTOK=/^(een|één|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|elf|twaalf|\S*tien|\S*twintig|dertig|\d+|en|eh|uh|ehm|hm)$/;
const tokens=t=>t.toLowerCase().replace(/[.,!?;:-]/g,' ').split(/\s+/).filter(Boolean);
const isCountOnly=t=>{ const k=tokens(t); return k.length>0 && k.every(w=>NUMTOK.test(w)); };
const hasNumber=t=>tokens(t).some(w=>w!=='en' && NUMTOK.test(w));

function canListen(){ return SR && S.micOk && !S.speaking && (S.phase==='opening'||S.phase==='questions'||S.phase==='cpr'); }
function startRec(){
  if(!canListen() || S.rec) return;
  let r;
  try{ r=new SR(); }catch(e){ return; }
  S.rec=r; r.lang='nl-NL'; r.continuous=true; r.interimResults=true; r.maxAlternatives=3;
  r.onresult=e=>{
    for(let i=e.resultIndex;i<e.results.length;i++){
      const res=e.results[i]; const txt=res[0].transcript;
      S.lastSpeech=now();
      if(!isCountOnly(txt)){ S.lastTalk=now(); if(S.bufT){ clearTimeout(S.bufT); S.bufT=setTimeout(flushBuf, 600); } }
      if(S.phase==='opening' && hasNumber(txt)){ S.heardNumbers=true; if(/\btien\b|\b10\b/.test(txt.toLowerCase())) S.sawTen=true; }
      if(res.isFinal){ const alts=[]; for(let j=0;j<res.length;j++) alts.push(res[j].transcript); onFinal(alts); }
    }
  };
  r.onerror=e=>{ if(['not-allowed','service-not-allowed','audio-capture','network'].includes(e.error)) micFailed(e.error); };
  r.onend=()=>{ if(S.rec===r) S.rec=null; if(canListen()) setTimeout(startRec,150); };
  try{ r.start(); }catch(e){ S.rec=null; return; }
  setInd('on', S.phase==='opening' ? 'Meldkamer luistert mee' : S.phase==='cpr' ? 'Meldkamer luistert, blijf drukken' : 'Spreek maar');
}
function stopRec(){ const r=S.rec; S.rec=null; if(r){ r.onend=null; try{ r.abort(); }catch(e){} } }
const MIC_MSG={
  'none':T.zin003,
  'not-allowed':T.zin004,
  'service-not-allowed':T.zin005,
  'audio-capture':'Er is geen microfoon gevonden.',
  'network':T.zin006
};
function micFailed(reason){
  S.micOk=false; stopRec();
  const msg=MIC_MSG[reason]||MIC_MSG['not-allowed'];
  setInd('off', msg+' Tik om opnieuw te proberen.');
}
$('listenInd').onclick=()=>{ if(S.micOk || !SR) return; S.micOk=true; $('capMe').textContent=''; startRec(); };

/* ---------------- dialogue ---------------- */
// Gespreksboom: alle spontaan gemelde informatie blijft behouden.
const Q=VRAGEN;
function dispatch(){
 if(!S.dispatched && S.slots.address!==null && (S.slots.cpr || S.slots.unresp)){
  S.dispatched=true; S.tHelp=elapsed();
  return T.zin007;
 }
 return '';
}
function nextQ(){
 if(!S.incident) return 'incident';
 if(S.slots.address===null) return SC.gps?'gpsConfirm':'address';
 if(SC.drenkeling && !S.waterSafe) return 'waterSafety';
 if(!S.slots.cpr){if(!S.slots.unresp) return 'unresp'; if(!S.slots.noBreath) return 'breath';}
 if(S.knows===undefined) return 'know';
 return null;
}
function ask(q,prefix){
 if(q==='gpsConfirm'){S.pendingQ=q;S.reprompts=0;S.asked.add(q);return say([prefix,'Ik zie uw locatie bij '+(SC.gpsLabel||'het Haagse Bos in Den Haag')+T.zin008].filter(Boolean).join(' '),listenQ);}
 S.pendingQ=q; S.reprompts=0; if(q!=='opening') S.asked.add(q);
 if(q==='access' && SC.buiten){S.pendingQ=q;return say([prefix,T.zin009].filter(Boolean).join(' '),listenQ);}
 if(q==='know' && SC.drenkeling){return say([prefix,T.zin010].filter(Boolean).join(' '),listenQ);}
 if(q!=='opening') $('callTitle').textContent='Meldkamer '+(S.desk||'ambulance');
 say([prefix,Q[q].ask].filter(Boolean).join(' '),listenQ);
}
function listenQ(){ S.busy=false; startRec(); armSilence(); }
function armSilence(){
  const q=S.pendingQ;
  later(function check(){
    if(S.phase!=='questions' || S.pendingQ!==q) return;
    if(S.busy || S.speaking || now()-S.lastSpeech<4000){ later(check,3000); return; }
    if(S.reprompts>=1 || (q==='address'||q==='ambOpen') && S.slots.address) return;
    S.reprompts++; S.busy=true;
    say('Hallo, hoort u mij? '+Q[q].short, listenQ);
  }, 15000);
}

function extract(m, isOpening){
  const got=[];
 if(SC.drenkeling && /uit het water|op de (oever|kant)|op het (strand|droge)|veilig op de kant/.test(m) && !/niet uit|nog niet/.test(m)) S.waterSafe=true;
  if(/reanim|bewusteloos|reageert|adem|onwel|ingestort|drenkeling|verdronken|uit het water|ligt.{0,15}(grond|vloer)|in elkaar/.test(m)) S.incident=true;
  if(S.slots.address===null && addressComplete(m)){ S.slots.address=elapsed(); got.push('address'); }
  if(!S.slots.unresp && /reageert niet|reageerde niet|niet reageert|niet reageerde|nergens op reageert|niet aanspreekbaar|bewusteloos|geen reactie|reageert nergens|niet bij bewustzijn|buiten bewustzijn/.test(m)){ S.slots.unresp=true; got.push('unresp'); }
  if(!S.slots.noBreath && /(ademt|ademhaling)[^|]{0,15}\b(niet|geen)\b|\bniet\b[^|]{0,12}ademt|geen (normale )?ademhaling|happ?end|snurk|gasp|naar adem/.test(m)){ S.slots.noBreath=true; got.push('noBreath'); }
  if(!S.slots.cpr && /(ik|we|wij).{0,25}(reanimeer|aan het reanimeren|gestart met reanim|begonnen met reanim|geef.{0,10}borstcompress|druk.{0,10}borst)|reanimatie (is )?(gestart|begonnen)/.test(m) && !/niet.{0,15}reanim|hoe.{0,15}reanim|moet.{0,10}reanim/.test(m)){ S.slots.cpr=true; got.push('cpr'); startMetronome(); }
  if(!S.aed && /\baed\b|a e d|a\.e\.d|defibrillator|hartstarter/.test(m) && !/stuur|komt|onderweg|waar|haal|geen|niet|beschikbaar|hangt/.test(m)){ S.aed=true; S.aedEarly=true; S.aedState='present'; got.push('aed'); }
  if(!S.aed && S.aedState!=='fetching' && /(haal|haalt|halen|gehaald|ophalen|pakt|rent|weggestuurd|gestuurd).{0,45}(aed|a e d|defibrillator|hartstarter)|(aed|a e d|defibrillator|hartstarter).{0,25}(halen|gehaald|ophalen|onderweg)/.test(m)){ S.aedState='fetching'; got.push('aedFetch'); }
  if(S.knows===undefined && !/weet (ik )?niet|niet zeker|twijfel|niet hoe/.test(m) && /bhv|ehbo|cursus|geleerd|getraind|opgeleid|verpleegkundige|\barts\b|kan reanimeren|weet hoe|weet wat ik (doe|moet doen)/.test(m)){ S.knows=true; got.push('knows'); }
  if(updateHelpers(m)) got.push('helpers');
  if(!S.pron && /vrouw|mevrouw|meisje|dame|\bzij\b|\bze\b|\bhaar\b/.test(m)) S.pron='zij';
  if(!S.pron && /\bman\b|meneer|jongen|\bhij\b|\bhem\b/.test(m)) S.pron='hij';
  if(!S.what && /fiets|gevallen|viel|val |in elkaar|zakte|onwel|flauw|botsing|aangereden|sport|pijn op de borst|opeens|plotseling/.test(m)){ S.what=true; }
  if(isOpening) got.forEach(k=>S.vol[k]=true);
  return got;
}

const talking=()=>now()-(S.lastTalk||0) < 2500; // de student is net aan het praten (tellen telt niet mee)
// Wacht even na een zin: praat de student nog door, dan worden de stukjes samengevoegd.
function onFinal(alts){
  const first=alts[0].trim(); if(!first) return;
  if(S.phase==='questions' || S.phase==='cpr'){
    if(isCountOnly(first)){ if(S.phase==='questions') addMsg('count', first); return; }
    (S.bufFirst=S.bufFirst||[]).push(first); (S.bufAll=S.bufAll||[]).push(alts.join(' | '));
    clearTimeout(S.bufT); S.bufT=setTimeout(flushBuf, 600);
    return;
  }
  onFinalNow(alts);
}
function flushBuf(){
  S.bufT=null; if(!S.bufFirst||!S.bufFirst.length) return;
  const first=S.bufFirst.join(' '), all=S.bufAll.join(' | '); S.bufFirst=[]; S.bufAll=[];
  onFinalNow([first, all]);
}
function onFinalNow(alts){
  const first=alts[0].trim(); if(!first) return;
  const m=first.toLowerCase();
  if(S.phase==='opening'){
    if(isCountOnly(first)){ S.counted=true; addMsg('count', first); return; }
    // student begint zelf te praten: vraag overslaan en direct overnemen
    if(S.heardNumbers) S.counted=true;
    S.phase='questions'; S.busy=true; addMsg('me', first);
    return respond(m, 'opening');
  }
  if(S.phase==='questions'){
    if(S.busy || S.speaking) return;
    if(isCountOnly(first)){ addMsg('count', first); return; }
    S.busy=true; stopRec(); addMsg('me', first);
    return respond(m, S.pendingQ);
  }
  if(S.phase==='cpr'){
    if(S.speaking || isCountOnly(first)) return;
    handleCpr(first, m);
  }
}

function addressComplete(m){
 if(SC.gps) return false; // Eerst de gesimuleerde GPS-positie bij de beller controleren.
 const number=(SC.adres.match(/\d+/)||[])[0];
 const place=SC.adres.split(',').slice(1).join(',').trim().toLowerCase();
 const digits=number && new RegExp('\\b'+number+'\\b').test(m);
 const spoken=number==='75' && /vijf\s*en\s*zeventig|vijfenzeventig/.test(m);
 return SC.herken.some(w=>m.includes(w)) && (digits||spoken) && (!place||m.includes(place));
}
function connectDesk(desk){
 S.desk=desk; S.busy=true;
 say(T.zin011+desk+'.',()=>{
  setInd('talk','Doorverbinden…'); ring();
  later(()=>{
   if(S.phase!=='questions') return;
   S.role='amb'; $('callTitle').textContent='Meldkamer '+desk;
   if(desk!=='ambulance') return ask('incident','Meldkamer '+desk+'.');
   S.firstAmb=true;
   advance(['Meldkamer ambulance.',S.incident?'Ik begrijp uw melding.':'']);
  },1400);
 });
}
function service(m){
 extract(m,true);
 if(/ambulance|ziekenwagen/.test(m)){S.service='goed';return connectDesk('ambulance');}
 if(/brandweer|politie/.test(m)){S.service='omweg'; return connectDesk(/brandweer/.test(m)?'brandweer':'politie');}
 if(S.incident){S.service='omweg';return connectDesk('ambulance');}
 return ask('opening');
}
function advance(acks=[]){
 const send=dispatch(); if(send) acks.push(send);
 const next=nextQ();
 if(next) return ask(next,acks.filter(Boolean).join(' '));
 startCpr(acks.filter(Boolean));
}
function respond(m,q){
 if(q==='opening') return service(m);
 const got=extract(m,!!S.firstAmb); S.firstAmb=false;
 const acks=[];
 if(q==='gpsConfirm'){
  if(/\bnee\b|niet in|klopt niet|verkeerd/.test(m)) return ask('address',T.zin012);
  if(/\bja\b|bos|strand|scheveningen|zwembad|laakkade|klopt|weet (ik )?niet|geen idee|onbekend/.test(m)){
   S.slots.address=elapsed(); S.gpsConfirmed=true;
   acks.push('Ik geef de GPS-locatie bij '+(SC.gpsLabel||'het Haagse Bos in Den Haag')+T.zin013);
  }else return ask('gpsConfirm');
 }
 if(SC.drenkeling && /nog in het water|ligt in het water|niet uit het water/.test(m)) return ask('waterSafety','Breng uzelf niet in gevaar.');
 if(q==='waterSafety'){
  if(/\bnee\b|niet veilig|nog in/.test(m)) return say(T.zin014,listenQ);
  if(/\bja\b|uit het water|op de oever/.test(m)){S.waterSafe=true;acks.push('Goed dat de persoon uit het water is.');}
  else return ask('waterSafety');
 }
 if(S.desk && S.desk!=='ambulance'){
  if(S.incident) return connectDesk('ambulance');
  return ask('incident','Kunt u vertellen wat er aan de hand is?');
 }
 if(q==='know'){
  if(/twijfel|een beetje|niet zeker/.test(m)) return ask('clarify');
  if(/\bnee\b|weet (ik )?niet|geen idee|nooit|help|kan (het )?niet/.test(m)) S.knows=false;
  else if(/\bja\b|weet|kan|cursus|bhv/.test(m)) S.knows=true;
  else return ask('know','Ik heb uw antwoord niet goed verstaan.');
 }
 if(q==='clarify'){
  S.knows=false; acks.push('Ik geef u de stappen voor de reanimatie.');
 }
 if(q==='unresp' && !S.slots.unresp){
  if(/\bnee\b|geen reactie/.test(m)) S.slots.unresp=true;
  else if(/\bja\b|reageert wel/.test(m)) return ask('assessment');
 }
 if(q==='breath' && !S.slots.noBreath){
  if(/\bnee\b|hap|snurk|twijfel|weet (ik )?niet/.test(m)) S.slots.noBreath=true;
  else if(/\bja\b|normaal/.test(m)) return ask('assessment',T.zin015);
 }
 if(q==='assessment'){
  if(S.slots.cpr || /geen reactie|reageert niet/.test(m) && /niet normaal|geen adem|hap/.test(m)) return advance();
  return say(T.zin016,listenQ);
 }
 if(got.includes('address')) acks.push('Ik heb '+SC.adres+' genoteerd.');
 if(got.includes('cpr')) acks.push('Goed dat u bent begonnen.');
 if(got.includes('aedFetch')) acks.push(T.zin017);
 if(/verdieping|lokaal|ruimte|ingang|receptie/.test(m)) S.accessGiven=true;
 if(/geen (aed|a e d)|aed.{0,15}niet (beschikbaar|aanwezig|bereikbaar)/.test(m)) S.aedAbsent=true;
 if(q==='address' && SC.gps && /straat|weg|laan|plein|ingang|brug|pad/.test(m) && /\d|den haag/.test(m)){S.slots.address=elapsed();acks.push(T.zin018);}
 if(q==='address' && S.slots.address===null) acks.push(T.zin019);
 advance(acks);
}

/* ---------------- reanimatie ---------------- */
function siren(seconds){
  // Nederlandse twee-tonige sirene, begint heel zacht (ver weg) en wordt steeds harder
  if(!actx) return;
  const t0=actx.currentTime, o=actx.createOscillator(), f=actx.createBiquadFilter(), g=actx.createGain();
  o.type='triangle'; f.type='lowpass';
  f.frequency.setValueAtTime(700,t0); f.frequency.linearRampToValueAtTime(3500,t0+seconds);
  g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.45,t0+seconds*0.9);
  g.gain.linearRampToValueAtTime(0.0001,t0+seconds);
  for(let t=0;t<seconds;t+=1.3){ o.frequency.setValueAtTime(440,t0+t); o.frequency.setValueAtTime(587,t0+t+0.65); }
  o.connect(f); f.connect(g); g.connect(out()); o.start(t0); o.stop(t0+seconds);
}
const SIREN=28; // de sirene is 28 seconden hoorbaar en is op de aanrijtijd het hardst
function arriveSec(){
  const t=SC.ambulanceNa; if(!t) return AMBULANCE_NA_MINUTEN*60;
  const [mm,ss]=String(t).split(':').map(Number); return mm*60+(ss||0);
}
function ambulanceArrives(){
  if(S.phase!=='cpr' || S.handover) return;
  siren(SIREN);
  later(function t(){ if(S.phase!=='cpr' || S.handover) return; if(S.speaking||quiet()||talking()){ later(t,2500); return; } say(hasHelp() ? T.zin020 : T.zin021, startRec); }, 12000);
  later(function t(){ if(S.phase!=='cpr' || S.handover) return; if(S.speaking||quiet()||talking()){ later(t,2500); return; } say(T.zin022, startRec); }, (SIREN+10)*1000);
}
const CPR_MAX=MAX_MINUTEN*60; // veiligheidsgrens: na 12 minuten stopt de oefening vanzelf
/* ---- helpers: wie is er NU bij het slachtoffer (de beller niet meegeteld)? ----
   S.helpers = aantal aanwezige helpers (null = onbekend), S.away = helpers die weg zijn (bijv. AED halen) */
const hasHelp=()=>S.helpers>0;
function updateHelpers(m){
  let changed=false; const set=(h,a)=>{ if(h!==S.helpers||a!==S.away){ S.helpers=h; S.away=a; changed=true; } };
  const A=S.away||0; let counted=false;
  if(/met z.?n (drie|drieën)|met ons (drie|drieën)|(we|wij) (zijn|waren) met (drie|drieën)/.test(m)){ set(2, A); counted=true; }
  else if(/met z.?n twee|met ons twee|(we|wij) (zijn|waren) met (twee|tweeën)/.test(m)){ set(1, A); counted=true; }
  // helper gaat weg (AED halen, weglopen)
  if(/(collega|iemand|hij|zij|ze|die|één|een van|mijn (vriend|vriendin|man|vrouw)).{0,25}(haalt|gaat .{0,12}(halen|pakken|zoeken)|rent|loopt weg|is weg|weer weg|gaat weg)/.test(m)){
    const h=S.helpers==null?0:S.helpers; set(Math.max(0,h-1), (S.away||0)+1);
  }
  // helper terug of extra helper erbij
  if(/(is|zijn) (weer )?terug|komt terug/.test(m) || (!counted && /er is (nog )?iemand (bij|gekomen)|er komt iemand|(collega|bhv.?er|iemand) (is|komt) (erbij|hier|er)|nog een bhv|tweede (helper|bhv|hulpverlener)|iemand helpt|er is hulp|collega doet|collega is hier/.test(m))){
    const a=S.away||0, h=S.helpers==null?0:S.helpers; set(h+1, Math.max(0,a-1));
  }
  if(/ik ben (nu )?(weer )?alleen|alleen bij (hem|haar)|niemand (anders|bij)|er is niemand|niemand hier/.test(m)) set(0, S.away||0);
  return changed;
}
function helperReply(){
  if(hasHelp()) return T.zin023;
  if((S.away||0)>0) return T.zin024;
  return T.zin025;
}

const COACH=[
  [30,()=>T.zin026],
  [70,()=>T.zin027],
  [115,()=>hasHelp() ? T.zin028 : null],
];
for(let k=2;k<=5;k++){
  COACH.push([120*k-60, ()=> k%2 ? T.zin029 : 'Gaat het nog? Zeg het als u moe wordt.']);
  COACH.push([120*k, ()=> hasHelp() ? T.zin030 : null]);
}
const AEDW=T.zin031;
const CPR_REPLIES=[
  [/stop de oefening|einde oefening|oefening stoppen/, null, 'stop'],
  [/ambulance is (er|hier|binnen|gearriveerd|aangekomen)|ambulance staat|hulpverleners zijn er|ambulancepersoneel|ambulance neemt|ambulanceteam is/, T.zin032, 'handover'],
  [/aanrij|hoe lang (duurt|nog)|hoe ver|wanneer (is|zijn|komt|komen)|waar blijft de ambulance|hoelang/, T.zin033, 'aedok'],
  [/politie/, T.zin034, 'aedok'],
  [/brandweer/, T.zin035, 'aedok'],
  [/met z.?n (twee|drie)|met ons (twee|drie)|tweede|collega|nog iemand|iemand bij (me|mij|ons)|iemand helpt|er is hulp|bhv.?er (is|komt)|nog een bhv|alleen|terug|niemand/, ()=>helperReply(), 'aedok'],
  [/kan (niet|geen) beadem|wil niet beadem|niet beademen|zonder beadem/, T.zin036, 'aedok'],
  [/borst.{0,20}(niet omhoog|komt niet|gaat niet)/, T.zin037, 'aedok'],
  [/(weet niet hoe|hoe moet ik) .{0,10}beadem|beadem.{0,20}(hoe|uitleg)/, T.zin038, 'aedok'],
  [/beadem|mond op mond|blazen|lucht in|30.?2|dertig.{0,6}twee|pocket ?mask|masker/, T.zin039, 'aedok'],
  [/tel kwijt|kwijt met tellen|weet niet meer hoeveel/, T.zin040, 'aedok'],
  [/doe ik het goed|klopt het|is dit goed/, T.zin041],
  [/waar (moet ik )?drukken|welke plek|hoe (moet|doe) ik/, T.zin042],
  [/breken|kapot|pijn doen/, T.zin043, 'aedok'],
  [/mag ik stoppen|moet ik stoppen|kan ik stoppen|stoppen\?/, T.zin044, 'aedok'],
  [/overgeven|braakt|spuugt|kotst|braaksel/, T.zin045, 'aedok'],
  [/opvangen|wijzen|ingang|slagboom|receptie|lift|omstanders|mensen om|toeschouwers/, ()=> hasHelp() ? T.zin046 : T.zin047, 'aedok'],
  [/hoort u mij|hoor je mij|bent u (er )?nog|ben je er nog|hallo/, 'Ja, ik hoor u. Ik blijf aan de lijn.', 'aedok'],
  [/bloed/, T.zin048],
  [/pacemaker|bultje/, T.zin049, 'aedok'],
  [/zwanger/, T.zin050, 'aedok'],
  [/\bnat\b|regen|water|plas/, T.zin051, 'aedok'],
  [/borsthaar|behaard|haren/, T.zin052, 'aedok'],
  [/sieraden|ketting|piercing|\bbh\b|beugel/, T.zin053, 'aedok'],
  [/baby|kind|kindje|peuter/, T.zin054, 'aedok'],
  [/bedankt|dank je|dank u/, 'Graag gedaan. Ik blijf aan de lijn.', 'aedok'],
  [/overne|wissel|afloss|neemt het|nemen het/, ()=> hasHelp() ? T.zin055 : T.zin056, 'aedok'],
  [/moe|kan niet meer|zwaar|uitgeput/, ()=> hasHelp() ? T.zin057 : T.zin058, 'aedok'],
  [/hoe lang|wanneer|ambulance|komt er/, T.zin059, 'aedok'],
  [/hoe diep|hoe hard|hoe snel/, T.zin060],
  [/rib|kraak|knap/, T.zin061, 'aedok'],
  [/bang|eng|spannend|help/, T.zin062, 'aedok']
];
/* ---- AED: volgt stap voor stap waar de student is ----
   none -> gehaald -> er -> aansluiten -> analyse -> schok / geen schok -> weer drukken
   Tijdens aansluiten en analyse praat de meldkamer niet door de AED heen. */
const has=(re,m)=>new RegExp(re).test(m);
function quiet(){ return now() < (S.quietUntil||0); }
function aedHandler(m, first){
  const aedWord=has(AEDW,m);
  const st=S.aedState||'none';
  // zinnen van de student bevatten meestal 'we', 'ik', 'hij' enz.; de AED zelf geeft korte bevelen ('Plak de elektroden')
  const fromStudent=/\b(we|wij|ik|ze|zij|collega|hij|jullie|u|er)\b|wordt|worden|gaan|hebben|heeft|gegeven|gedaan|geweest|zegt/.test(m);
  const go=(state, reply, quietSec, always)=>{
    if(!fromStudent && !always) reply=null;
    const changed = st!==state;
    S.aedState=state;
    if(['present','connecting','analysing','resumed'].includes(state) && !S.aed){ S.aed=true; S.tAed=(now()-S.cprStart)/1000; }
    if(quietSec) S.quietUntil=now()+quietSec*1000;
    if(!changed || !reply) return true;            // zelfde stap nog eens gehoord (of de AED zelf): niets zeggen
    addMsg('me', first); say(typeof reply==='function'?reply():reply, startRec); return true;
  };
  // tekenen van leven
  if(/ademt (weer|normaal)|is wakker|wordt wakker|komt bij|praat/.test(m) && !/niet/.test(m))
    return go('rosc',T.zin063, 0, true);
  if(/beweegt|bewoog|ogen open|hoest|kreunt|trekt/.test(m) && !/niet/.test(m)){
    addMsg('me', first); say(T.zin064, startRec); return true;
  }
  // analyse
  if(/schok (geadviseerd|aanbevolen)/.test(m) && !/geen schok/.test(m))
    return go('analysing',T.zin065, 15);
  if(/ritme|analys|hartritme|niet aanraken|niemand aanraken|handen (los|eraf|weg)|iedereen los|los van|we stoppen even|laadt op|opladen/.test(m) && !/geen schok/.test(m))
    return go('analysing',T.zin066, 18);
  // schok gegeven of geen schok
  if(/geen schok/.test(m)) return go('resumed',T.zin067, 3, !/geadviseerd|aanbevolen/.test(m));
  if(/(schok|shock).{0,20}(gegeven|toegediend|gedaan|geweest)|(gegeven|gedaan).{0,10}(schok|shock)|geschokt/.test(m))
    return go('resumed',T.zin068, 3);
  // AED zegt door te gaan / weer verder
  if(/(aed|hij) zegt.{0,20}(door|verder|drukken|reanim)|we (gaan )?(weer )?(verder|door)|hervat|weer (aan het )?drukken|begin(nen)? weer|weer gestart/.test(m) && st!=='none' && st!=='fetching')
    return go('resumed',T.zin069);
  // aansluiten / plakken
  if(/aansluit|sluit(en)?.{0,20}\baan\b|aangesloten|plak|geplakt|elektrode|pads|plakker|zet (hem|de aed) aan|aangezet|staat aan|aan het aanzetten|bloot|ontbloot|shirt (open|uit)|knip/.test(m) && (aedWord || st!=='none'))
    return go('connecting', ()=> hasHelp()
      ? T.zin070
      : T.zin071, 25);
  // alleen, maar AED vlakbij
  if(aedWord && !hasHelp() && /minuut|vlakbij|om de hoek|hangt (hier|in de gang|naast)|in de gang|op de gang/.test(m) && st==='none'){
    S.aedState='fetching'; addMsg('me', first);
    say(T.zin072, startRec); return true;
  }
  if(!aedWord) return false;
  // vragen over de AED (zolang die er nog niet is)
  if(!S.aed && /waar blijft|komt (er )?(de |een )?(aed|a e d)|(aed|a e d).{0,10}(onderweg|komen)|hebben jullie|stuurt u|stuur je/.test(m)){
    addMsg('me', first);
    say(st==='fetching' ? T.zin073
      : S.noAed ? T.zin074
      : T.zin075, startRec);
    return true;
  }
  // wordt gehaald
  if(/haal|gehaald|ophalen|rent|gaat .{0,12}(halen|pakken)|pakt|onderweg/.test(m) && !has(AEDW+'.{0,15}(is|zijn) (er|terug|hier)|terug met',m))
    return go('fetching', ()=> (S.away||0)>0 && !hasHelp()
        ? T.zin076
        : hasHelp() ? T.zin077
        : (S.cprQ='who', later(()=>{ if(S.cprQ==='who') S.cprQ=null; }, 20000), T.zin078), 0, true);
  // is er (dat zegt de AED nooit zelf)
  if(has(AEDW+T.zin079+AEDW+'|(hebben|we hebben) (een|de) '+AEDW,m) || ((st==='fetching'||st==='asked') && /^(ja[, ]*)?(hij|die|de aed) is (er|hier)$/.test(m.trim())))
    return go('present', ()=> hasHelp()
        ? T.zin080
        : T.zin081, 15, true);
  return false;
}
function startCpr(acks){
  S.phase='cpr-intro'; S.cprBefore=S.slots.cpr;
  startMetronome();
  let how;
  if(S.slots.cpr && S.knows!==false) how=T.zin082;
  else if(S.knows) how='Goed. Begint u maar, ik blijf aan de lijn.';
  else how=T.zin083;
  const send=dispatch();
  if(SC.drenkeling && S.knows===false) how=T.zin084;
 const spk = S.speaker ? [] : [T.zin085];
  const two = hasHelp() ? [T.zin086] : (S.away>0 ? [T.zin087] : []);
  const askAed = !S.aed && S.aedState!=='fetching';
  const tail = askAed ? T.zin088 : 'Ik blijf aan de lijn.';
  if(askAed) S.cprQ='aedq';
  let parts=[...acks, send, ...spk, how, ...two, tail];
  say(parts.filter(Boolean).join(' '), ()=>{
    S.phase='cpr'; S.cprStart=now();
    later(()=>{ if(S.cprQ==='aedq') S.cprQ=null; }, 20000);
    COACH.forEach(([sec,f])=>later(function c(){ if(S.phase!=='cpr' || S.aed || S.cprQ || quiet()) return; if(S.speaking||talking()){ later(c,2500); return; } const t=(sec===30 && S.knows)?null:f(); if(t && (!SC.kort || /wissel/i.test(t))) say(t, startRec); }, sec*1000));
    later(()=>finish(false), CPR_MAX*1000);
    later(ambulanceArrives, Math.max(5, arriveSec() - SIREN - elapsed())*1000);
    if(!SC.kort){
      askDuring(20, 'access', SC.buiten?T.zin009:T.zin089, ()=>!S.accessGiven);
      askDuring(45, 'reception', SC.buiten?T.zin090:T.zin091, ()=>hasHelp() && !S.receptionGiven);
      askDuring(VRAAG_WAT_NA_SECONDEN, 'what', 'Weet u wat er gebeurd is?', ()=>!S.what);
    }
    if(S.askAge) askDuring(150, 'age', 'Hoe oud is {hij} ongeveer?');
    startRec();
  });
}
function askDuring(sec, key, text, cond){
  later(function tryAsk(){
    if(S.phase!=='cpr' || S.handover || (cond && !cond())) return;
    if(S.speaking || S.cprQ || quiet() || talking()){ later(tryAsk, 3000); return; }
    S.cprQ=key; say(text, startRec);
    later(()=>{ if(S.cprQ===key) S.cprQ=null; }, 20000); // geen antwoord: vraag laten vallen
  }, sec*1000);
}
function handleDialogue(first,m){
 if(quiet()) return false;
 const speak=(text,key)=>{addMsg('me',first); S.cprQ=key||null; say(text,startRec);return true;};
 if(/ambulance is (er|hier|binnen|aangekomen)|hulpverleners zijn er/.test(m) && !/neem|over/.test(m))
  return speak(T.zin092);
 if(/(ambulance|ambulanceteam|hulpverleners).{0,30}(nemen|neemt|overgenomen)|ze nemen het (nu )?over/.test(m)){
  S.handover=true; addMsg('me',first); say(T.zin093,()=>finish(true));return true;
 }
 if(SC.drenkeling && /kan (niet|geen) beadem|niet beademen/.test(m)) {return speak(T.zin094,'drowningBreaths');}
 if(S.cprQ==='drowningBreaths') return speak(T.zin095);
 if(/komt er hulp|komt er wel hulp|is er hulp onderweg|hoelang|hoe lang.*(nog|duurt)|waar blijft de ambulance/.test(m))
  return speak(T.zin096,S.cprQ);
 if(/(haal|haalt|halen|weggestuurd|gestuurd).{0,50}(aed|a e d)|(aed|a e d).{0,25}(halen|onderweg)/.test(m) && !/geen|niemand|kan niet|niet halen|waar blijft|komt.*aed/.test(m)){
  S.aedState='fetching'; S.aedAbsent=false; updateHelpers(m);
  return speak(T.zin097);
 }
 if(!S.aed && /geen (aed|a e d)|aed.{0,15}niet (hier|aanwezig|beschikbaar|bereikbaar)/.test(m)){
  S.aedAbsent=true;return speak(T.zin098,'sendAed');
 }
 if(S.cprQ==='sendAed'){
  if(/\bja\b|collega|kan gaan/.test(m)){S.aedState='fetching';return speak(T.zin099);}
  if(/\bnee\b|niemand|alleen|niet mogelijk/.test(m)) return speak('Bent u alleen bij de persoon?','aloneAed');
  return speak('Kan iemand anders een AED halen?','sendAed');
 }
 if(S.cprQ==='aloneAed'){
  if(/\bja\b|alleen|niemand/.test(m)){S.helpers=0;return speak(T.zin100,'nearAed');}
  if(/\bnee\b|collega|iemand/.test(m)){S.helpers=Math.max(1,S.helpers||0);return speak(T.zin101,'sendAed');}
  return speak(T.zin102,'aloneAed');
 }
 if(S.cprQ==='nearAed'){
  if(/\bja\b|binnen.{0,10}minuut|vlakbij/.test(m) && !/niet|geen|\bnee\b/.test(m)){S.aedState='fetching';return speak(T.zin103);}
  return speak(T.zin104);
 }
 const question=/\?|^(hoe|waar|wat|wanneer|kan|mag|moet|komt|bent)\b/.test(m);
 if(question){const hit=CPR_REPLIES.find(([re,,kind])=>kind!=='handover' && kind!=='stop' && re.test(m));
  if(hit && !/aed|a e d|analyse|schok/.test(m)) return speak(typeof hit[1]==='function'?hit[1]():hit[1],S.cprQ);
 }
 if(S.cprQ==='aedq' && /\bnee\b|weet (ik )?niet/.test(m)) return speak(T.zin098,'sendAed');
 if(S.cprQ==='aedq' && /\bja\b/.test(m)) return speak(T.zin105,'aedq');
 if(S.cprQ==='access') {S.accessGiven=true;return speak(T.zin106);}
 if(S.cprQ==='reception'){S.receptionGiven=/\bja\b|gestuurd|staat/.test(m);return speak(S.receptionGiven?T.zin107:'Duidelijk. Ga door met reanimeren.');}
 return false;
}
function handleCpr(first, m){
  if(handleDialogue(first,m)) return;
  const helpersChanged=updateHelpers(m);
  const pendingAed=S.cprQ==='aedq';
  if(aedHandler(m, first)){ if(pendingAed && S.cprQ==='aedq') S.cprQ=null; return; }
  if(S.cprQ){
    const key=S.cprQ; S.cprQ=null; addMsg('me', first);
    if(key==='aedq'){
      if(/\bnee\b|geen|weet (ik )?niet|niet bekend/.test(m))
        return say(hasHelp() ? T.zin108 : T.zin109, startRec);
      return say('Goed. {door}', startRec);
    }
    if(key==='who'){
      if(!helpersChanged){ if(/\bnee\b|niemand|alleen/.test(m)) { S.helpers=0; } else if(/\bja\b|iemand|collega/.test(m)) { S.helpers=Math.max(1,S.helpers||0); } }
      return say(helperReply(), startRec);
    }
    if(key==='name'){ S.nameGiven=true; return say('Dank u.', startRec); }
    if(key==='what'){ S.what=true; return say('Dank u, dat geef ik door aan de ambulance.', startRec); }
    if(key==='age'){ return say('Dank u. De hulp is onderweg.', startRec); }
  }
  if(quiet()) return; // ritmecheck of plakken: niet door de AED heen praten
  const isQuestion=/^\s*(wat|wanneer|hoe|waar|waarom|wie|moet|mag|kan|kunt|komt|komen|is|zijn|gaat|heeft|hebben|zal|zullen)\b/.test(first.toLowerCase()) || /\?\s*$/.test(first);
  let hit=CPR_REPLIES.find(([re])=>re.test(m));
  if(!hit){
    if(!isQuestion) return;
    hit=[null,T.zin110];
  }
  // na de AED: niet reageren op wat de AED zelf zegt, alleen op de student
  if(S.aed && !isQuestion && hit[0] && !['stop','handover','aedok'].includes(hit[2])) return;
  addMsg('me', first);
  if(typeof hit[1]==='function') hit=[hit[0], hit[1](), hit[2]];
  if(hit[2]==='stop'){ S.stoppedEarly=true; return finish(false); }
  if(hit[2]==='handover'){ S.handover=true; S.phase='ending'; stopRec(); return say(hit[1], ()=>{ S.phase='cpr'; finish(true); }); }
  say(hit[1], startRec);
}
setInterval(()=>{
  if(!S.t0 || S.phase==='done' || S.phase==='idle') return;
  if(S.phase!=='connecting') $('callStatus').textContent=fmt(elapsed());
  if(S.phase==='cpr' && S.cprStart) $('cprTime').textContent=fmt((now()-S.cprStart)/1000);
  // wachten tot het hardop tellen klaar is, daarna pas de openingsvraag
  if(S.phase==='opening' && !S.speaking){
    const quiet=now()-(S.lastSpeech||S.openStart);
    if(S.heardNumbers){ if((S.sawTen && quiet>500) || quiet>1500){ S.counted=true; S.phase='questions'; S.busy=true; ask('opening'); } }
    else if(now()-S.openStart>1200 && quiet>800){ S.phase='questions'; S.busy=true; ask('opening'); }
  }
}, 250);

/* ---------------- einde ---------------- */
function finish(aedDone){
  if(S.phase==='done') return;
  const wasCpr = S.phase==='cpr' || S.phase==='cpr-intro';
  S.cprDur = S.cprStart ? (now()-S.cprStart)/1000 : 0;
  S.phase='done'; stopRec(); stopMetronome(); S.timers.forEach(clearTimeout);
  if(synth) synth.cancel();
  if(S.wake){ try{ S.wake.release(); }catch(e){} }
  setInd('','Oefening klaar'); $('callStatus').textContent='Gesprek beëindigd';
  setTimeout(()=>showResult(aedDone, wasCpr), 1200);
}
function showResult(aedDone, reachedCpr){
  setVolume(1);
  const rows=[], cls=(ok,mid)=>ok?'good':(mid?'mid':'bad');
  rows.push(['Om de ambulance gevraagd', S.service==='goed'?'Ja':S.service==='omweg'?'Via een andere route':'Niet duidelijk', cls(S.service==='goed'||S.service==='omweg'),
    T.zin111]);
  rows.push(['Ademhaling hardop gecontroleerd', S.counted?'Ja, geteld':'Niet gehoord', cls(S.counted),
    T.zin112]);
  const volN=['address','unresp','noBreath'].filter(k=>S.vol[k]).length;
  const missing=[]; if(!S.vol.address) missing.push('het adres'); if(!S.vol.unresp) missing.push('dat hij niet reageert'); if(!S.vol.noBreath) missing.push('dat hij niet normaal ademt');
  rows.push(['Zelf gemeld aan de meldkamer ambulance', volN+' van 3', cls(volN===3, volN>=1),
    missing.length ? 'Nog niet genoemd: '+missing.join(', ')+'.' : T.zin113]);
  if(S.addrUnmatched) rows.push(['Adres verstaan', 'Niet zeker', 'mid', T.zin114+SC.adres+'.']);
  rows.push(['Adres genoemd na', S.slots.address!==null?fmt(S.slots.address):'Niet genoemd', cls(S.slots.address!==null&&S.slots.address<=30, S.slots.address!==null&&S.slots.address<=50),
    'Gerekend vanaf het bellen.']);
  rows.push(['Reanimatie gestart vóór de instructie', S.cprBefore?'Ja':'Nee', cls(S.cprBefore),
    T.zin115]);
  rows.push(['Extra vragen van de meldkamer', String(S.asked.size), cls(S.asked.size===0, S.asked.size<=1),
    T.zin116]);
  if(S.wrongBreath||S.wrongUnresp) rows.push(['Juist ingeschat', 'Nee', 'bad',
    S.wrongBreath?T.zin117:T.zin118]);
  rows.push(['Luidspreker aangezet', S.tSpeaker!==null?'Na '+fmt(S.tSpeaker):'Niet', cls(S.tSpeaker!==null&&S.tSpeaker<=8, S.tSpeaker!==null),
    T.zin119]);
  if(S.confirmPlan==='wrong' && S.confirmAsked) rows.push(['Verkeerd adres verbeterd', S.confirmOk?'Ja':'Nee', cls(S.confirmOk),
    T.zin120]);
  rows.push(['Hulp onderweg na', S.tHelp!==null?fmt(S.tHelp):'–', cls(S.tHelp!==null&&S.tHelp<=60, S.tHelp!==null&&S.tHelp<=90), T.zin121]);
  rows.push(['AED gemeld aan de meldkamer', S.aedEarly?'Al bij de melding':S.aed?'Na '+fmt(S.tAed)+' reanimeren':'Nee', cls(S.aed),
    T.zin122]);
  rows.push(['Reanimatie volgehouden', reachedCpr?fmt(S.cprDur):'–', cls(S.handover||S.cprDur>=120, S.cprDur>=60),
    T.zin123]);
  const box=$('resultBox'); box.innerHTML='';
  rows.forEach(([k,v,c,t])=>{ const d=document.createElement('div'); d.className='metric';
    d.innerHTML='<span></span><span class="v '+c+'"></span><span class="t"></span>';
    d.children[0].textContent=k; d.children[1].textContent=v; d.children[2].textContent=t; box.appendChild(d); });
  const tr=$('transcript'); tr.innerHTML='';
  transcript.forEach(([k,t])=>{ const li=document.createElement('li'); li.className='tr-'+k;
    li.textContent=(k==='disp'?'Meldkamer: ':k==='note'?'Tip: ':k==='count'?'Jij (tellen): ':'Jij: ')+t; tr.appendChild(li); });
  show('result');
}

/* ---------------- start ---------------- */
async function askMic(){
  if(!SR) return false;
  try{ if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
      const st=await navigator.mediaDevices.getUserMedia({audio:true}); st.getTracks().forEach(t=>t.stop()); }
    return true; }catch(e){ return false; }
}
let dialed='';
const LET={2:'ABC',3:'DEF',4:'GHI',5:'JKL',6:'MNO',7:'PQRS',8:'TUV',9:'WXYZ',0:'+'};
const DTMF={1:[697,1209],2:[697,1336],3:[697,1477],4:[770,1209],5:[770,1336],6:[770,1477],7:[852,1209],8:[852,1336],9:[852,1477],'*':[941,1209],0:[941,1336],'#':[941,1477]};
let keepAlive=null;
function toneWav(freq, onSec, totalSec, amp){
  const rate=16000, n=Math.floor(rate*totalSec), on=Math.floor(rate*onSec);
  const b=new ArrayBuffer(44+n*2), v=new DataView(b), w=(o,t)=>{ for(let i=0;i<t.length;i++) v.setUint8(o+i,t.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4,36+n*2,true); w(8,'WAVEfmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,rate,true); v.setUint32(28,rate*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){ const fade=Math.min(1,i/200,(on-i)/200); const x=i<on?Math.sin(2*Math.PI*freq*i/rate)*amp*Math.max(0,fade):0; v.setInt16(44+i*2, x*32767, true); }
  return URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
}
let RING=null;
function ring(){
  if(!RING) RING={ soft:new Audio(toneWav(425,1.0,1.2,0.12)), loud:new Audio(toneWav(425,1.0,1.2,0.7)) };
  const a = S.speaker ? RING.loud : RING.soft;
  try{ a.currentTime=0; a.play().catch(()=>{}); }catch(e){}
}
function silentWav(){ // 0,5 s stilte als wav, om iOS in 'afspelen'-modus te zetten
  const n=4000, b=new ArrayBuffer(44+n*2), v=new DataView(b), w=(o,t)=>{ for(let i=0;i<t.length;i++) v.setUint8(o+i,t.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4,36+n*2,true); w(8,'WAVEfmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,8000,true); v.setUint32(28,16000,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,n*2,true);
  return URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
}
function audio(){
  try{ if(navigator.audioSession) navigator.audioSession.type='playback'; }catch(e){}
  try{ if(!keepAlive){ keepAlive=new Audio(silentWav()); keepAlive.loop=true; keepAlive.volume=0.01; } keepAlive.play().catch(()=>{}); }catch(e){}
  try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); actx.resume(); }catch(e){}
}
function tone(k){ audio(); setVolume(1); const f=DTMF[k]; if(!f) return; beep(f[0],0.12,0.06); beep(f[1],0.12,0.06); }
function renderDial(){ $('dialNum').textContent=dialed; $('delBtn').classList.toggle('invisible', !dialed); $('dialHint').textContent=''; }
['1','2','3','4','5','6','7','8','9','*','0','#'].forEach(k=>{
  const b=document.createElement('button'); b.className='key'; b.setAttribute('aria-label',k);
  b.innerHTML='<span class="d"></span><span class="l"></span>';
  b.children[0].textContent=k; b.children[1].textContent=LET[k]||'';
  b.onclick=()=>{ if(dialed.length<15){ dialed+=k; tone(k); renderDial(); } };
  $('keys').appendChild(b);
});
$('delBtn').onclick=()=>{ dialed=dialed.slice(0,-1); renderDial(); };
function show(id){ ['intro','dialer','call','result'].forEach(s=>$(s).classList.toggle('hidden', s!==id));
  document.body.dataset.screen=id; window.scrollTo(0,0); }
// Toestemming voor microfoon en spraakherkenning al vragen bij het kiezen van een scenario,
// zodat er tijdens het gesprek geen melding meer in beeld komt.
let micWarm=false;
async function warmupMic(){
  if(micWarm || !SR) return; micWarm=true;
  try{ if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){ const st=await navigator.mediaDevices.getUserMedia({audio:true}); st.getTracks().forEach(t=>t.stop()); } }catch(e){}
  try{ const r=new SR(); r.lang='nl-NL'; r.onerror=()=>{}; r.onend=()=>{}; r.start(); setTimeout(()=>{ try{ r.abort(); }catch(e){} }, 600); }catch(e){}
}
function renderList(){
  const L=$('scList'); L.innerHTML='';
  SCENARIOS.forEach((sc,i)=>{
    const b=document.createElement('button'); b.className='row'; b.disabled=!sc.naam;
    b.innerHTML='<span class="num"></span><span class="txt"><b></b><span></span></span><span class="chev" aria-hidden="true">›</span>';
    b.querySelector('.num').textContent=i+1;
    b.querySelector('b').textContent=sc.naam||'Nog in te vullen';
    b.querySelector('.txt span').textContent=sc.adres ? sc.adres+'. Ambulance na '+(sc.ambulanceNa||AMBULANCE_NA_MINUTEN+':00') : 'Beschikbaar voor een nieuw adres';
    b.onclick=()=>{ SC=sc;
      if(sc.drenkeling){
        const choice=$('drowningLocation').value;
        const labels={strand:'het strand van Scheveningen',zwembad:'een zwembad in Den Haag',laakkade:'de Laakkade in Den Haag'};
        SC={...sc,gpsLabel:labels[choice],adres:labels[choice],waterStart:$('drowningStatus').value};
      }
      dialed=''; renderDial(); warmupMic(); $('dialLoc').textContent='📍 '+sc.naam.replace(/, (kort|lang)$/,'')+', '+sc.adres; show('dialer'); };
    L.appendChild(b);
  });
}
renderList();
$('backIntro').onclick=()=>show('intro');
$('dialBtn').onclick=async ()=>{
  if(dialed!=='112'){ $('dialHint').textContent= dialed ? 'In deze oefening bel je 112.' : 'Toets eerst 112 in.'; return; }
  audio();
  reset(); transcript=[];
  if(SC.drenkeling){S.waterSafe=SC.waterStart==='uit';}
  ring(); // meteen overgaan, nog binnen de tik (nodig op iPhone)
  if(synth){ const u=new SpeechSynthesisUtterance(' '); u.volume=0; synth.speak(u); } // ontgrendelt spraak op iOS
  $('callTitle').textContent='112'; $('callStatus').textContent='bellen…';
  $('capDisp').textContent=''; $('capMe').textContent='';
  $('cprPill').classList.add('hidden'); $('cprTime').textContent='0:00';
  show('call'); setInd('talk','Verbinden…');
  try{ if(navigator.wakeLock) navigator.wakeLock.request('screen').then(w=>S.wake=w).catch(()=>{}); }catch(e){}
  S.t0=now(); S.tDial=now(); S.phase='connecting'; setSpeaker(false); S.role='112';
  // variatie per oefening
  S.noAed = Math.random()<KANS_GEEN_AED;
  S.confirmPlan = Math.random()<0.5 ? (Math.random()<0.5 ? 'wrong' : 'right') : null;
  S.askAge = Math.random()<KANS_LEEFTIJD;
  if(SC.kort){ S.confirmPlan=null; S.askAge=false; }
  setInd('talk','Gaat over…');
  // één keer overgaan, dan neemt de centralist op
  later(()=>{
    if(S.phase!=='connecting') return;
    S.t0=now(); S.phase='opening'; S.openStart=now(); $('callStatus').textContent='0:00';
    if(!SR) micFailed('none'); else startRec();
  },2600);
};
$('spkBtn').onclick=()=>setSpeaker(!S.speaker);
$('endBtn').onclick=()=>{ S.stoppedEarly=true; if(S.phase==='idle'||S.phase==='connecting'){ S.phase='done'; stopRec(); S.timers.forEach(clearTimeout); setVolume(1); show('dialer'); return; } finish(false); };
$('againBtn').onclick=()=>show('intro');
function hookVoice(selId, testId, key, role, sample){
  $(selId).onchange=e=>{ const v=nlVoices().find(x=>vkey(x)===e.target.value); if(!v) return;
    if(role==='112') voice112=v; else voice=v; try{ localStorage.setItem(key, vkey(v)); }catch(err){} };
  $(testId).onclick=()=>{ if(!synth) return; synth.cancel(); const u=new SpeechSynthesisUtterance(speakable(sample)); u.lang='nl-NL';
    const rv=roleVoice(role); if(rv.v) u.voice=rv.v; u.pitch=rv.pitch; u.rate=1.08; synth.speak(u); };
}
hookVoice('voiceSel112','voiceTest112','stem112','112',T.zin124);
hookVoice('voiceSelAmb','voiceTestAmb','stemAmb','amb',T.zin125);
(function(){
  const sel=$('aedSel');
  AED_VARIANTEN.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; if(v===aedUitspraak) o.selected=true; sel.appendChild(o); });
  sel.onchange=()=>{ aedUitspraak=sel.value; try{ localStorage.setItem('aedUitspraak2', aedUitspraak); }catch(e){} };
  $('aedTest').onclick=()=>{ if(!synth) return; synth.cancel(); const u=new SpeechSynthesisUtterance(speakable('Is er een AED ter plaatse? Zet de AED aan.')); u.lang='nl-NL';
    const rv=roleVoice('amb'); if(rv.v) u.voice=rv.v; u.pitch=rv.pitch; u.rate=1.08; synth.speak(u); };
})();
$('voiceReload').onclick=()=>{
  const cnt=$('voiceCount'); const before=nlVoices().length;
  cnt.textContent='Zoeken naar stemmen…';
  // een stille zin laat de iPhone de stemmenlijst opnieuw inlezen
  if(synth){ try{ synth.cancel(); const u=new SpeechSynthesisUtterance(' '); u.volume=0; u.lang='nl-NL'; synth.speak(u); }catch(e){} }
  let n=0;
  const step=()=>{ pickVoice(); n++;
    if(n<4){ setTimeout(step, 700); return; }
    const after=nlVoices().length; window.voiceMsgUntil=Date.now()+20000;
    cnt.textContent = after+' Nederlandse stem'+(after===1?'':'men')+' gevonden'
      + (after>before ? ', er zijn nieuwe bijgekomen.' : T.zin126);
  };
  setTimeout(step, 300);
};
$('testBtn').onclick=()=>{
  const out=$('testOut'); audio(); setVolume(1);
  beep(425,0.6,0.35);
  if(synth){ const u=new SpeechSynthesisUtterance('Hoort u mij? Zeg iets.'); u.lang='nl-NL'; if(voice) u.voice=voice; synth.speak(u); }
  if(!SR){ out.textContent=T.zin127+MIC_MSG.none; return; }
  out.textContent=T.zin128;
  setTimeout(()=>{
    let r; try{ r=new SR(); }catch(e){ out.textContent=MIC_MSG.none; return; }
    r.lang='nl-NL'; r.interimResults=false;
    let got=false;
    r.onresult=e=>{ got=true; out.textContent='Het werkt. Verstaan: "'+e.results[0][0].transcript+'"'; };
    r.onerror=e=>{ got=true; out.textContent = e.error==='no-speech' ? T.zin129 : (MIC_MSG[e.error]||('Fout: '+e.error)); };
    r.onend=()=>{ if(!got) out.textContent='Er is niets gehoord. Probeer het nog eens.'; };
    try{ r.start(); out.textContent='Ik luister, zeg iets…'; }catch(e){ out.textContent='Fout bij starten: '+e.message; }
  }, 2200);
};
show('intro');
})();
