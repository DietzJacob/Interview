// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPA_URL  = 'https://ekjmynbowthpemyfrqim.supabase.co';
const SUPA_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVram15bmJvd3RocGVteWZycWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTQ0ODMsImV4cCI6MjA5MTY3MDQ4M30.agr3Uq2Mh5cykap4dj_CYR6HYYe28biTnke12zSkhvs';
const supa      = supabase.createClient(SUPA_URL, SUPA_KEY);
let   currentUser = null;
let   saveTimer   = null;

// ─── Auth UI ──────────────────────────────────────────────────────────────────
function authTab(t){
  document.getElementById('tab-login').classList.toggle('active', t==='login');
  document.getElementById('tab-signup').classList.toggle('active', t==='signup');
  document.getElementById('auth-login').style.display  = t==='login'  ? '' : 'none';
  document.getElementById('auth-signup').style.display = t==='signup' ? '' : 'none';
  document.getElementById('auth-msg').className = 'auth-msg';
}
function authMsg(msg, type='error'){
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.className = 'auth-msg ' + type;
}
async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pwd   = document.getElementById('login-pwd').value;
  if(!email||!pwd){ authMsg('Udfyld email og password.'); return; }
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Logger ind...';
  const {error} = await supa.auth.signInWithPassword({email, password:pwd});
  btn.disabled = false; btn.textContent = 'Log ind';
  if(error) authMsg(error.message==='Invalid login credentials' ? 'Forkert email eller password.' : error.message);
}
async function doSignup(){
  const email = document.getElementById('signup-email').value.trim();
  const pwd   = document.getElementById('signup-pwd').value;
  if(!email||!pwd){ authMsg('Udfyld email og password.'); return; }
  if(pwd.length < 6){ authMsg('Password skal være mindst 6 tegn.'); return; }
  const btn = document.getElementById('signup-btn');
  btn.disabled = true; btn.textContent = 'Opretter...';
  const {error} = await supa.auth.signUp({email, password:pwd});
  btn.disabled = false; btn.textContent = 'Opret konto';
  if(error) authMsg(error.message);
  else authMsg('Tjek din email og bekræft din konto — check evt. spam.', 'success');
}
async function doGoogle(){
  await supa.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
}
async function doSignout(){ await supa.auth.signOut(); }

function showAuthScreen(){ document.getElementById('auth-screen').classList.remove('hidden'); }
function hideAuthScreen(){ document.getElementById('auth-screen').classList.add('hidden'); }

function updateUserPill(user){
  const pill   = document.getElementById('user-pill');
  const avatar = document.getElementById('user-avatar');
  const email  = document.getElementById('user-email-short');
  if(user){
    avatar.textContent = (user.email||'?').slice(0,2).toUpperCase();
    email.textContent  = user.email;
    pill.style.display = 'flex';
  } else {
    pill.style.display = 'none';
  }
}

// ─── localStorage migration helper ───────────────────────────────────────────
function tryLocalStorage(key){
  try{ const s=localStorage.getItem(key); return s?JSON.parse(s):null; }
  catch(e){ return null; }
}

// ─── Supabase load / save ─────────────────────────────────────────────────────
async function loadFromSupa(){
  if(!currentUser) return false;
  const {data, error} = await supa.from('user_data').select('*').eq('id', currentUser.id).single();
  if(error && error.code !== 'PGRST116'){ console.error('Load error:', error); return false; }
  if(data){
    Qs    = (data.questions && data.questions.length) ? data.questions : JSON.parse(JSON.stringify(DEFAULTS));
    Guide = (data.guide     && data.guide.length)     ? data.guide     : JSON.parse(JSON.stringify(GUIDE_DEFAULTS));
    Bias  = (data.bias      && data.bias.length)      ? data.bias      : JSON.parse(JSON.stringify(BIAS_DEFAULTS));
    return true;
  }
  // Ny bruger — migrer fra localStorage hvis data findes, ellers brug defaults
  Qs    = tryLocalStorage('is-qs14')   || JSON.parse(JSON.stringify(DEFAULTS));
  Guide = tryLocalStorage('is-guide2') || JSON.parse(JSON.stringify(GUIDE_DEFAULTS));
  Bias  = tryLocalStorage('is-bias3')  || JSON.parse(JSON.stringify(BIAS_DEFAULTS));
  await supa.from('user_data').insert({ id: currentUser.id, questions: Qs, guide: Guide, bias: Bias });
  // Ryd localStorage efter migration
  ['is-qs14','is-guide2','is-bias3'].forEach(k => localStorage.removeItem(k));
  return true;
}

async function saveToSupa(){
  if(!currentUser) return;
  await supa.from('user_data').upsert({
    id:         currentUser.id,
    questions:  Qs,
    guide:      Guide,
    bias:       Bias,
    updated_at: new Date().toISOString()
  });
}

function debounceSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToSupa, 1200);
}

function save()       { debounceSave(); }
function saveGuide2() { debounceSave(); }
function saveBias()   { debounceSave(); }
// localStorage-versionerne er erstattet — disse er no-ops
function load()      {}
function loadGuide() {}
function loadBias()  {}

// ─── Auth state listener ──────────────────────────────────────────────────────
supa.auth.onAuthStateChange(async (event, session) => {
  if(session && session.user){
    currentUser = session.user;
    updateUserPill(currentUser);
    const ok = await loadFromSupa();
    if(ok){ hideAuthScreen(); render(); renderGuide(); renderBias(); }
  } else {
    currentUser = null;
    updateUserPill(null);
    showAuthScreen();
  }
});

// Enter-tast på loginskærm
document.addEventListener('keydown', e => {
  if(e.key === 'Enter'){
    const screen = document.getElementById('auth-screen');
    if(!screen.classList.contains('hidden')){
      document.getElementById('tab-login').classList.contains('active') ? doLogin() : doSignup();
    }
  }
});

// ─── Categories ───────────────────────────────────────────────────────────────
const CATS = [
  { id:'aabning',     label:'Åbning & screening' },
  { id:'kompetencer', label:'Kompetencer'  },
  { id:'adfaerd',     label:'Adfærd'       },
  { id:'resultater',  label:'Resultater'   },
  { id:'reference',   label:'Referencetjek'},
];
const CAT_ORDER = { aabning:0, kompetencer:1, adfaerd:2, resultater:3, reference:4 };

function cc(id){ return getComputedStyle(document.documentElement).getPropertyValue('--c-'+id).trim(); }
function cb(id){ return getComputedStyle(document.documentElement).getPropertyValue('--bg-'+id).trim(); }
function cl(id){ return (CATS.find(c=>c.id===id)||{label:id}).label; }

