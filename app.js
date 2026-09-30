/* De werking van de app. Hier hoef je normaal niets te veranderen.
   Teksten staan in teksten.js, locaties en instellingen in instellingen.js. */
(function(){
// ontbreekt een tekst in teksten.js, dan blijft de meldkamer stil in plaats van 'undefined' te zeggen
const T=new Proxy(TEKST,{get:(o,k)=>{ if(o[k]===undefined){ console.warn('Tekst ontbreekt in teksten.js:',k); return ''; } return o[k]; }});
let SC = SCENARIOS[0];
const $ = id => document.getElementById(id);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;
let voice=null;
const vkey=v=>v.voiceURI||v.name;
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
  ? 'Zet het volume hoog. De meldkamer luistert als het bolletje groen is.'
  : 'Deze browser ondersteunt geen spraakherkenning. Gebruik Safari op de iPhone of Chrome op Android.';

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
  text=text.replace(/\{door\}/g, S.aed ? T.doorMetAed : T.doorZonderAed);
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
  'none':'Deze app of browser ondersteunt geen spraakherkenning. Open de link in Safari (iPhone) of Chrome (Android), niet in de Claude-app.',
  'not-allowed':'Geen toegang tot de microfoon. Open de link in Safari of Chrome en tik op Toestaan als om de microfoon wordt gevraagd.',
  'service-not-allowed':'Spraakherkenning staat uit. Zet op de iPhone Siri en Dicteren aan via Instellingen, of gebruik Chrome.',
  'audio-capture':'Er is geen microfoon gevonden.',
  'network':'Spraakherkenning heeft een internetverbinding nodig.'
};
function micFailed(reason){
  S.micOk=false; stopRec();
  const msg=MIC_MSG[reason]||MIC_MSG['not-allowed'];
  setInd('off', msg+' Tik om opnieuw te proberen.');
}
$('listenInd').onclick=()=>{ if(S.micOk || !SR) return; S.micOk=true; $('capMe').textContent=''; startRec(); };

/* ---------------- dialogue ---------------- */
const Q=VRAGEN;   // staat in teksten.js
function nextQ(){
  if(!S.slots.address) return 'address';
  if(SC.kort){
    if(!S.slots.cpr && !(S.slots.unresp && S.slots.noBreath)) return 'combo';
    if(!S.slots.cpr && S.knows===undefined) return 'know';
    return null;
  }
  if(!S.slots.cpr){ if(!S.slots.unresp) return 'unresp'; if(!S.slots.noBreath) return 'breath'; }
  if(S.knows===undefined) return 'know';
  return null;
}
function ask(q, prefix){
  S.pendingQ=q; S.reprompts=0; if(q!=='opening' && q!=='ambOpen') S.asked.add(q);
  if(q!=='opening') $('callTitle').textContent='Meldkamer ambulance';
  let txt = (q==='know' && S.slots.cpr) ? T.weetHoeAlBezig : Q[q].vraag;
  if(SC.kort && q==='ambOpen') txt=T.ambOpenKort;
  if(SC.kort && q==='know') txt=T.weetHoeKort;
  say((prefix?prefix+' ':'')+txt, listenQ);
}
function listenQ(){ S.busy=false; startRec(); armSilence(); }
function armSilence(){
  const q=S.pendingQ;
  later(function check(){
    if(S.phase!=='questions' || S.pendingQ!==q) return;
    if(S.busy || S.speaking || now()-S.lastSpeech<4000){ later(check,3000); return; }
    if(S.reprompts>=1 || (q==='address'||q==='ambOpen') && S.slots.address) return;
    S.reprompts++; S.busy=true;
    say(T.hoortUMij+' '+Q[q].kort, listenQ);
  }, 15000);
}

function extract(m, isOpening){
  const got=[];
  if(!S.slots.address && SC.herken.some(w=>m.includes(w))){ S.slots.address=elapsed(); got.push('address'); }
  if(!S.slots.unresp && /reageert niet|reageerde niet|niet reageert|niet reageerde|nergens op reageert|niet aanspreekbaar|bewusteloos|geen reactie|reageert nergens|niet bij bewustzijn|buiten bewustzijn/.test(m)){ S.slots.unresp=true; got.push('unresp'); }
  if(!S.slots.noBreath && /(ademt|ademhaling)[^|]{0,15}\b(niet|geen)\b|\bniet\b[^|]{0,12}ademt|geen (normale )?ademhaling|happ?end|snurk|gasp|naar adem/.test(m)){ S.slots.noBreath=true; got.push('noBreath'); }
  if(!S.slots.cpr && /reanim|hartmassage|borstcompressie|ik druk|ik ben aan het drukken|begonnen|gestart/.test(m)){ S.slots.cpr=true; got.push('cpr'); startMetronome(); }
  if(!S.aed && /\baed\b|a e d|a\.e\.d|defibrillator|hartstarter/.test(m) && !/stuur|komt|onderweg|waar|halen|geen/.test(m)){ S.aed=true; S.aedEarly=true; S.aedState='present'; got.push('aed'); }
  if(!S.aed && S.aedState!=='fetching' && /(haal|gehaald|ophalen|pakt|rent).{0,25}(aed|a e d|defibrillator|hartstarter)|(aed|a e d|defibrillator|hartstarter).{0,25}(halen|gehaald|ophalen|onderweg)/.test(m)){ S.aedState='fetching'; got.push('aedFetch'); }
  if(S.knows===undefined && /bhv|ehbo|cursus|geleerd|getraind|opgeleid|verpleegkundige|\barts\b|ambulanceverpleegkundige|kan reanimeren|weet hoe|weet wat ik doe/.test(m)){ S.knows=true; got.push('knows'); }
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
  const m=alts.join(' | ').toLowerCase();
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

function service(m){
  extract(m, true);
  let txt;
  if(/ambulance|ziekenwagen|ziekenauto/.test(m)){ S.service=S.service||'goed'; txt=T.doorverbinden; }
  else if(/politie|brandweer/.test(m)){ S.service='fout';
    note(T.tipAndereDienst);
    txt=T.andereDienst; }
  else {
    const n=S.retries.service=(S.retries.service||0)+1;
    if(n<2) return say(T.dienstOpnieuw, listenQ);
    S.service='omweg'; note(T.tipMeteenAmbulance);
    txt=T.doorverbinden;
  }
  say(txt, ()=>{
    // doorverbinden: één keer kort overgaan, dan neemt de meldkamer ambulance op
    S.busy=true; setInd('talk','Doorverbinden…'); ring();
    later(()=>{
      if(S.phase!=='questions') return;
      S.firstAmb=true; S.role='amb';
      if(!S.slots.address) return ask('ambOpen');
      $('callTitle').textContent='Meldkamer ambulance';
      const next=nextQ(), pre=T.meldkamerAmbulance+' '+SC.bevestig;
      if(next) ask(next, pre); else startCpr([pre]);
    }, 1400);
  });
}
function respond(m, q){
  if(q==='opening') return service(m);
  if(q==='combo'){
    // één vraag voor reactie en ademhaling; happen of twijfel telt als niet normaal
    if(/\bja\b|normaal/.test(m) && !/\bnee\b|niet|geen|hap|snurk|twijfel|weet (het )?niet/.test(m)){
      S.wrongBreath=true; note(T.tipHapt);
    }
    S.slots.unresp=true; S.slots.noBreath=true;
  }
  const first=!!S.firstAmb; S.firstAmb=false;
  const got=extract(m, first);
  const acks=[];
  if(q==='unresp' && !S.slots.unresp){
    if(/\bnee\b|\bniet\b|\bgeen\b|nop/.test(m)){ S.slots.unresp=true; }
    else if(/\bja\b|\bwel\b/.test(m)){ S.wrongUnresp=true; note(T.tipReageerdeNiet);
      return say(T.nogEensSchudden, listenQ); }
  }
  if(q==='breath' && !S.slots.noBreath){
    if(/\bnee\b|\bniet\b|\bgeen\b|hap|snurk|gasp|raar|vreemd|weet (het )?niet|twijfel/.test(m)){ S.slots.noBreath=true; }
    else if(/\bja\b|normaal|ademt/.test(m)){ S.wrongBreath=true; S.slots.noBreath=true;
      note(T.tipHappen);
      acks.push(T.happenGeenAdem); }
  }
  if((q==='ambOpen'||q==='address') && !S.slots.address){
    // Niet precies herkend? Lijkt het antwoord op een adres, of zegt de student verder niets
    // bruikbaars, dan noteert de meldkamer het toch en vraagt ze het niet opnieuw.
    const addrLike=/plein|straat|weg|laan|singel|kade|gracht|park|school|haag|dam|dijk|nummer|\d/.test(m);
    if(addrLike || got.length===0){ S.slots.address=elapsed(); S.addrUnmatched=true; acks.push(T.adresGenoteerd); }
  }
  if(q==='know' && S.knows===undefined){
    S.knows = !/\bnee\b|weet (ik )?niet|geen idee|niet zeker|nooit|vergeten|help me|kan (het )?niet/.test(m);
  }
  if(q==='confirm'){
    const no=/\bnee\b|klopt niet|niet goed|verkeerd|\bplein\b/.test(m), yes=/\bja\b|klopt|correct|juist|dat is goed/.test(m);
    if(S.confirmPlan==='wrong'){
      if(no){ S.confirmOk=true; acks.push(T.adresVerbeterd.replace(/\{straat\}/g, SC.adres.split(',')[0])); }
      else { S.confirmOk=false; note(T.tipAdresFout); }
    } else { S.confirmOk = yes || !no; }
  }
  if(got.includes('address')){
    if(S.confirmPlan && !S.confirmAsked && SC.controleGoed && SC.controleFout){
      S.confirmAsked=true; S.pendingQ='confirm'; S.reprompts=0;
      return say([...acks, S.confirmPlan==='wrong'?SC.controleFout:SC.controleGoed].join(' '), listenQ);
    }
    acks.push(SC.bevestig);
  }
  if(got.includes('cpr')) acks.push(SC.kort ? T.alGestartKort : T.alGestart);

  const next=nextQ();
  if(!next) return startCpr(acks);
  if(next==='address' && (q==='address'||q==='ambOpen')){
    // alleen als de student nog helemaal geen adres noemde (bijv. meteen over de ademhaling begon)
    note(T.tipAdresEerst.replace(/\{adres\}/g, SC.adres));
    return say((acks.join(' ')+' '+T.enHetAdres).trim(), listenQ);
  }
  if(next===q){ return say((acks.join(' ')+' '+Q[q].vraag).trim(), listenQ); }
  const prefix = acks.length ? acks.join(' ') : '';
  ask(next, prefix);
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
  later(function t(){ if(S.phase!=='cpr' || S.handover) return; if(S.speaking||quiet()||talking()){ later(t,2500); return; } say(hasHelp() ? T.sireneMetHulp : T.sireneAlleen, startRec); }, 12000);
  later(function t(){ if(S.phase!=='cpr' || S.handover) return; if(S.speaking||quiet()||talking()){ later(t,2500); return; } say(T.ambulanceBijU, ()=>{ S.handover=true; finish(true); }); }, (SIREN+10)*1000);
}
const CPR_MAX=MAX_MINUTEN*60;
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
  if(hasHelp()) return T.helpersErbij;
  if((S.away||0)>0) return T.helpersCollegaWeg;
  return T.helpersAlleen;
}

const COACH=[   // [seconden na start, tekst, is het een wissel-herinnering?]
  [30,()=>T.coach30s],
  [70,()=>T.coach70s],
  [115,()=>hasHelp() ? T.coachBijnaTweeMinuten : null, true],
];
for(let k=2;k<=5;k++){
  COACH.push([120*k-60, ()=> k%2 ? T.coachHoudVol : T.coachGaatHetNog]);
  COACH.push([120*k, ()=> hasHelp() ? T.coachWissel : null, true]);
}
const AEDW='(aed|a e d|a\\.e\\.d|ae d|a ee d|defibrillator|hartstarter)';
// de antwoorden staan in teksten.js (ANTWOORDEN)
const CPR_REPLIES=ANTWOORDEN.map(a=>[
  a.herken,
  a.soort==='helpers' ? ()=>helperReply()
    : (a.metHulp!==undefined || a.alleen!==undefined) ? ()=>(hasHelp() ? a.metHulp : a.alleen)
    : (a.antwoord||null),
  a.soort==='stop' ? 'stop' : a.soort==='overdracht' ? 'handover' : a.altijd ? 'aedok' : undefined
]);
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
    return go('rosc',T.tekenenAdemtWeer, 0, true);
  if(/beweegt|bewoog|ogen open|hoest|kreunt|trekt/.test(m) && !/niet/.test(m)){
    addMsg('me', first); say(T.tekenenBeweegt, startRec); return true;
  }
  // analyse
  if(/schok (geadviseerd|aanbevolen)/.test(m) && !/geen schok/.test(m))
    return go('analysing',T.aedSchok, 15);
  if(/ritme|analys|hartritme|niet aanraken|niemand aanraken|handen (los|eraf|weg)|iedereen los|los van|we stoppen even|laadt op|opladen/.test(m) && !/geen schok/.test(m))
    return go('analysing',T.aedAnalyse, 18);
  // schok gegeven of geen schok
  if(/geen schok/.test(m)) return go('resumed',T.aedGeenSchok, 3, !/geadviseerd|aanbevolen/.test(m));
  if(/(schok|shock).{0,20}(gegeven|toegediend|gedaan|geweest)|(gegeven|gedaan).{0,10}(schok|shock)|geschokt/.test(m))
    return go('resumed',T.aedSchokGegeven, 3);
  // AED zegt door te gaan / weer verder
  if(/(aed|hij) zegt.{0,20}(door|verder|drukken|reanim)|we (gaan )?(weer )?(verder|door)|hervat|weer (aan het )?drukken|begin(nen)? weer|weer gestart/.test(m) && st!=='none' && st!=='fetching')
    return go('resumed',T.aedDoorgaan);
  // aansluiten / plakken
  if(/aansluit|sluit(en)?.{0,20}\baan\b|aangesloten|plak|geplakt|elektrode|pads|plakker|zet (hem|de aed) aan|aangezet|staat aan|aan het aanzetten|bloot|ontbloot|shirt (open|uit)|knip/.test(m) && (aedWord || st!=='none'))
    return go('connecting', ()=> hasHelp()
      ? T.aedPlakkenMetHulp
      : T.aedPlakkenAlleen, 25);
  // alleen, maar AED vlakbij
  if(aedWord && !hasHelp() && /minuut|vlakbij|om de hoek|hangt (hier|in de gang|naast)|in de gang|op de gang/.test(m) && st==='none'){
    S.aedState='fetching'; addMsg('me', first);
    say(T.aedHaalVlakbij, startRec); return true;
  }
  if(!aedWord) return false;
  // vragen over de AED (zolang die er nog niet is)
  if(!S.aed && /waar blijft|komt (er )?(de |een )?(aed|a e d)|(aed|a e d).{0,10}(onderweg|komen)|hebben jullie|stuurt u|stuur je/.test(m)){
    addMsg('me', first);
    say(st==='fetching' ? T.aedWaarBlijftGehaald
      : S.noAed ? T.aedWaarBlijftGeenAed
      : T.aedWaarBlijft, startRec);
    return true;
  }
  // wordt gehaald
  if(/haal|gehaald|ophalen|rent|gaat .{0,12}(halen|pakken)|pakt|onderweg/.test(m) && !has(AEDW+'.{0,15}(is|zijn) (er|terug|hier)|terug met',m))
    return go('fetching', ()=> (S.away||0)>0 && !hasHelp()
        ? T.aedGehaaldAlleen
        : hasHelp() ? T.aedGehaaldMetHulp
        : (S.cprQ='who', later(()=>{ if(S.cprQ==='who') S.cprQ=null; }, 20000), T.aedGehaaldWieNog), 0, true);
  // is er (dat zegt de AED nooit zelf)
  if(has(AEDW+'.{0,15}((is|zijn) (er|hier|binnen|aangekomen|gearriveerd|gebracht|terug)|ligt (hier|er)|staat hier|hangt hier|is gekomen)|terug met (de |een )?'+AEDW+'|(hebben|we hebben) (een|de) '+AEDW,m) || ((st==='fetching'||st==='asked') && tokens(m).length<=4))
    return go('present', ()=> hasHelp()
        ? T.aedErMetHulp
        : T.aedErAlleen, 15, true);
  return false;
}
function startCpr(acks){
  S.phase='cpr-intro'; S.tHelp=elapsed(); S.cprBefore=S.slots.cpr;
  startMetronome();
  let how;
  if(S.slots.cpr && S.knows!==false) how=T.hoeAlBezig;
  else if(S.knows) how=T.hoeWeetHet;
  else how=T.hoeUitleg;
  const send = S.aed ? T.stuurMetAed
             : S.aedState==='fetching' ? T.stuurAedGehaald
             : S.noAed ? T.stuurGeenAed
             : T.stuurAed;
  const spk = S.speaker ? [] : [T.luidspreker];
  const two = hasHelp() ? [T.wisselMetHulp] : (S.away>0 ? [T.collegaWeg] : []);
  const askAed = !S.aed && S.aedState!=='fetching' && !S.noAed;
  const tail = askAed ? T.vraagAed : T.blijfAanLijn;
  if(askAed) S.cprQ='aedq';
  let parts=[...acks, send, ...spk, how, ...two, tail];
  if(SC.kort){
    const kHow = S.slots.cpr && S.knows!==false ? T.kortHoeAlBezig : S.knows ? T.kortHoeWeetHet : T.kortHoeUitleg;
    const kSend = S.aed ? T.kortStuurMetAed : S.noAed ? T.kortStuurGeenAed : T.kortStuur;
    parts=[...acks, kSend, ...(S.speaker?[]:[T.kortLuidspreker]), kHow, ...(hasHelp()?[T.kortWissel]:[]), askAed?T.kortVraagAed:''];
  }
  say(parts.filter(Boolean).join(' '), ()=>{
    S.phase='cpr'; S.cprStart=now();
    later(()=>{ if(S.cprQ==='aedq') S.cprQ=null; }, 20000);
    COACH.forEach(([sec,f,wissel])=>later(function c(){ if(S.phase!=='cpr' || S.aed || S.cprQ || quiet()) return; if(S.speaking||talking()){ later(c,2500); return; } const t=f(); if(t && (!SC.kort || wissel)) say(t, startRec); }, sec*1000));
    later(()=>finish(false), CPR_MAX*1000);
    later(ambulanceArrives, Math.max(5, arriveSec() - SIREN - elapsed())*1000);
    if(!SC.kort){
      askDuring(20, 'phone', T.vraagTerugbel);
      askDuring(VRAAG_WAT_NA_SECONDEN, 'what', T.vraagWatGebeurd, ()=>!S.what);
    }
    if(S.askAge) askDuring(150, 'age', T.vraagLeeftijd);
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
function handleCpr(first, m){
  const helpersChanged=updateHelpers(m);
  const pendingAed=S.cprQ==='aedq';
  if(aedHandler(m, first)){ if(pendingAed && S.cprQ==='aedq') S.cprQ=null; return; }
  if(S.cprQ){
    const key=S.cprQ; S.cprQ=null; addMsg('me', first);
    if(key==='aedq'){
      if(/\bnee\b|geen|weet (ik )?niet|niet bekend/.test(m))
        return say(hasHelp() ? T.aedAntwoordNeeMetHulp : T.aedAntwoordNeeAlleen, startRec);
      return say(T.aedAntwoordJa, startRec);
    }
    if(key==='who'){
      if(!helpersChanged){ if(/\bnee\b|niemand|alleen/.test(m)) { S.helpers=0; } else if(/\bja\b|iemand|collega/.test(m)) { S.helpers=Math.max(1,S.helpers||0); } }
      return say(helperReply(), startRec);
    }
    if(key==='phone'){ S.phoneGiven=/\d|\bnul\b|\bzes\b|\bacht\b|\bnegen\b|\bvijf\b|\bdrie\b|\bvier\b|\bzeven\b|\btwee\b/.test(m);
      S.cprQ='name'; later(()=>{ if(S.cprQ==='name') S.cprQ=null; }, 20000);
      return say(S.phoneGiven?T.vraagNaamNaNummer:T.vraagNaamGeenNummer, startRec); }
    if(key==='name'){ S.nameGiven=true; return say(T.naamDank, startRec); }
    if(key==='what'){ S.what=true; return say(T.watDank, startRec); }
    if(key==='age'){ return say(T.leeftijdDank, startRec); }
  }
  if(quiet()) return; // ritmecheck of plakken: niet door de AED heen praten
  const isQuestion=/^\s*(wat|wanneer|hoe|waar|waarom|wie|moet|mag|kan|kunt|komt|komen|is|zijn|gaat|heeft|hebben|zal|zullen)\b/.test(first.toLowerCase()) || /\?\s*$/.test(first);
  let hit=CPR_REPLIES.find(([re])=>re.test(m));
  if(!hit){
    if(!isQuestion) return;
    hit=[null,T.weetNiet];
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
  rows.push(['Om de ambulance gevraagd', S.service==='goed'?'Ja':S.service==='fout'?'Andere dienst':'Niet duidelijk', cls(S.service==='goed'),
    'De 112-centralist vraagt eerst: politie, brandweer of ambulance? Zeg meteen "ambulance".']);
  rows.push(['Ademhaling hardop gecontroleerd', S.counted?'Ja, geteld':'Niet gehoord', cls(S.counted),
    'Tel hardop tot 10 terwijl je naar de borst kijkt. De meldkamer wacht daarop.']);
  const volN=['address','unresp','noBreath'].filter(k=>S.vol[k]).length;
  const missing=[]; if(!S.vol.address) missing.push('het adres'); if(!S.vol.unresp) missing.push('dat hij niet reageert'); if(!S.vol.noBreath) missing.push('dat hij niet normaal ademt');
  rows.push(['Zelf gemeld aan de meldkamer ambulance', volN+' van 3', cls(volN===3, volN>=1),
    missing.length ? 'Nog niet genoemd: '+missing.join(', ')+'.' : 'Adres, geen reactie en geen normale ademhaling: alles in één keer.']);
  if(S.addrUnmatched) rows.push(['Adres verstaan', 'Niet zeker', 'mid', 'De app kon het adres niet goed verstaan. Controleer of je het juiste adres noemde: '+SC.adres+'.']);
  rows.push(['Adres genoemd na', S.slots.address!==null?fmt(S.slots.address):'Niet genoemd', cls(S.slots.address!==null&&S.slots.address<=30, S.slots.address!==null&&S.slots.address<=50),
    'Gerekend vanaf het bellen.']);
  rows.push(['Reanimatie gestart vóór de instructie', S.cprBefore?'Ja':'Nee', cls(S.cprBefore),
    'Je hoeft niet te wachten op de meldkamer: begin zodra je weet dat hij niet normaal ademt.']);
  rows.push(['Extra vragen van de meldkamer', String(S.asked.size), cls(S.asked.size===0, S.asked.size<=1),
    'Hoe meer je zelf meldt, hoe minder vragen en hoe sneller de hulp vertrekt.']);
  if(S.wrongBreath||S.wrongUnresp) rows.push(['Juist ingeschat', 'Nee', 'bad',
    S.wrongBreath?'Happen of snurken is geen normale ademhaling.':T.tipReageerdeNiet]);
  rows.push(['Luidspreker aangezet', S.tSpeaker!==null?'Na '+fmt(S.tSpeaker):'Niet', cls(S.tSpeaker!==null&&S.tSpeaker<=8, S.tSpeaker!==null),
    'Zet de luidspreker aan zodra je belt, dan heb je je handen vrij voor de reanimatie.']);
  if(S.confirmPlan==='wrong' && S.confirmAsked) rows.push(['Verkeerd adres verbeterd', S.confirmOk?'Ja':'Nee', cls(S.confirmOk),
    'De meldkamer las het adres bewust verkeerd voor. Luister goed en verbeter het meteen.']);
  if(S.phoneGiven!==undefined) rows.push(['Terugbelnummer en naam', (S.phoneGiven?'Nummer':'Geen nummer')+(S.nameGiven?', naam':''), cls(S.phoneGiven&&S.nameGiven, S.phoneGiven||S.nameGiven),
    'De meldkamer vraagt dit voor als de verbinding wegvalt. Ken je eigen nummer.']);
  rows.push(['Hulp onderweg na', S.tHelp!==null?fmt(S.tHelp):'–', cls(S.tHelp!==null&&S.tHelp<=60, S.tHelp!==null&&S.tHelp<=90), 'Vanaf het bellen tot de meldkamer de ambulance en de AED stuurt.']);
  rows.push(['AED gemeld aan de meldkamer', S.aedEarly?'Al bij de melding':S.aed?'Na '+fmt(S.tAed)+' reanimeren':'Nee', cls(S.aed),
    'Zeg het tegen de meldkamer als de AED er is. De meldkamer wordt dan stil, zodat je de AED goed hoort.']);
  rows.push(['Reanimatie volgehouden', reachedCpr?fmt(S.cprDur):'–', cls(S.handover||S.cprDur>=120, S.cprDur>=60),
    'Bespreek met de instructeur de feedback van de oefenpop over diepte en tempo.']);
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
    b.onclick=()=>{ SC=sc; dialed=''; renderDial(); warmupMic(); $('dialLoc').textContent='📍 '+sc.naam.replace(/, (kort|lang)$/,'')+', '+sc.adres; show('dialer'); };
    L.appendChild(b);
  });
}
renderList();
$('backIntro').onclick=()=>show('intro');
$('dialBtn').onclick=async ()=>{
  if(dialed!=='112'){ $('dialHint').textContent= dialed ? 'In deze oefening bel je 112.' : 'Toets eerst 112 in.'; return; }
  audio();
  reset(); transcript=[];
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
  S.confirmPlan = Math.random()<KANS_ADRESCONTROLE ? (Math.random()<KANS_FOUT_ADRES ? 'wrong' : 'right') : null;
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
hookVoice('voiceSel112','voiceTest112','stem112','112','één één twee. Heeft u politie, brandweer of ambulance nodig?');
hookVoice('voiceSelAmb','voiceTestAmb','stemAmb','amb','Meldkamer ambulance. Waar bent u precies? Is er een AED ter plaatse?');
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
      + (after>before ? ', er zijn nieuwe bijgekomen.' : '. Mis je een stem die je net hebt gedownload? Sluit Safari dan helemaal af en open de app opnieuw.');
  };
  setTimeout(step, 300);
};
$('testBtn').onclick=()=>{
  const out=$('testOut'); audio(); setVolume(1);
  beep(425,0.6,0.35);
  if(synth){ const u=new SpeechSynthesisUtterance('Hoort u mij? Zeg iets.'); u.lang='nl-NL'; if(voice) u.voice=voice; synth.speak(u); }
  if(!SR){ out.textContent='Geluid: hoor je een toon en een stem? Zo niet, zet het volume hoger en de stille modus uit. Microfoon: '+MIC_MSG.none; return; }
  out.textContent='Je hoort nu een toon en een stem. Zeg daarna iets…';
  setTimeout(()=>{
    let r; try{ r=new SR(); }catch(e){ out.textContent=MIC_MSG.none; return; }
    r.lang='nl-NL'; r.interimResults=false;
    let got=false;
    r.onresult=e=>{ got=true; out.textContent='Het werkt. Verstaan: "'+e.results[0][0].transcript+'"'; };
    r.onerror=e=>{ got=true; out.textContent = e.error==='no-speech' ? 'Er is niets gehoord. Probeer het nog eens en praat wat harder.' : (MIC_MSG[e.error]||('Fout: '+e.error)); };
    r.onend=()=>{ if(!got) out.textContent='Er is niets gehoord. Probeer het nog eens.'; };
    try{ r.start(); out.textContent='Ik luister, zeg iets…'; }catch(e){ out.textContent='Fout bij starten: '+e.message; }
  }, 2200);
};
show('intro');
})();