// ─── Default questions — REPLACE_DEFAULTS ────────────────────────────────────
const DEFAULTS = [
  {id:'aa1',cat:'aabning',  order:0, star:false,text:'Fortæl om dig selv: tag 5-10 minutter.',notes:'Stil spørgsmålet inden du har fortalt om jobbet, så du får et ufiltreret billede af, hvem personen faktisk er.\nLyt til: hvad de fremhæver, hvad de springer let henover, hvad der drives af ægte stolthed vs. hvad der lyder øvet.\nRødt flag: ingen klar rød tråd, eller de starter med at spørge om jobbet inden de svarer.'},
  {id:'aa2',cat:'aabning',  order:1, star:false,text:'Jeg er virkelig glad for, at du søgte, men kunne du fortælle lidt mere om, hvorfor du gjorde det?',notes:'Afdækker den reelle motivation uden at skubbe dem mod et indstuderet "drømmejob"-svar.\nLyt til: er det pull (tiltrukket af noget) eller push (på vej væk fra noget)? Begge er fine, men du skal vide det.\nRødt flag: meget generelt svar, tydeligvis forberedt til at lyde rigtigt.'},
  {id:'aa3',cat:'aabning',  order:2, star:false,text:'I din nuværende rolle. Hvad er dit største bidrag? Hvad ville de savne, når du stopper, og hvorfor?',notes:'Kombinerer kompetence og selvopfattelse på en konkret, personlig måde, på kandidatens egne præmisser.\nFølgespørgsmål: Hvad har du konkret gjort for at skabe det bidrag?\nRødt flag: taler i generelle vendinger, svært at se hvad der er kandidatens bidrag vs. teamets.'},
  {id:'aa4',cat:'aabning',  order:3, star:false,text:'Jeg ringer ikke til din leder nu, men hvis jeg gjorde, og spurgte hvad du er god til, hvordan du samarbejder, hvad du bidrager med. Hvad tror du, de ville sige?',notes:'Et usædvanligt spørgsmål der kan tage folk på sengen og indimellem afslører, hvorfor de faktisk søger.\nLyt til: er der et gap mellem det de håber lederen siger, og hvad de tror lederen siger? Det gap er interessant.\nRødt flag: meget poleret svar, ingen nuancer, eller de undgår at svare på hvad lederen ville sige om samarbejdet.'},
  {id:'aa5',cat:'aabning',  order:4, star:false,text:'Vi forhandler ikke nu, men for at sikre at vi er i det samme boldpark, hvad er din lønforventning?',notes:'Spørg hvad de ønsker. Ikke hvad de tjener nu. Det er fair og sparer alle for spildt tid.\nStil det tidligt, så det ikke bliver et akvært emne til sidst.\nRødt flag: vil slet ikke svare, eller har en forventning der er langt fra rammen.'},
  {id:'k10',cat:'kompetencer',order:0, star:false,text:'Velkommen. Før vi fortæller meget om hvem vi er, kunne du gå igennem dit CV? Brug femten til tyve minutter. Fortæl os hvad der drev dig til at tage de forskellige skridt i din karriere. Hvad motiverede dig? Hvorfor skiftede du?',notes:'Stil dette spørgsmål inden du har fortalt om jobbet, så du får deres egen historie uden at have påvirket dem med hvad du søger.\nLyt til: er der en logik i karrieren? Hvad driver dem? Forstår de selv deres rejse?\nRødt flag: ingen rød tråd, svært at se hvad der har drevet personen fremad, eller de springer hurtigt til at spørge om jobbet.\nHold mund i 15-20 minutter. Det, de vælger at fremhæve, er det mest ægte. Det er ikke styret af dine spørgsmål.'},
  {id:'k1', cat:'kompetencer',order:1, star:false,text:'Hvilke færdigheder eller kompetencer bruger du mest i din hverdag, og hvilke bruger du sjældnere?',notes:'Du får et konkret billede af hvad de faktisk arbejder med dag-til-dag. Ikke hvad de tror ser godt ud.\nHold det konkret og gå i dybden: hvad bruger de timer på, hvad er de gode til, hvad undgår de?\nFølgespørgsmål: Kan du give et eksempel fra den seneste uge? Hvad brugte du mest tid på?\nRødt flag: svar der er generelle og ikke knyttet til konkrete opgaver.'},
  {id:'k2', cat:'adfaerd',    order:6, star:false,text:'Beskriv en situation, hvor du skulle samarbejde med nogen, der arbejder meget anderledes end dig. Hvad skete der?',notes:'Tester interpersonelle færdigheder og tilpasningsevne.\nKig efter: nysgerrighed frem for irritation, konkret tilpasning.'},
  {id:'k3', cat:'kompetencer',order:2, star:false,text:'Giv din vigtigste kompetence en karakter fra 1 til 10. Og din svageste.',notes:'Tester selvindsigt og ærlig selvvurdering. Ikke hvad de kan, men om de kender sig selv.\nDe fleste giver deres stærke side 7-8. Følgespørgsmål: "Hvad skal til for at få det til 10?"\nFor de svage: "Hvordan håndterer du det? Spørger du om hjælp? Hvad gør du ved det?"\nDet handler om selvindsigt: hvordan reflekterer de over egne styrker og svagheder?\nRødt flag: høje tal overalt og ingen reel svaghed, eller de kan ikke svare konkret på hvad der mangler for at nå 10.'},
  {id:'k4', cat:'kompetencer',order:3, star:false,text:'Hvad er du decideret dygtig til, som dine kollegaer typisk beder dig om hjælp med?',notes:'Konkret og verificerbart via reference.\nFølgespørgsmål: Hvornår sker det typisk?'},
  {id:'k5', cat:'adfaerd',    order:7, star:false,text:'Hvad er den vigtigste fejl, du har lavet? Hvad lærte du præcis af den?',notes:'En af de mest afslørende spørgsmål. Kig efter: ægte ejerskab, reel refleksion.\nFølgespørgsmål: Hvad konkret ændrede du bagefter?'},
  {id:'k6', cat:'adfaerd',    order:8, star:false,text:'Hvornår har du sidst ændret mening om noget vigtigt, og hvad fik dig til det?',notes:'Tester intellektuel fleksibilitet.\nManglende eksempel er i sig selv et signal.'},
  {id:'a7', cat:'adfaerd',    order:9, star:false,text:'Hvis du var CEO eller var i min position som leder, hvad ville du ændre i vores virksomhed eller på arbejdspladsen?',notes:'Får kandidaten til at skifte perspektiv og tage en bredere position.\nDu ser om de kan det, og om de overhovedet har tænkt på det.\nFolk der tager ansvar kan ofte se virksomheden fra et større perspektiv end dem der bare passer sit eget.\nRødt flag: kan ikke svare, eller svaret er meget generelt og ukonkret.'},
  {id:'a8', cat:'adfaerd',    order:10, star:false,text:'Hvis du havde en tryllestav og kunne få ét ønske, hvad ville du ændre på din nuværende arbejdsplads eller arbejdssituation?',notes:'Får kandidaten til at tænke frit og eksplorativt, uden de sædvanlige filtre.\nFølgespørgsmål: "Hvis du arbejdede med os: hvordan kunne du gøre det muligt?"\nDet andet spørgsmål er vigtigt: det viser om de kan gå fra ønsketænkning til konkret handling.'},
  {id:'k7', cat:'kompetencer',order:6, star:false,text:'Hvad ville en kollega, der kender dig rigtig godt, sige er dit vigtigste udviklingspunkt?',notes:'Tredjepersonsperspektiv, gør det lettere at svare ærligt.\nRødt flag: "Jeg er nok lidt for perfektionistisk". Det er ikke et svar.'},
  {id:'k8', cat:'kompetencer',order:8, star:false,text:'Har du en speciel talent eller et hemmeligt talent, som du ikke har sat på dit CV?',notes:'Det er uventet og åbner for en anderledes samtale end de vante spørgsmål.\nAfslører hvad kandidaten brænder for ud over det formelle, og giver indblik i personlighed og drive.\nBonus: skaber ofte en lettere og mere ægte stemning i samtalen.'},
  {id:'k9', cat:'kompetencer',order:9, star:false,text:'Er der et projekt eller noget du har lavet fra start til slut, hvor du tog det fulde ansvar og leverede et rigtigt produkt eller resultat?',notes:'Tvinger kandidaten til at være konkret om hvad de faktisk kan. Ikke hvad de har været med til.\nBliv i eksemplet og gå i dybden: Hvad lavede du selv? Hvilke værktøjer brugte du? Hvad var det sværeste? Hvad blev resultatet?\nDette er et spørgsmål du skal holde ved i lang tid. Modstå fristelsen til at gå videre.\nRødt flag: kan ikke pege på et konkret projekt, eller bidraget er utydeligt ift. teamets.'},
  {id:'k11',cat:'kompetencer',order:10,star:false,text:'Har du nogensinde undervist eller mentoreret andre? Eller været ansvarlig for juniorer, hjulpet dem ind i jobbet, arbejdet med deres udvikling?',notes:'Det siger meget om niveauet af kompetence. Folk der kan dele viden og udvikle andre, har typisk høje faglige kompetencer og er gode formidlere.\nFølgespørgsmål: Hvad lærte du selv af at undervise eller mentorere? Hvad var sværest?\nKig efter: konkrete eksempler, engagement i andres udvikling, evne til at sætte ord på det de kan.'},
  {id:'k12',cat:'kompetencer',order:11,star:false,text:'Hvis du startede her i morgen, hvilke opgaver glæder du dig mest til? Og hvordan ville du kunne anvende nogle af dine erfaringer og færdigheder her?',notes:'Du ser om kandidaten har tænkt konkret på jobbet, og om de kan forbinde deres baggrund med det du har brug for.\nEt godt spørgsmål til at starte en diskussion om fit og selvforståelse.\nRødt flag: meget vage svar, ingen konkret kobling til rollen, eller de har tydeligvis ikke tænkt nærmere over det.'},
  {id:'a1', cat:'adfaerd',    order:0, star:false,text:'Har du en god historie om at lede opad, eller til siden? Hvad skete der konkret?',notes:'Tester indflydelse uden formel autoritet.\nKig efter: tålmodighed, politisk bevidsthed, emotionel intelligens.'},
  {id:'a2', cat:'adfaerd',    order:1, star:false,text:'Hvordan leder du dig selv, når tingene bliver svære?',notes:'Selvorienteret spørgsmål. Kig efter: konkrete strategier, ikke floskler.\nRødt flag: "Jeg holder bare fokus."'},
  {id:'a3', cat:'adfaerd',    order:2, star:false,text:'Beskriv en situation, hvor du var uenig med en leder eller kollegas beslutning. Hvad gjorde du?',notes:'Tester mod, integritet og samarbejdsevne.\nPoleret ikke-svar uden reel spænding er rødt flag.'},
  {id:'a4', cat:'adfaerd',    order:3, star:false,text:'Hvad kendetegner det arbejdsmiljø, der trækker det bedste frem i dig, og hvad fungerer ikke for dig?',notes:'Nyttigt til manager fit og kulturvurdering.\nLyt til hvad de kritiserer, det afspejler tit egne begrænsninger.'},
  {id:'a5', cat:'adfaerd',    order:4, star:false,text:'Hvornår har du sidst bedt om hjælp, og hos hvem?',notes:'Tester åbenhed og psykologisk tryghed.\nRødt flag: kan ikke give et konkret eksempel.'},
  {id:'a6', cat:'adfaerd',    order:5, star:false,text:'Hvad skal dette job give dig, som du ikke har i dag?',notes:'Direkte spørgsmål til motivation og forventninger.\nRødt flag: svarer kun med det, de tror du vil høre.'},
  {id:'r1', cat:'resultater', order:0, star:false,text:'Hvilket konkret resultat er du allermest stolt af, og hvad var præcist dit personlige bidrag?',notes:'Kig efter: ejerskab, specificitet, klart resultat.\nFølgespørgsmål: Hvad ville du gøre anderledes i dag?'},
  {id:'r2', cat:'resultater', order:1, star:false,text:'Hvis jeg ringer til din seneste leder i morgen. Hvad leverede du allermest værdi på?',notes:'Meget konkret og verificerbar via reference.\nRødt flag: taler i generelle vendinger.'},
  {id:'r3', cat:'resultater', order:2, star:false,text:'Beskriv en opgave fra start til slut: udfordringen, din handling og resultatet.',notes:'STAR-struktur. Bliv i eksemplet. Gå ikke videre, før du har alle tre led.'},
  {id:'r4', cat:'resultater', order:3, star:false,text:'Hvad er det, du laver, der skaber mest værdi, og er der noget du laver, der burde stoppes?',notes:'Dobbeltspørgsmål der afslører prioriteringsevne og mod til at sige fra.'},
  {id:'r5', cat:'resultater', order:4, star:false,text:'Hvornår er du sidst gået hjem fra arbejde og tænkt: "I dag var en god dag"? Hvad skete der den dag?',notes:'Billedligt og konkret, afslører hvad kandidaten faktisk motiveres af.'},
  {id:'rf1',cat:'reference',  order:0, star:false,text:'Giv kandidaten en karakter fra 1 til 10 på [konkret kompetence]. Hvad skal der til for at gå fra 7 til 9?',notes:'Skalaen gør det lettere at svare konkret og afslører præcist, hvor referencen ser begrænsningen.'},
  {id:'rf2',cat:'reference',  order:1, star:false,text:'Vil du ansætte vedkommende igen, og hvorfor eller hvorfor ikke?',notes:'Det vigtigste referencespørgsmål. Stil det altid.\n"Det afhænger af konteksten" er ikke et ja.'},
  {id:'rf3',cat:'reference',  order:2, star:false,text:'Hvad er det konkrete bidrag, du husker allerbedst fra vedkommende?',notes:'Kræver et eksempel. Ikke generel ros. Ros uden eksempler er ikke data.'},
  {id:'rf4',cat:'reference',  order:3, star:false,text:'Hvad skulle vedkommende have hjælp til? Vær konkret.',notes:'Lyt til: hvad der omgås, hvad besvares hurtigt vs. hvad der gives tid.'},
  {id:'rf5',cat:'reference',  order:4, star:false,text:'Hvis vedkommende ikke var stoppet. Hvad potentiale ser du der?',notes:'Afdækker om referencen ser et loft for kandidaten.'},
];

// ─── State ────────────────────────────────────────────────────────────────────
let Qs       = [];
let filter   = 'all';
let expanded = {};
let editId   = null;
let selCat   = 'kompetencer';
let pendingDeleteId = null;

// Drag state
let dragId   = null;
let dropId   = null;
let ghost    = null;
let dragStartX = 0, dragStartY = 0;

const STORAGE_KEY = 'is-qs14';

// ─── Sort helpers ─────────────────────────────────────────────────────────────
function sorted(){
  let base;
  if(filter==='starred') base=Qs.filter(q=>q.star);
  else if(filter==='all') base=[...Qs];
  else base=Qs.filter(q=>q.cat===filter);

  return base.sort((a,b)=>{
    const catDiff = CAT_ORDER[a.cat]-CAT_ORDER[b.cat];
    return catDiff!==0 ? catDiff : a.order-b.order;
  });
}
function starred(){ return Qs.filter(q=>q.star); }

function normaliseOrders(cat){
  Qs.filter(q=>q.cat===cat).sort((a,b)=>a.order-b.order).forEach((q,i)=>q.order=i);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render(){ renderList(); renderSidebar(); }

function renderList(){
  const list=document.getElementById('q-list');
  const qs=sorted();
  // Preserve hero banner
  const hero = list.querySelector('.hero-banner');
  if(!qs.length){
    const msg = filter==='starred'
      ? '<h2>Ingen markerede spørgsmål</h2><p>Tryk ★ på et spørgsmål for at tilføje det til din guide</p>'
      : '<h2>Ingen spørgsmål her</h2><p>Brug "+ Nyt spørgsmål" for at tilføje</p>';
    list.innerHTML=`<div class="empty">${msg}</div>`;
    if(hero && filter==='all') list.insertBefore(hero, list.firstChild);
    return;
  }
  list.innerHTML='';
  if(hero && filter==='all') list.appendChild(hero);

  const showHeaders = filter==='all'||filter==='starred';
  if(showHeaders){
    CATS.forEach(cat=>{
      const group=qs.filter(q=>q.cat===cat.id);
      if(!group.length) return;
      const hd=document.createElement('div');
      const isFirst = list.children.length === 0;
      hd.className='cat-section-hd'+(isFirst?' first':'');
      hd.style.color=cc(cat.id);
      hd.innerHTML=`<span class="cat-hd-dot" style="background:${cc(cat.id)}"></span>${cat.label}`;
      list.appendChild(hd);
      group.forEach(q=>list.appendChild(buildCard(q)));
    });
  } else {
    qs.forEach(q=>list.appendChild(buildCard(q)));
  }
}

function buildCard(q){
  const color=cc(q.cat), bg=cb(q.cat), exp=expanded[q.id];
  const div=document.createElement('div');
  div.className='q-card'+(q.star?' starred':'');
  div.id='card-'+q.id;
  div.dataset.id=q.id;
  div.dataset.cat=q.cat;
  div.style.cssText=`--cc:${color}`;
  div.innerHTML=`
    <div class="q-inner">
      <span class="handle" title="Træk for at flytte">⠿</span>
      <span class="dot" style="background:${color}"></span>
      <div class="q-body">
        <div class="q-text">${esc(q.text)}</div>
        ${q.notes?`
          <button class="n-btn" style="color:${color}" data-nid="${q.id}">
            <span>${exp?'▼':'▶'}</span>${exp?'Skjul noter':'Vis noter'}
          </button>
          ${exp?`<div class="n-body" style="background:${bg};border-left:2px solid ${color};color:${color}">${esc(q.notes)}</div>`:''}
        `:''}
      </div>
      <div class="q-actions">
        <span class="badge" style="background:${bg};color:${color}">${cl(q.cat)}</span>
        <button class="ic ed" data-act="edit" data-id="${q.id}" title="Rediger" style="--cc:${color}">✎</button>
        <button class="ic str${q.star?' on':''}" data-act="star" data-id="${q.id}" title="${q.star?'Fjern fra guide':'Tilføj til guide (★)'}">★</button>
        <button class="ic del" data-act="del"  data-id="${q.id}" title="Slet">✕</button>
      </div>
    </div>`;

  div.addEventListener('click',e=>{
    const b=e.target.closest('[data-act]');
    if(b){
      if(b.dataset.act==='edit') openEdit(b.dataset.id);
      else if(b.dataset.act==='star') toggleStar(b.dataset.id);
      else askDelete(b.dataset.id);
      return;
    }
    const n=e.target.closest('[data-nid]');
    if(n){ expanded[n.dataset.nid]=!expanded[n.dataset.nid]; renderList(); }
  });

  const handle=div.querySelector('.handle');
  handle.addEventListener('mousedown', e=>startDrag(e, q.id, false));
  handle.addEventListener('touchstart', e=>startDrag(e, q.id, true), {passive:false});
  return div;
}

// ─── Drag & drop (mouse + touch) ──────────────────────────────────────────────
function getXY(e, touch){
  if(touch){ const t=e.touches[0]||e.changedTouches[0]; return {x:t.clientX,y:t.clientY}; }
  return {x:e.clientX, y:e.clientY};
}

function startDrag(e, id, touch){
  e.preventDefault();
  const {x,y}=getXY(e,touch);
  dragId=id; dropId=null;
  dragStartX=x; dragStartY=y;

  const card=document.getElementById('card-'+id);
  card.classList.add('dragging');

  ghost=card.cloneNode(true);
  ghost.className='drag-ghost-el';
  ghost.style.width=card.offsetWidth+'px';
  document.body.appendChild(ghost);
  posGhost(x,y);

  if(touch){
    window.addEventListener('touchmove', onTouchMove, {passive:false});
    window.addEventListener('touchend',  onTouchEnd,  {passive:false});
  } else {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  }
}

function posGhost(x,y){
  if(ghost){ ghost.style.left=(x-16)+'px'; ghost.style.top=(y-20)+'px'; }
}

function findTargetAt(x,y){
  if(ghost) ghost.style.display='none';
  const el=document.elementFromPoint(x,y);
  if(ghost) ghost.style.display='';
  return el&&el.closest('.q-card:not(.dragging)');
}

function updateDrop(x,y){
  posGhost(x,y);
  const target=findTargetAt(x,y);
  const tid=target?target.dataset.id:null;
  if(tid!==dropId){
    if(dropId) document.getElementById('card-'+dropId)?.classList.remove('drag-over');
    dropId=tid;
    if(dropId) document.getElementById('card-'+dropId)?.classList.add('drag-over');
  }
}

function onMouseMove(e){ updateDrop(e.clientX,e.clientY); }
function onTouchMove(e){ e.preventDefault(); const t=e.touches[0]; updateDrop(t.clientX,t.clientY); }

function endDrag(){
  ghost?.remove(); ghost=null;
  if(dragId&&dropId&&dragId!==dropId) reorder(dragId,dropId);
  document.querySelectorAll('.q-card').forEach(c=>c.classList.remove('dragging','drag-over'));
  dragId=null; dropId=null;
  renderList();
}

function onMouseUp(){ window.removeEventListener('mousemove',onMouseMove); window.removeEventListener('mouseup',onMouseUp); endDrag(); }
function onTouchEnd(){ window.removeEventListener('touchmove',onTouchMove); window.removeEventListener('touchend',onTouchEnd); endDrag(); }

function reorder(srcId, tgtId){
  const src=Qs.find(q=>q.id===srcId);
  const tgt=Qs.find(q=>q.id===tgtId);
  if(!src||!tgt) return;
  if(src.cat!==tgt.cat) return;

  const list=Qs.filter(q=>q.cat===src.cat).sort((a,b)=>a.order-b.order); // always reorder within category
  const si=list.findIndex(q=>q.id===srcId);
  const ti=list.findIndex(q=>q.id===tgtId);
  if(si===-1||ti===-1) return;

  list.splice(si,1);
  const insertAt=list.findIndex(q=>q.id===tgtId);
  list.splice(insertAt>=0?insertAt:list.length, 0, src);
  list.forEach((q,i)=>q.order=i);
  save();
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function renderSidebar(){
  document.getElementById('cnt-all').textContent = Qs.length;
  document.getElementById('cnt-aa').textContent  = Qs.filter(q=>q.cat==='aabning').length;
  document.getElementById('cnt-k').textContent   = Qs.filter(q=>q.cat==='kompetencer').length;
  document.getElementById('cnt-a').textContent   = Qs.filter(q=>q.cat==='adfaerd').length;
  document.getElementById('cnt-r').textContent   = Qs.filter(q=>q.cat==='resultater').length;
  document.getElementById('cnt-ref').textContent = Qs.filter(q=>q.cat==='reference').length;
  const s=starred().length;
  document.getElementById('cnt-star').textContent=s;

  document.querySelectorAll('.f-btn').forEach(btn=>{
    const f=btn.dataset.f, active=f===filter;
    btn.classList.toggle('active',active);
    if(active){
      if(f==='all')     { btn.style.background='#E8E4DC'; btn.style.color='#1A1916'; }
      else if(f==='starred') { btn.style.background='#FFF9EC'; btn.style.color='#D4A020'; }
      else              { btn.style.background=cb(f); btn.style.color=cc(f); }
    } else {
      btn.style.background=''; btn.style.color='';
    }
  });

  document.getElementById('sel-panel').classList.toggle('on',s>0);
  document.getElementById('sel-n').textContent=s+(s===1?' spørgsmål':' spørgsmål')+' markeret';
  document.getElementById('pdf-lbl').textContent=s?`Download PDF (${s})`:'Download PDF';
}

function setFilter(f){ filter=f; render(); }
function toggleStar(id){ const q=Qs.find(q=>q.id===id); if(q){q.star=!q.star;save();render();} }
function clearStars(){ Qs.forEach(q=>q.star=false); if(filter==='starred') filter='all'; save(); render(); }

// ─── Delete with confirm ──────────────────────────────────────────────────────
function askDelete(id){
  const q=Qs.find(q=>q.id===id); if(!q) return;
  pendingDeleteId=id;
  document.getElementById('del-text').textContent=`"${q.text.slice(0,80)}${q.text.length>80?'…':''}"`;
  document.getElementById('del-confirm').classList.add('on');
}
function cancelDelete(){ document.getElementById('del-confirm').classList.remove('on'); pendingDeleteId=null; }
function confirmDelete(){
  if(pendingDeleteId){
    if(pendingDeleteId.startsWith('GUIDE:')){
      const id=pendingDeleteId.slice(6);
      Guide=Guide.filter(g=>g.id!==id);
      saveGuide2(); renderGuide();
    } else if(pendingDeleteId.startsWith('BIAS:')){
      const id=pendingDeleteId.slice(5);
      Bias=Bias.filter(b=>b.id!==id); delete bExpanded[id];
      saveBias(); renderBias();
    } else {
      Qs=Qs.filter(q=>q.id!==pendingDeleteId); delete expanded[pendingDeleteId]; save(); render();
    }
  }
  cancelDelete();
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function buildCatGrid(){
  document.getElementById('cat-grid').innerHTML=CATS.map(c=>`
    <button class="cat-opt${selCat===c.id?' sel':''}"
      style="${selCat===c.id?`border-color:${cc(c.id)};background:${cb(c.id)};color:${cc(c.id)}`:''}"
      onclick="pickCat('${c.id}')">${c.label}</button>`).join('');
}
function pickCat(id){ selCat=id; buildCatGrid(); }

function openAdd(){
  editId=null;
  // Default to currently filtered category if in single-cat view
  selCat=(filter!=='all'&&filter!=='starred')?filter:'kompetencer';
  document.getElementById('mtitle').textContent='Nyt spørgsmål';
  document.getElementById('f-text').value='';
  document.getElementById('f-notes').value='';
  buildCatGrid();
  document.getElementById('overlay').classList.add('on');
  setTimeout(()=>document.getElementById('f-text').focus(),60);
}
function openEdit(id){
  const q=Qs.find(q=>q.id===id); if(!q) return;
  editId=id; selCat=q.cat;
  document.getElementById('mtitle').textContent='Rediger spørgsmål';
  document.getElementById('f-text').value=q.text;
  document.getElementById('f-notes').value=q.notes||'';
  buildCatGrid();
  document.getElementById('overlay').classList.add('on');
  setTimeout(()=>document.getElementById('f-text').focus(),60);
}
function saveQ(){
  const text=document.getElementById('f-text').value.trim();
  const notes=document.getElementById('f-notes').value.trim();
  if(!text) return;
  if(editId){
    const q=Qs.find(q=>q.id===editId);
    if(q){ q.text=text; q.notes=notes; q.cat=selCat; }
  } else {
    Qs.filter(q=>q.cat===selCat).forEach(q=>q.order++);
    Qs.push({id:'q'+Date.now(), cat:selCat, order:0, star:false, text, notes});
    normaliseOrders(selCat);
  }
  save(); closeModal(); render();
}
function closeModal(){ document.getElementById('overlay').classList.remove('on'); editId=null; }
function bgClick(e){ if(e.target===document.getElementById('overlay')) closeModal(); }

// ─── PDF / Print ──────────────────────────────────────────────────────────────
function openPdfModal(){ showPrint(); }
function closePdfModal(){ }
function pdfOverlayBg(e){ }

function doShowPrint(){ showPrint(); }

function showPrint(){
  const qs = starred().length ? starred() : Qs;
  const grouped = CATS
    .map(c=>({ cat:c, qs:qs.filter(q=>q.cat===c.id).sort((a,b)=>a.order-b.order) }))
    .filter(g=>g.qs.length);

  const today = new Date().toLocaleDateString('da-DK',{day:'numeric',month:'long',year:'numeric'});

  let html=`<div class="pv-hdr">
    <div>
      <div class="pv-title">Interviewguide</div>
      <div class="pv-meta">${qs.length} spørgsmål · ${today}</div>
    </div>
    <div class="pv-brand">& Dietz</div>
  </div>`;

  grouped.forEach(({cat,qs})=>{
    const color=cc(cat.id);
    html+=`<div class="pv-cat">
      <div class="pv-cat-hd" style="color:${color}">
        <span class="pv-dot" style="background:${color}"></span>${cat.label}
      </div>`;
    qs.forEach((q,i)=>{
      html+=`<div class="pv-q">
        <div class="pv-num">${i+1}</div>
        <div class="pv-qt">${esc(q.text)}
          <div class="pv-line"></div><div class="pv-line" style="margin-top:16px"></div>
        </div></div>`;
    });
    html+=`</div>`;
  });

  document.getElementById('pv-content').innerHTML=html;
  document.getElementById('main-layout').style.display='none';
  document.getElementById('pv').classList.add('on');
  window.scrollTo(0,0);
}
function hidePrint(){
  document.getElementById('pv').classList.remove('on');
  document.getElementById('main-layout').style.display='flex';
}


// ─── Export / Import data ────────────────────────────────────────────────────
function exportData(){
  const data = {
    version: 1,
    exported: new Date().toISOString(),
    questions: Qs,
    guide: Guide,
    bias: Bias
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'interview-studio-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    try{
      const data = JSON.parse(ev.target.result);
      if(!data.questions) throw new Error('Ugyldig fil');
      if(confirm('Dette vil erstatte alle dine nuværende spørgsmål, guide og bias. Fortsæt?')){
        if(data.questions) { Qs = data.questions; save(); }
        if(data.guide)     { Guide = data.guide;   saveGuide2(); }
        if(data.bias)      { Bias = data.bias;      saveBias(); }
        render();
        alert('Data hentet. ' + Qs.length + ' spørgsmål indlæst.');
      }
    } catch(err){
      alert('Kunne ikke læse filen: ' + err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

// ─── Utils ────────────────────────────────────────────────────────────────────
function esc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(document.getElementById('del-confirm').classList.contains('on')) cancelDelete();
    else if(document.getElementById('overlay').classList.contains('on')) closeModal();
    else if(document.getElementById('pv').classList.contains('on')) hidePrint();
  }
});

// ─── Guide data ───────────────────────────────────────────────────────────────
const GUIDE_DEFAULTS = [
  {id:'g1', order:0, headline:'Dobbelt fokus: faglige + personlige kompetencer', short:'Hold altid balancen. Gå ikke 90% i den ene retning og 10% i den anden. Begge sider tæller.', detail:'Du kigger efter to ting samtidigt: kan de gøre jobbet fagligt (hard skills, det du ser på CV\'et), og er de det rigtige menneske at arbejde med (personlighed, motivation, soft skills)?\n\nHvis du kun fokuserer på det faglige, mister du viden om kulturelt fit og arbejdsglæde. Omvendt: en superflink personlighed uden kompetencer fungerer heller ikke.\n\nEn god check: Midt i interviewet. Spørg dig selv: "Har jeg nu fået et billede af begge sider?" Hvis du har brugt 80% på værdier og historier uden at have spurgt noget konkret fagligt, stop op og korriger kursen. Og omvendt.'},
  {id:'g12', order:1, headline:'Jobannoncen er dit første interview', short:'Behandl jobannoncen som du behandler CV\'er. AI-genererede floskler skræmmer de bedste kandidater væk.', detail:'Når enhver anden annonce er skrevet med ChatGPT og fyldt med "dynamisk leder", "innovativ kultur" og "faglig stolthed", skiller en annonce der er ærlig og konkret sig markant ud.\n\nDe bedste kandidater søger ikke job blindt. De læser og vurderer. Og de kan lugte en AI-genereret liste af ønsker på afstand.\n\nEn god jobannonce gør det samme som et godt CV: den fortæller en konkret historie.\n\n→ Hvad skal personen faktisk løse? Ikke en titel, men en opgave.\n→ Hvad er svært ved jobbet? Vær ærlig om det.\n→ Hvad har folk der lykkes i rollen gjort konkret?\n→ Hvem arbejder de med? Hvad er kulturen, virkelig?\n\nGode kandidater søger ikke jobs. De søger efter at blive forstået. En annonce der viser at du har tænkt grundigt, og ved hvad du leder efter, tiltrækker folk der faktisk vil jobbet. Ikke folk der bare søger alt.\n\nBi-effekten: jo dårligere konkurrenternes annoncer er, jo mere effektiv er din ved blot at være ægte.'},
  {id:'g2', order:2, headline:'Observation over indhold: HVORDAN de svarer', short:'Det vigtigste er ikke altid hvad de svarer, men hvordan. Svarer de på det du spørger om? Kan de holde en pause og tænke sig om?', detail:'Det siger enormt meget om kognitiv modenhed og nærvær:\n\n→ Svarer de faktisk på det du spurgte, eller glider de udenom til noget nemmere?\n→ Tager de 3-4 sekunder til at tænke inden de svarer? Det er et godt tegn.\n→ Fylder de stilheden med ord for at undgå pausen? Det er et signal.\n→ Skyder de et øvet svar af øjeblikkeligt? Sandsynligvis forberedt frase. Bor dybere.\n\nEn kandidat der stopper, tænker, og giver et velovervejet svar viser at de kan håndtere usikkerhed og er til stede i situationen. Det er svært at øve sig på, og svært at fake.'},
  {id:'g3', order:3, headline:'Tag en partner med: din wingman i rummet', short:'Aldrig alene. En kollega hvis rolle er at se det du ikke ser, og holde dig ærlig.', detail:'Det sker alt for tit: du bliver forelsket i en kandidat. Deres energi smitter af. Du er excited. Og det påvirker samtalen. Eller du er desperat efter at få stillingen besat, og uden at vide det motiverer du kandidaten på en måde der får dem til at virke bedre end de er.\n\nDin partner ser det udefra. De siger bagefter: "Jeg er ikke sikker på at energien kom fra kandidaten. Det var din entusiasme der drev den samtale."\n\nVigtigste spørgsmål: Hvor kom energien fra? Var det kandidaten der bragte det, eller var det dig?\n\nGiv din partner en eksplicit rolle: "Din opgave er at se det jeg ikke ser. Vær kritisk." Og lyt til dem efterfølgende, selv hvis du er uenig.'},
  {id:'g4', order:4, headline:'To ører, én mund: tal mindre, lyt mere', short:'Det første spørgsmål er det vigtigste. Still det, og hold så mund i 15-20 minutter.', detail:'Jo mindre du siger om jobbet i starten, jo mere får du at vide om hvem de virkelig er.\n\nHvis du begynder at fortælle om jobbet for tidligt, bruger du din bedste informationsmulighed, de ved hvad du søger og begynder at svare det de tror du vil høre. Det ufiltrede svar uden dine påvirkninger, det er guld.\n\nSæt en norm fra start: "Inden vi fortæller dig hvad vi søger, vil vi gerne høre om dig. Kan du gå igennem dit CV og fortælle om hvad der drev dig?" Og så: hold mund. Vent. Observér.\n\nHvad lægger de vægt på? Hvad springer de let henover? Det de vælger at fremhæve er det mest ægte, styret af dem, ikke af dig.'},
  {id:'g5', order:5, headline:'Den lille stemme: lyt til din intuition', short:'Den stemme der siger "jeg er ikke helt sikker" har næsten altid ret. Ignorer den ikke.', detail:'Vi har alle den. Du er ved at sige ja til nogen, men i bunden af maven sidder en lille stemme: "Jeg er ikke 100% overbevist."\n\nNæsten alle dårlige ansættelser starter med at man ignorerer den stemme. "Nah, det nok godt nok," tænker man. Og tre måneder senere, når det hele er gået galt, siger alle: "Ja, jeg vidste det faktisk fra dag ét."\n\nDen lille stemme er ikke bias. Det er erfaring der ikke er sat på ord endnu.\n\nHvad du skal gøre: Sig det højt til dine kollegaer. "Jeg har et godt fagligt indtryk, men jeg er ikke helt sikker på motivationen." Eller: "Der er noget med energien jeg ikke kan sætte finger på." Når I taler det ud, bliver det tydeligere, og I kan beslutte om det er et rødt flag eller bare støj.'},
  {id:'g6', order:11, headline:'Kræv bevis: konkrete eksempler, ikke floskler', short:'"Det lyder godt, men kan du give mig et konkret eksempel?" Brug dette spørgsmål meget.', detail:'Folk er dygtige til at tale fint. "Jeg er god til at lede mennesker." "Jeg er stærk i kommunikation." "Jeg elsker at løse komplekse problemer."\n\nDet lyder fantastisk. Men borer du ned. Er der noget der holder?\n\n→ "Fortæl om en gang du ledede nogen gennem noget virkelig svært. Hvad sagde du? Hvad skete der?"\n→ "Kan du give mig et konkret projekt hvor du brugte den kompetence? Hvad lavede du selv?"\n\nFolk der faktisk kan præstere, kan fortælle præcist hvad de gjorde. Folk der taler fint om det, kan ikke.\n\nGå gerne virkelig dybt i ét eksempel: Hvornår? Hvem? Hvad sagde du? Hvad var resultatet? Hvad ville du gøre anderledes? Det er her, de virkelige svar kommer frem.'},
  {id:'g7', order:6, headline:'Gå videre når du har svaret', short:'Du har 60 minutter. Når du har det du skal bruge. Stop med at grave og bevæg dig videre.', detail:'En af de mest almindelige fejl: du fortsætter med at stille spørgsmål i et område selvom du allerede har fundet ud af hvad du ville vide.\n\n"Ja, men... hvad ellers?" Kandidaten begynder at gentage sig. Det bliver trægt. Du spilder tid du kunne bruge på noget helt tredje.\n\nKlar tankegang: "Har jeg nu et billede af [det jeg søgte svar på]?" Hvis ja. Gå videre.\n\nDu behøver ikke nå alle spørgsmål i banken. Det handler om at få det rigtige billede. Og det billede kan du sommetider tegne på 3 spørgsmål, sommetider 10. Fleksibilitet er en styrke.'},
  {id:'g8', order:7, headline:'Portfolio check (anden samtale)', short:'Lad dem vise noget de allerede har lavet. Ikke noget nyt. Projekter, præsentationer, tekst.', detail:'I anden samtale: bed dem vise konkrete eksempler på tidligere arbejde. Ikke noget de skal lave nu, noget de allerede er stolte af.\n\nDet kan være:\n→ En præsentation de lavede\n→ En artikel eller rapport de skrev\n→ Et design, et koncept, en kampagne\n→ En email-korrespondance der viser hvordan de kommunikerer\n\nLad dem præsentere det og fortælle: Hvad var opgaven? Hvad var dit konkrete bidrag? Hvad var du mest stolt af? Hvad ville du lave om?\n\nDet fjerner dig fra teoretiske svar og ind i virkelighed. Og de fleste mennesker har noget de kan dele, uden at bryde fortrolighed.'},
  {id:'g9', order:8, headline:'Mini-cases (anden samtale)', short:'5 slides, 10 min præsentation, 10 min diskussion. Ikke mere. Det handler om tankegang, ikke svar.', detail:'Brug cases til at se hvordan de tænker. Ikke for at se om de kan løse dit problem.\n\nGod case-format:\n→ 5 slides max. Ikke 20-30\n→ 10 minutter til præsentation fra deres side\n→ 10 minutter diskussion og opfølgning\n\nHvad du kigger efter:\n→ Kan de strukturere et argument?\n→ Kan de prioritere og sige hvad der er vigtigst?\n→ Hvad sker der når du udfordrer dem? Bliver de defensive, eller kan de tænke med dig?\n→ Er de realistiske, eller lever de i en teoretisk verden?\n\nUndgå cases der intet har med jobbet at gøre. Og undgå at kræve at de løser dit egentlige problem. Det er ikke rimeligt.'},
  {id:'g10', order:9, headline:'Det ekstraordinære. Hvad gør de ud over arbejdet?', short:'Spørg hvad de laver ved siden af. Folk med rigtig kapacitet gør typisk noget extra.', detail:'Et simpelt spørgsmål: "Hvad laver du ud over arbejdet? Er der noget du er engageret i?"\n\nDu leder efter: Elite sport. Frivilligt arbejde. Et sprog de lærer. En hobby de bruger seriøse timer på. Undervisning. Et sideprojekt.\n\nDet behøver ikke være dramatisk, men du ser om der er drive og energi ud over det man betales for.\n\nObs: Vær ikke firkantet. Nogen prioriterer familie og børn over alt andet. Det er fuldstændig legitimt. Men spørg alligevel. Det giver et billede af hvem de er som menneske.\n\nDen lidt "skæve" ting de laver ved siden af. Det kan netop være det der adskiller dem fra alle andre kandidater.'},
  {id:'g11', order:10, headline:'Bias-bevidsthed: kend din ubevidste bias', short:'Den farligste bias er den du ikke ved du har. Lær dig selv at kende.', detail:'Vi er alle biased. Det er et menneskeligt vilkår. Problemet er ikke at have bias. Det er ikke at vide om det.\n\nTypiske bias i rekruttering:\n→ "Folk som mig selv": vi foretrækker kandidater der minder om os\n→ Glorificering: ét stærkt punkt farver hele vurderingen\n→ Bekræftelsesbias: vi søger det der bekræfter vores første indtryk\n→ Kontrastbias: vi vurderer kandidater op mod hinanden, ikke op mod kravprofilen\n\nHvad du kan gøre:\n→ Skriv din vurdering ned inden du taler med de andre. Undgå at den første stemme styrer\n→ Spørg dig selv: "Kan jeg lide denne person, eller tror jeg de kan gøre jobbet?"\n→ Tag altid en anden med som kan se det du ikke ser\n→ Brug de samme spørgsmål til alle kandidater, det giver et fair grundlag\n\nSe vores biasliste for konkrete eksempler og beskrivelser.'},
];

const GUIDE_KEY = 'is-guide2';
let Guide = [];
let gExpanded = {};
let gEditId = null;

function renderGuide(){
  const list=document.getElementById('g-list');
  if(!list) return;
  const sorted=[...Guide].sort((a,b)=>a.order-b.order);
  // Keep the intro, remove only cards
  const intro = list.querySelector('.guide-intro');
  list.innerHTML='';
  if(intro) list.appendChild(intro);
  sorted.forEach((g,i)=>{
    const exp=gExpanded[g.id];
    const card=document.createElement('div');
    card.className='g-card'+(exp?' expanded':'');
    card.id='gcard-'+g.id;
    card.innerHTML=`
      <div class="g-card-top" onclick="toggleGuide('${g.id}')">
        <div class="g-num">${i+1}</div>
        <div class="g-summary">
          <div class="g-headline">${esc(g.headline)}</div>
          <div class="g-short">${esc(g.short)}</div>
          ${g.detail?`<button class="g-toggle"><span>${exp?'▼':'▶'}</span>${exp?'Skjul detaljer':'Vis detaljer & teknikker'}</button>`:''}
        </div>
        <div class="g-actions">
          <button class="ic ed" onclick="event.stopPropagation();openEditGuide('${g.id}')" title="Rediger" style="--cc:#888">✎</button>
          <button class="ic del" onclick="event.stopPropagation();askDeleteGuide('${g.id}')" title="Slet">✕</button>
        </div>
      </div>
      ${exp&&g.detail?`<div class="g-detail">${esc(g.detail)}</div>`:''}`;
    list.appendChild(card);
  });
}

function toggleGuide(id){
  gExpanded[id]=!gExpanded[id];
  renderGuide();
}

// Guide modal
function openAddGuide(){
  gEditId=null;
  document.getElementById('gmtitle').textContent='Nyt princip';
  document.getElementById('g-headline').value='';
  document.getElementById('g-short').value='';
  document.getElementById('g-detail').value='';
  document.getElementById('goverlay').classList.add('on');
  setTimeout(()=>document.getElementById('g-headline').focus(),60);
}
function openEditGuide(id){
  const g=Guide.find(g=>g.id===id); if(!g) return;
  gEditId=id;
  document.getElementById('gmtitle').textContent='Rediger princip';
  document.getElementById('g-headline').value=g.headline;
  document.getElementById('g-short').value=g.short;
  document.getElementById('g-detail').value=g.detail||'';
  document.getElementById('goverlay').classList.add('on');
  setTimeout(()=>document.getElementById('g-headline').focus(),60);
}
function saveGuide(){
  const headline=document.getElementById('g-headline').value.trim();
  const short=document.getElementById('g-short').value.trim();
  const detail=document.getElementById('g-detail').value.trim();
  if(!headline) return;
  if(gEditId){
    const g=Guide.find(g=>g.id===gEditId);
    if(g){g.headline=headline;g.short=short;g.detail=detail;}
  } else {
    Guide.push({id:'g'+Date.now(),order:Guide.length,headline,short,detail});
  }
  saveGuide2(); closeGModal(); renderGuide();
}
function closeGModal(){ document.getElementById('goverlay').classList.remove('on'); gEditId=null; }
function gOverlayBg(e){ if(e.target===document.getElementById('goverlay')) closeGModal(); }

function askDeleteGuide(id){
  const g=Guide.find(g=>g.id===id); if(!g) return;
  pendingDeleteId='GUIDE:'+id;
  document.getElementById('del-text').textContent=`"${g.headline}"`;
  document.getElementById('del-confirm').classList.add('on');
}

// Tab switching
function switchTab(tab){
  if(tab==='bank' && filter==='starred'){ filter='all'; }
  document.getElementById('tab-bank').classList.toggle('active',tab==='bank');
  document.getElementById('tab-guide').classList.toggle('active',tab==='guide');
  document.getElementById('tab-bias').classList.toggle('active',tab==='bias');
  document.getElementById('main-layout').style.display=tab==='bank'?'flex':'none';
  document.getElementById('guide-layout').classList.toggle('on',tab==='guide');
  document.getElementById('bias-layout').classList.toggle('on',tab==='bias');
  document.getElementById('hdr-pdf').style.display=tab==='bank'?'':'none';
  document.getElementById('hdr-add-q').style.display=tab==='bank'?'':'none';
  document.getElementById('hdr-add-g').style.display=tab==='guide'?'':'none';
  document.getElementById('hdr-add-b').style.display=tab==='bias'?'':'none';
  if(tab==='guide') renderGuide();
  if(tab==='bias') renderBias();
}

// ─── BIAS ─────────────────────────────────────────────────────────────────────
const BIAS_DEFAULTS = [
  {id:'b0',  order:-1, headline:'Ubevidst bias: den farligste af dem alle', short:'Den bias du ikke ved du har er den du ikke kan forsvare dig imod.', detail:'Ubevidst bias. Også kaldet implicit bias, er den fordom eller forudindtagethed du bærer med dig uden at vide det. Den opstår automatisk, inden du når at tænke dig om. Og netop fordi den er ubevidst, er den den farligste.\n\nDe fleste mennesker er enige om at de ikke ønsker at diskriminere. Alligevel viser forskning konsekvent at vi gør det, fordi vores hjerne sorterer, kategoriserer og konkluderer på millisekunder, styret af mønstre vi ikke selv er klar over.\n\nKirurgens dilemma illustrerer det perfekt: over halvdelen af dem der hører gåden sidder fast. Ikke fordi de er kønsstereotype, men fordi antagelsen sidder så dybt at den er usynlig.\n\nI rekruttering betyder det at du kan sige "jeg vurderer alle kandidater lige", og stadig systematisk favorisere dem der minder om dig selv, taler som dig, uddannet fra de rigtige steder, har de rigtige navne.\n\nHvad du kan gøre:\n→ Erkend at du har ubevidst bias. Alle har det\n→ Strukturér din proces: stil de samme spørgsmål til alle, skriv din vurdering ned inden du taler med andre\n→ Tag en wingman med, en der ser det du ikke ser\n→ Evaluer kandidater mod kravprofilen, ikke mod hinanden\n→ Brug denne biasliste aktivt, jo mere bevidst du er, jo mere reducerer du den ubevidste del\n\nDu bliver aldrig helt fri for bias. Men bevidsthed er dit stærkeste redskab.', notes:''},
  {id:'b1',  order:0,  headline:'Ankerbias', short:'Det første indtryk sætter rammen for alt, der kommer efter.', detail:'Man baserer sin konklusion på det allerførste stykke information man møder. Et dårligt profilbillede på CV\'et, noget man typisk ser som det første, kan ubevidst påvirke den måde, man efterfølgende fortolker personens uddannelse og karriere.\n\nAnkerbiasen gælder ikke kun det visuelle. Det gælder også den første ting kandidaten siger, det første ord du hæfter dig ved i en ansøgning, eller den første reference du taler med.\n\nHvad du kan gøre: Læs hele CV\'et og hæft dig ikke ved enkeltpunkter. Notér din samlede vurdering. Ikke delvurderinger der farver resten.', notes:''},
  {id:'b2',  order:1,  headline:'Framing-effekt', short:'Indpakningen påvirker vurderingen. Ikke kun indholdet.', detail:'Det samme CV udformet med to forskellige designs vil blive oplevet som to vidt forskellige kandidater. Form og farver, layout og typografi påvirker din vurdering, selvom indholdet er identisk.\n\nDet er framing. Du bliver forstyrret af præsentation og det går ud over din evne til at vurdere substansen.\n\nHvad du kan gøre: Forsøg at standardisere hvad du læser og i hvilken rækkefølge. Spørg dig selv: "Ville jeg vurdere dette anderledes hvis det stod på et hvidt ark med sort tekst?"', notes:''},
  {id:'b3',  order:2,  headline:'Gruppebias', short:'Vi favoriserer kandidater fra grupper vi selv tilhører.', detail:'En leder uddannet fra CBS vil ubevidst se på ansøgere fra CBS med mere varme end på dem med andre uddannelser. Det sker ikke bevidst. Det er genkendelse, der føles som kvalitet.\n\nDet gælder ikke kun uddannelse: sport, opvækst, branche, netværk. Er du vant til at ansætte fra ét bestemt miljø, vil du have sværere ved at se potentiale i kandidater fra et andet.\n\nHvad du kan gøre: Spørg dig selv aktivt: "Kan lide jeg denne kandidat fordi de minder om mig, eller fordi de faktisk kan gøre jobbet?"', notes:''},
  {id:'b4',  order:3,  headline:'Kontrastbias', short:'Kandidater vurderes op mod hinanden. Ikke mod kravprofilen.', detail:'Efter at have talt med en meget stærk kandidat vil den næste fremstå svagere end de ville have gjort alene. Og omvendt: efter en svag kandidat vil den næste fremstå stærkere.\n\nDette er kontrastbias. Du vurderer ikke kandidaten mod den kravprofil du satte op. Du vurderer dem mod den forrige samtale.\n\nHvad du kan gøre: Hold altid kravprofilen frem som din målestok. Skriv din vurdering ned inden du taler med din kollega. Vurder altid en kandidat alene. Ikke i relation til de andre.', notes:''},
  {id:'b5',  order:4,  headline:'Opmærksomhedsbias', short:'Du lægger mærke til det du selv tænker meget over til daglig.', detail:'Går du meget op i detaljer, ordenssans eller præcision, vil du søge netop den information hos kandidaten, og vægter det højere end andre egenskaber.\n\nOmvendt: er du selv kreativ og ustruktureret, vil du måske undervurdere kandidater der scorer lavt på orden men højt på kreativitet.\n\nDin opmærksomhed er selektiv. Den filtrerer information baseret på hvad der er relevant for dig. Ikke nødvendigvis hvad der er vigtigt for rollen.\n\nHvad du kan gøre: Kend dine egne primære værdier. Og tag en kollega med som vægter andre ting end dig.', notes:''},
  {id:'b6',  order:5,  headline:'Tilgængelighedsbias', short:'Den viden der sidder øverst i dit hoved styrer din vurdering.', detail:'Er du netop i gang med at læse en bog om personlighed, vil du bruge den bog som linse når du vurderer kandidater. Ikke den akkumulerede viden du har bygget op over år.\n\nTilgængelighed handler om hvad der er let at aktivere mentalt. Det der sidder frisk i hukommelsen styrer dine slutninger, selvom det måske ikke er det mest relevante.\n\nHvad du kan gøre: Vær opmærksom på hvad der har fyldt for dig inden et interview. Er du påvirket af en nylig fejlansættelse? Et møde der gik galt? Det farver også.', notes:''},
  {id:'b7',  order:6,  headline:'Glorificeringsbias (halo/horn)', short:'Ét stærkt, eller svagt: punkt farver hele vurderingen.', detail:'Kan du virkelig godt lide ét aspekt af en kandidat, vil du have en tendens til at se positivt på resten. Det kaldes halo-effekten.\n\nOmvendt: kan du ikke lide ét aspekt, vil det kaste en skygge over alt andet. Det kaldes horn-effekten.\n\nEt eksempel: en stavefejl i en ansøgning kan betyde at et stærkt kandidatur bliver kasseret, fordi stavefejlen aktiverer horn-effekten og farver alt efterfølgende negativt.\n\nHvad du kan gøre: Sørg for at evaluere kandidater på tværs af dimensioner separat. Stil de samme spørgsmål til alle. Lad ikke ét datapunkt styre det hele.', notes:''},
  {id:'b8',  order:7,  headline:'Fundamental attributionsbias', short:'Vi forklarer andres valg med personlighed. Ikke med kontekst.', detail:'Mange jobskift på et CV tolkes som ustabilitet eller konfliktsøgen. Men måske arbejdede kandidaten i en branche der var i opbrud, eller de fulgte en leder de troede på.\n\nVi har en tendens til at forklare andres adfærd med hvem de er. Ikke med de omstændigheder de var i. Vi glemmer konteksten.\n\nHvad du kan gøre: Spørg altid ind til baggrunden bag valg. "Hvad skete der der?" er en bedre åbning end en konklusion om personlighed.', notes:''},
  {id:'b9',  order:8,  headline:'Stereotyper', short:'Vi forventer bestemte træk hos folk fra bestemte grupper.', detail:'En bedstemor, en veganer, en bankuddannet, en selvlærd programmør. Vi har alle forestillinger om hvad de er for nogen, inden vi har mødt dem.\n\nDisse forestillinger kan forhindre os i at se hele mennesket. Vi sorterer information der bekræfter stereotypen og ignorerer det der modsiger den.\n\nHvad du kan gøre: Vær opmærksom på hvornår du aktiverer gruppeidentiteter i dine slutninger. Stil dig selv spørgsmålet: "Hvad ved jeg faktisk om denne konkrete person?"', notes:''},
  {id:'b10', order:9,  headline:'Social sammenligningsbias', short:'Vi vælger kandidater der ikke konkurrerer med os selv.', detail:'Ifølge denne bias vil man have en tendens til at vælge kandidater der ikke er bedre end en selv på de områder man selv er stærkest.\n\nEn konsulent der rekrutterer en ny kollega vil ubevidst frasorte kandidater der er stærkere end konsulenten selv på konsulentens kernekompetencer.\n\nDet er et menneskeligt selvbeskyttelsesinstinkt. Men det kan koste organisationen de bedste kandidater.\n\nHvad du kan gøre: Vær opmærksom på om du begejstres af kandidater der er anderledes end dig, men stærke på andre områder. Og sørg for at den endelige beslutning involverer flere end dig.', notes:''},
  {id:'b11', order:10, headline:'Medløberbias', short:'Vi gør og tror det de fleste andre gør og tror.', detail:'Hvis alle i teamet er begejstrede for en kandidat, er det svært at sige noget andet. Den sociale pres til at følge stemningen er stærk.\n\nI ansættelsesudvalg kan dette betyde at den første person der taler, og er begejstret, sætter tonen for alle andres vurdering.\n\nHvad du kan gøre: Skriv din selvstændige vurdering ned inden du deler den med andre. Start ikke med "hvad synes I?". Start med at alle skriver en individuel vurdering ned.', notes:''},
  {id:'b12', order:11, headline:'Bekræftelsesbias', short:'Vi søger det der bekræfter vores første mening, og ignorerer resten.', detail:'Har du et godt første indtryk af en kandidat, vil du ubevidst søge information der bekræfter det, og nedtone det der taler imod.\n\nDet er en af de mest udbredte bias i rekruttering. Den er svær at opdage præcis fordi den er ubevidst.\n\nHvad du kan gøre: Stil aktivt spørgsmål der udfordrer din hypotese. "Hvad ville tale imod denne kandidat?" er et vigtigt spørgsmål at stille sig selv, og sine kollegaer, inden beslutningen.', notes:''},
  {id:'b13', order:12, headline:'Gruppetænkning', short:'Den herskende opfattelse i gruppen undertrykker afvigende synspunkter.', detail:'I et ansættelsesudvalg med en stærk personlighed kan det blive svært at sige noget der bryder med stemningen. Tvivl holdes inde. Den lille stemme ties ihjel.\n\nResultatet: en beslutning der virker enig, men som faktisk ikke er det. Og en fejlansættelse alle bagefter siger de "godt vidste".\n\nHvad du kan gøre: Skab en norm for at uenighed er velkomment. Bed alle skrive en individuel vurdering inden I taler sammen. Overvej at bede én person om at spille "djævelens advokat".', notes:''},
  {id:'b14', order:13, headline:'Bagklogskabsbias', short:'Vi overdriver hvor godt vi forudså en hændelse, efter den er sket.', detail:'"Jeg vidste godt det ikke ville gå." Den sætning er langt lettere at sige efter en fejlansættelse end inden.\n\nBagklogskabsbias betyder at vi i tilbageblik rekonstruerer vores hukommelse så vi fremstår klogere end vi var. Det giver en falsk fornemmelse af at vi burde have set det komme.\n\nProblemet: det forhindrer os i at lære af fejl. Vi tror vi vidste noget vi ikke vidste.\n\nHvad du kan gøre: Dokumenter din vurdering inden ansættelsen. Hvad vidste du? Hvad var du i tvivl om? Det giver et ærligt billede at lære af efterfølgende.', notes:''},
  {id:'b15', order:14, headline:'Illusion of control', short:'Vi tror vi kan påvirke ting der ligger uden for vores kontrol.', detail:'I rekruttering kan dette komme til udtryk som en overdreven tro på at et godt onboarding-forløb kan "fikse" en kandidat der ikke er rigtig til rollen.\n\n"Vi kan nok forme dem" er en klassisk manifestation. Det kan ende med at man ansætter en kandidat man dybest set er i tvivl om, fordi man tror man kan kompensere for det der mangler.\n\nHvad du kan gøre: Vær ærlig om hvad du kan ændre ved en kandidat, og hvad der er grundlæggende personlighed og motivation du ikke kan træne dig ud af.', notes:''},
  {id:'b16', order:15, headline:'Self-serving bias', short:'Succes skyldes os selv. Fiasko skyldes omstændighederne.', detail:'Gik ansættelsen godt, var det fordi vi var gode til at rekruttere. Gik det galt, var det fordi kandidaten ikke levede op til det de lovede, eller fordi onboarding-processen svigede.\n\nDenne bias forhindrer os i at lære af egne fejl i rekruttering. Det er altid noget andet der er skyld i fejlansættelsen.\n\nHvad du kan gøre: Tag ejerskab over beslutningen. Også når den går galt. Hvad var din rolle i processen? Hvad ville du have gjort anderledes?', notes:''},
  {id:'b17', order:16, headline:'Escalation of commitment', short:'Jo mere vi har investeret i en kandidat, jo sværere er det at sige nej.', detail:'Har du brugt tre samtaler, to tests og en case på en kandidat, er det psykologisk svært at konkludere at det ikke er den rigtige.\n\nMen beslutningen skal baseres på hvad der er rigtigt for rollen. Ikke på hvad du allerede har brugt af tid og energi.\n\nDet er escalation of commitment: man fastholder et forløb fordi man har investeret for meget til at stoppe.\n\nHvad du kan gøre: Sæt klare go/no-go-kriterier inden processen starter. Og vær villig til at stoppe, uanset hvad der er brugt.', notes:''},
];

const BIAS_KEY = 'is-bias3';
let Bias = [];
let bExpanded = {};
let bEditId = null;

function loadBias(){}

function renderBias(){
  const cards=document.getElementById('b-cards');
  if(!cards) return;
  const sorted=[...Bias].sort((a,b)=>a.order-b.order);
  cards.innerHTML='';
  sorted.forEach((b,i)=>{
    const exp=bExpanded[b.id];
    const card=document.createElement('div');
    card.className='g-card'+(exp?' expanded':'');
    card.id='bcard-'+b.id;
    card.innerHTML=`
      <div class="g-card-top" onclick="toggleBias('${b.id}')">
        <div class="g-num">${i+1}</div>
        <div class="g-summary">
          <div class="g-headline">${esc(b.headline)}</div>
          <div class="g-short">${esc(b.short)}</div>
          ${(b.detail||b.notes)?`<button class="g-toggle"><span>${exp?'▼':'▶'}</span>${exp?'Skjul detaljer':'Vis detaljer & noter'}</button>`:''}
        </div>
        <div class="g-actions">
          <button class="ic ed" onclick="event.stopPropagation();openEditBias('${b.id}')" title="Rediger" style="--cc:#888">✎</button>
          <button class="ic del" onclick="event.stopPropagation();askDeleteBias('${b.id}')" title="Slet">✕</button>
        </div>
      </div>
      ${exp?(b.detail?`<div class="g-detail">${esc(b.detail)}</div>`:''):''}
      ${exp&&b.notes?`<div class="g-detail" style="border-top:1px solid var(--border);background:#FDFCFA"><strong style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Mine noter</strong><br><br>${esc(b.notes)}</div>`:''}`;
    cards.appendChild(card);
  });
}

function toggleBias(id){ bExpanded[id]=!bExpanded[id]; renderBias(); }

function openAddBias(){
  bEditId=null;
  document.getElementById('bmtitle').textContent='Ny bias';
  document.getElementById('b-headline').value='';
  document.getElementById('b-short').value='';
  document.getElementById('b-detail').value='';
  document.getElementById('b-notes').value='';
  document.getElementById('boverlay').classList.add('on');
  setTimeout(()=>document.getElementById('b-headline').focus(),60);
}

function openEditBias(id){
  const b=Bias.find(b=>b.id===id); if(!b) return;
  bEditId=id;
  document.getElementById('bmtitle').textContent='Rediger bias';
  document.getElementById('b-headline').value=b.headline;
  document.getElementById('b-short').value=b.short;
  document.getElementById('b-detail').value=b.detail||'';
  document.getElementById('b-notes').value=b.notes||'';
  document.getElementById('boverlay').classList.add('on');
  setTimeout(()=>document.getElementById('b-headline').focus(),60);
}

function saveBiasEntry(){
  const headline=document.getElementById('b-headline').value.trim();
  const short=document.getElementById('b-short').value.trim();
  const detail=document.getElementById('b-detail').value.trim();
  const notes=document.getElementById('b-notes').value.trim();
  if(!headline) return;
  if(bEditId){
    const b=Bias.find(b=>b.id===bEditId);
    if(b){ b.headline=headline; b.short=short; b.detail=detail; b.notes=notes; }
  } else {
    Bias.push({id:'b'+Date.now(),order:Bias.length,headline,short,detail,notes});
  }
  saveBias(); closeBModal(); renderBias();
}

function askDeleteBias(id){
  const b=Bias.find(b=>b.id===id); if(!b) return;
  pendingDeleteId='BIAS:'+id;
  document.getElementById('del-text').textContent=`"${b.headline}"`;
  document.getElementById('del-confirm').classList.add('on');
}

function closeBModal(){ document.getElementById('boverlay').classList.remove('on'); bEditId=null; }
function bOverlayBg(e){ if(e.target===document.getElementById('boverlay')) closeBModal(); }

// Auth listener handles initial load and render
// load(); loadGuide(); loadBias(); render(); — called after auth

