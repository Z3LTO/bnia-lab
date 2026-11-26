(function(){
"use strict";
/* =====================================================================
   Outils de base
   ===================================================================== */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2600)};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clone=o=>JSON.parse(JSON.stringify(o));
const eur=n=>{n=Math.round((+n||0)*100)/100;const [i,d]=Math.abs(n).toFixed(2).split('.');return (n<0?'-':'')+i.replace(/\B(?=(\d{3})+(?!\d))/g,' ')+','+d+' €'};
const eur0=n=>Math.abs(n-Math.round(n))<.001?eur(n).replace(',00',''):eur(n);
const r2=n=>Math.round((+n||0)*100)/100;
const today=()=>{const d=new Date();d.setHours(12,0,0,0);return d};
const iso=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const fromIso=s=>{if(!s)return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const addDays=(s,n)=>{const d=fromIso(s)||today();d.setDate(d.getDate()+n);return iso(d)};
const daysBetween=(a,b)=>Math.round((fromIso(b)-fromIso(a))/864e5);
const fdate=s=>{const d=typeof s==='string'?fromIso(s):s;return d?d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'—'};
const fshort=s=>{const d=fromIso(s);return d?d.toLocaleDateString('fr-FR'):''};
const MOIS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const MOISL=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const ICON_DOC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>';

function download(name,data,type){
  const blob=data instanceof Blob?data:new Blob([data],{type:type||'application/octet-stream'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500);
}

/* =====================================================================
   Données (gardées dans ce navigateur)
   ===================================================================== */
const KEY='tampon.v3';
const blank=()=>({profile:null,clients:[],catalogue:[],docs:[],seq:{},journal:[],snooze:{},sec:null,meta:{}});
let DB=blank();
/* Nettoyage des données (au chargement et à la restauration d'une sauvegarde) */
const ID_RE=/^[a-z0-9]{4,40}$/i;
const safeImg=v=>typeof v==='string'&&/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)?v:'';
const safeFile=f=>f&&typeof f==='object'&&typeof f.data==='string'&&/^data:(image\/(png|jpe?g|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(f.data)?{name:str(f.name).slice(0,120),type:f.data.slice(5,f.data.indexOf(';')),data:f.data}:null;
function str(v){return typeof v==='string'?v.slice(0,2000):(typeof v==='number'?String(v):'')}
const num=v=>{const n=+v;return isFinite(n)?n:0};
const isoOk=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
function cleanClient(c){if(!c||typeof c!=='object'||!ID_RE.test(c.id||''))return null;return {id:c.id,type:c.type==='pro'?'pro':'part',nom:str(c.nom),adresse:str(c.adresse),cp:str(c.cp).slice(0,10),ville:str(c.ville),email:str(c.email),siren:str(c.siren).replace(/\D/g,'').slice(0,9),livraison:str(c.livraison)}}
function cleanDoc(d){
  if(!d||typeof d!=='object'||!ID_RE.test(d.id||'')||!['facture','devis','avoir','recue'].includes(d.type))return null;
  const o={id:d.id,type:d.type,created:num(d.created),date:isoOk(d.date)||iso(today())};
  if(d.type==='recue'){Object.assign(o,{fournisseur:str(d.fournisseur),ttc:num(d.ttc),tvaAmt:num(d.tvaAmt),cat:str(d.cat),paye:!!d.paye});const f=safeFile(d.file);if(f)o.file=f;return o}
  Object.assign(o,{num:d.num?str(d.num).slice(0,30):null,clientId:ID_RE.test(d.clientId||'')?d.clientId:null,ech:isoOk(d.ech)||o.date,nature:['PS','LB','LBPS'].includes(d.nature)?d.nature:'PS',notes:str(d.notes),
    lignes:Array.isArray(d.lignes)?d.lignes.slice(0,200).map(l=>({d:str(l&&l.d),q:num(l&&l.q),u:str(l&&l.u),pu:num(l&&l.pu),tva:TAUX_TVA.includes(num(l&&l.tva))?num(l.tva):20})):[],
    relances:Array.isArray(d.relances)?d.relances.filter(r=>r&&isoOk(r.date)).map(r=>({date:r.date,niveau:r.niveau==='devis'?'devis':Math.min(3,Math.max(1,num(r.niveau)||1))})):[]});
  if(d.clientSnap){const c=cleanClient(Object.assign({id:'snap0000'},d.clientSnap,{id:ID_RE.test((d.clientSnap||{}).id||'')?d.clientSnap.id:'snap0000'}));if(c)o.clientSnap=c}
  if(d.sellerSnap&&typeof d.sellerSnap==='object'){const s={};Object.keys(d.sellerSnap).forEach(k=>{const v=d.sellerSnap[k];s[k]=typeof v==='boolean'?v:str(v)});s.logo=safeImg(d.sellerSnap.logo);o.sellerSnap=s}
  if(d.paid&&isoOk(d.paid.date))o.paid={date:d.paid.date,mode:MODES.includes(d.paid.mode)?d.paid.mode:'Autre'};
  ['ref','facture','devis','annulee'].forEach(k=>{if(ID_RE.test(d[k]||''))o[k]=d[k]});
  ['accepte','refuse','finalized'].forEach(k=>{if(d[k])o[k]=str(d[k])});
  if(d.tvaOn!==undefined)o.tvaOn=!!d.tvaOn;if(d.rembourse)o.rembourse=true;
  return o;
}
function cleanDB(o){
  if(!o||typeof o!=='object')throw new Error('format');
  const d=blank();
  if(o.profile&&typeof o.profile==='object'){const p=Object.assign(defaultsProfile(),{});Object.keys(o.profile).forEach(k=>{const v=o.profile[k];if(['outils'].includes(k))p.outils=Array.isArray(v)?v.filter(x=>OUTILS.some(t=>t.id===x)):[];else if(k==='usage')p.usage=v&&typeof v==='object'?{m:str(v.m).slice(0,7),n:num(v.n)}:null;else if(typeof v==='boolean')p[k]=v;else p[k]=str(v)});p.logo=safeImg(o.profile.logo);p.delai=Math.max(0,Math.min(60,num(p.delai)||30));d.profile=p}
  d.clients=(Array.isArray(o.clients)?o.clients:[]).map(cleanClient).filter(Boolean);
  d.catalogue=(Array.isArray(o.catalogue)?o.catalogue:[]).filter(i=>i&&ID_RE.test(i.id||'')).map(i=>({id:i.id,d:str(i.d),pu:num(i.pu),u:str(i.u),tva:TAUX_TVA.includes(num(i.tva))?num(i.tva):20}));
  d.docs=(Array.isArray(o.docs)?o.docs:[]).map(cleanDoc).filter(Boolean);
  if(o.seq&&typeof o.seq==='object')Object.keys(o.seq).forEach(k=>{if(/^[FDA]-\d{4}$/.test(k))d.seq[k]=Math.max(0,Math.floor(num(o.seq[k])))});
  d.journal=(Array.isArray(o.journal)?o.journal:[]).slice(-300).map(j=>({t:str(j&&j.t),x:str(j&&j.x)}));
  if(o.snooze&&typeof o.snooze==='object')Object.keys(o.snooze).forEach(k=>{if(isoOk(o.snooze[k])||o.snooze[k]==='9999-12-31')d.snooze[str(k).slice(0,80)]=o.snooze[k]});
  if(o.meta&&typeof o.meta==='object')d.meta={lastBackup:isoOk(o.meta.lastBackup)||'',startHidden:!!o.meta.startHidden,uid:/^[0-9a-f-]{36}$/.test(o.meta.uid||'')?o.meta.uid:''};
  if(o.sec&&typeof o.sec==='object'&&/^[0-9a-f]{32,128}$/.test(o.sec.hash||'')&&/^[0-9a-f]{16,64}$/.test(o.sec.salt||''))d.sec={hash:o.sec.hash,salt:o.sec.salt,iter:Math.max(100000,Math.floor(num(o.sec.iter)))};
  return d;
}
function load(){
  try{const raw=localStorage.getItem(KEY);if(raw){DB=cleanDB(JSON.parse(raw));}}catch(e){DB=blank()}
  if(!DB.profile){try{const old=JSON.parse(localStorage.getItem('tampon.profil.v2')||'null');if(old&&old.prenom){delete old.test;DB.profile=cleanDB({profile:old}).profile}}catch(e){}}
  try{localStorage.removeItem('tampon.profil.v2');localStorage.removeItem('tampon.donnees.v1')}catch(e){}
  if(DB.profile&&!DB.profile.plan){DB.profile.plan='essai';DB.profile.trialStart=iso(today())}
  if(DB.profile)save();
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(DB));if(typeof cloudQueue==='function')cloudQueue();return true}
  catch(e){toast('Mémoire de l’appareil pleine : supprimez des photos de justificatifs ou faites une sauvegarde.');return false}
}
function log(x){DB.journal.push({t:new Date().toISOString(),x});if(DB.journal.length>300)DB.journal.shift();save()}
const P=()=>DB.profile;

/* =====================================================================
   Référentiels
   ===================================================================== */
const PAYS=[{id:'FR',nom:'France'},{id:'BE',nom:'Belgique',off:1},{id:'CH',nom:'Suisse',off:1},{id:'LU',nom:'Luxembourg',off:1},{id:'CA',nom:'Canada (Québec)',off:1}];
const STATUTS=[{id:'micro',nom:'Auto-entrepreneur',info:'Micro-entreprise'},{id:'ei',nom:'Entreprise individuelle',info:'À mon nom, au réel'},{id:'societe',nom:'Société',info:'SARL, EURL, SAS, SASU…'},{id:'nsp',nom:'Je ne sais pas',info:'Tampon vous aidera à le retrouver'}];
const METIERS=[{id:'artisan',nom:'Artisan ou bâtiment'},{id:'commerce',nom:'Commerce'},{id:'services',nom:'Services'},{id:'conseil',nom:'Conseil ou profession libérale'},{id:'immo',nom:'Immobilier'},{id:'resto',nom:'Restauration'},{id:'autre',nom:'Autre'}];
const TVA=[{id:'oui',nom:'Oui',info:'Mes factures affichent un montant HT et TTC'},{id:'non',nom:'Non',info:'J’écris « TVA non applicable » sur mes factures'},{id:'nsp',nom:'Je ne sais pas'}];
const OUTILS=[{id:'mail',nom:'Mes emails',info:'Gmail ou Outlook'},{id:'agenda',nom:'Mon agenda',info:'Google Agenda ou Outlook'},{id:'docs',nom:'Mes documents',info:'Google Drive ou OneDrive'},{id:'banque',nom:'Mon compte bancaire',info:'Pour voir qui a payé. Aucun virement possible.'}];
const ACTIVITES_URSSAF=[
  {id:'vente',nom:'Vente de marchandises (BIC)',taux:12.3,plafond:203100},
  {id:'bic',nom:'Prestations commerciales ou artisanales (BIC)',taux:21.2,plafond:83600},
  {id:'bnc',nom:'Autres prestations de services (BNC)',taux:25.6,plafond:83600},
  {id:'cipav',nom:'Profession libérale réglementée (Cipav)',taux:23.2,plafond:83600},
];
const ACRE=[{id:'non',nom:'Non',k:1},{id:'avant',nom:'Oui, créée avant le 1er juillet 2026',k:.5},{id:'apres',nom:'Oui, créée à partir du 1er juillet 2026',k:.75}];
const TAUX_TVA=[20,10,5.5,2.1,0];
const NATURES=[{id:'PS',nom:'Prestation de services'},{id:'LB',nom:'Livraison de biens'},{id:'LBPS',nom:'Les deux'}];
const MODES=['Virement','Carte bancaire','Chèque','Espèces','Autre'];
const CATS=['Achats et fournitures','Matériel','Carburant et déplacements','Repas','Sous-traitance','Assurance','Téléphone et internet','Autre'];
const nomDe=(l,id)=>(l.find(x=>x.id===id)||{}).nom||'';
const activiteDefaut=m=>({artisan:'bic',commerce:'vente',resto:'vente',services:'bnc',conseil:'bnc',immo:'bnc'}[m]||'bic');
function defaultsProfile(){return {plan:'',trialStart:'',usage:null,pays:'FR',outils:[],delai:30,urssafPer:'trimestrielle',acre:'non',debits:false,pa:'',paStatut:'non',adresse:'',cp:'',ville:'',nom:'',iban:'',bic:'',decAssureur:'',decContrat:'',decZone:'',logo:'',piedPage:'',activite:''}}

/* Identifiants */
function luhn(s){let sum=0;for(let i=0;i<s.length;i++){let d=+s[s.length-1-i];if(i%2){d*=2;if(d>9)d-=9}sum+=d}return sum%10===0}
const siretOk=s=>{s=String(s||'').replace(/\s/g,'');return /^\d{14}$/.test(s)&&luhn(s)};
const sirenOk=s=>{s=String(s||'').replace(/\s/g,'');return /^\d{9}$/.test(s)&&luhn(s)};
const fmtSiret=s=>{const d=String(s||'').replace(/\D/g,'').slice(0,14);return [d.slice(0,3),d.slice(3,6),d.slice(6,9),d.slice(9)].filter(Boolean).join(' ')};
const fmtSiren=s=>{const d=String(s||'').replace(/\D/g,'').slice(0,9);return [d.slice(0,3),d.slice(3,6),d.slice(6,9)].filter(Boolean).join(' ')};
const sirenOf=siret=>String(siret||'').replace(/\D/g,'').slice(0,9);
function tvaIntra(siren){siren=String(siren||'').replace(/\D/g,'');if(siren.length!==9)return '';const k=(12+3*(Number(siren)%97))%97;return 'FR'+String(k).padStart(2,'0')+siren}
const ibanClean=s=>String(s||'').replace(/\s/g,'').toUpperCase();
function ibanOk(s){s=ibanClean(s);if(!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s))return false;const r=(s.slice(4)+s.slice(0,4)).replace(/[A-Z]/g,c=>c.charCodeAt(0)-55);let m=0;for(const ch of r)m=(m*10+ +ch)%97;return m===1}
const fmtIban=s=>ibanClean(s).replace(/(.{4})/g,'$1 ').trim();

/* Profil : informations dérivées */
const isMicroLike=p=>p.statut==='micro'||p.statut==='ei'||p.statut==='nsp';
const avecTVA=p=>p.tva==='oui';
function nomLegal(p){const base=(p.statut==='societe')?(p.entreprise||''):[p.prenom,p.nom].filter(Boolean).join(' ');return base}
function vendeur(p){
  const ei=p.statut==='micro'||p.statut==='ei';
  return {
    nomAffiche:p.entreprise||nomLegal(p),
    nomLegal:nomLegal(p)+(ei?' EI':''),
    adresse:p.adresse,cp:p.cp,ville:p.ville,
    siret:p.siret,siren:sirenOf(p.siret),
    tvaIntra:avecTVA(p)?tvaIntra(sirenOf(p.siret)):'',
    email:p.email,tel:p.tel||''
  };
}
function sellerMissing(p){
  const m=[];
  if(!p.adresse||!p.cp||!p.ville)m.push({k:'adresse',t:'votre adresse'});
  if(!siretOk(p.siret))m.push({k:'siret',t:'votre numéro SIRET'});
  if(p.statut!=='societe'&&!p.nom)m.push({k:'nom',t:'votre nom de famille (pour la mention « EI »)'});
  return m;
}
function clientMissing(c){
  const m=[];if(!c){m.push('le client');return m}
  if(!c.nom)m.push('le nom du client');
  if(!c.adresse||!c.cp||!c.ville)m.push('l’adresse du client');
  if(c.type==='pro'&&!sirenOk(c.siren))m.push('le SIREN du client (obligatoire pour un client professionnel)');
  return m;
}

/* =====================================================================
   Calculs des documents
   ===================================================================== */
const docBy=id=>DB.docs.find(d=>d.id===id);
const clientBy=id=>DB.clients.find(c=>c.id===id);
const docClient=d=>d.clientSnap||clientBy(d.clientId)||null;
const TYPES={facture:'Facture',devis:'Devis',avoir:'Avoir',recue:'Facture reçue'};
function totals(d){
  if(d.type==='recue')return {ht:r2((d.ttc||0)-(d.tvaAmt||0)),tva:r2(d.tvaAmt||0),ttc:r2(d.ttc||0),parTaux:[]};
  const tvaOn=d.tvaOn!==undefined?d.tvaOn:avecTVA(P());
  const parTaux={};let ht=0;
  (d.lignes||[]).forEach(l=>{const lt=r2((+l.q||0)*(+l.pu||0));ht+=lt;const t=tvaOn?(+l.tva||0):0;parTaux[t]=(parTaux[t]||0)+lt});
  ht=r2(ht);let tva=0;const arr=Object.keys(parTaux).map(t=>{const base=r2(parTaux[t]);const m=r2(base*(+t)/100);tva+=m;return {taux:+t,base,montant:m}}).sort((a,b)=>b.taux-a.taux);
  tva=r2(tva);return {ht,tva,ttc:r2(ht+tva),parTaux:arr,tvaOn};
}
const numOf=d=>d.num||'Brouillon';
const titleOf=d=>`${TYPES[d.type]} ${d.type==='recue'?(d.fournisseur||''):numOf(d)}`.trim();
function nextNum(type,dateIso){
  const p={facture:'F',devis:'D',avoir:'A'}[type];const y=(dateIso||iso(today())).slice(0,4);const k=p+'-'+y;
  DB.seq[k]=(DB.seq[k]||0)+1;return `${k}-${String(DB.seq[k]).padStart(3,'0')}`;
}
function statutOf(d){
  if(d.type==='recue')return d.paye?'Payée':'À payer';
  if(!d.num)return 'Brouillon';
  if(d.type==='facture'){
    if(d.annulee)return 'Annulée';
    if(d.paid)return 'Payée';
    const late=daysBetween(d.ech,iso(today()));
    if(late>0)return (d.relances||[]).length?'Relancée':'En retard';
    return 'Envoyée';
  }
  if(d.type==='devis')return d.accepte?'Accepté':d.refuse?'Refusé':(d.ech&&daysBetween(d.ech,iso(today()))>0?'Expiré':'Envoyé');
  if(d.type==='avoir')return 'Émis';
  return '';
}
const CHIP={'Payée':'ok','Envoyée':'mute','Envoyé':'mute','Brouillon':'mute','En retard':'bad','Relancée':'warn','Accepté':'ok','Refusé':'bad','Expiré':'warn','Annulée':'mute','Émis':'mute','À payer':'warn'};
function dueAmount(d){if(d.type!=='facture'||!d.num||d.paid||d.annulee)return 0;return totals(d).ttc}

/* =====================================================================
   URSSAF et échéances
   ===================================================================== */
function activite(p){return ACTIVITES_URSSAF.find(a=>a.id===(p.activite||activiteDefaut(p.metier)))||ACTIVITES_URSSAF[1]}
function tauxURSSAF(p){const a=activite(p);const k=(ACRE.find(x=>x.id===p.acre)||ACRE[0]).k;return r2(a.taux*k)}
/* Chiffre d'affaires encaissé (HT) entre deux dates incluses */
function caEncaisse(from,to){
  let s=0;DB.docs.forEach(d=>{
    if(d.type==='facture'&&d.paid&&d.paid.date>=from&&d.paid.date<=to)s+=totals(d).ht;
    if(d.type==='avoir'&&d.num&&d.rembourse&&d.date>=from&&d.date<=to)s-=totals(d).ht;
  });return r2(s);
}
function periodeCourante(p){
  const t=today();const y=t.getFullYear(),m=t.getMonth();
  if(p.urssafPer==='mensuelle')return {from:iso(new Date(y,m,1)),to:iso(new Date(y,m+1,0)),label:MOISL[m]+' '+y};
  const q=Math.floor(m/3);return {from:iso(new Date(y,q*3,1)),to:iso(new Date(y,q*3+3,0)),label:`${q+1}${q?'e':'er'} trimestre ${y}`};
}
function periodeADeclarer(p){
  // période terminée dont la déclaration est due prochainement
  const t=today();const y=t.getFullYear(),m=t.getMonth();
  if(p.urssafPer==='mensuelle'){const s=new Date(y,m-1,1),e=new Date(y,m,0);return {from:iso(s),to:iso(e),due:iso(new Date(y,m+1,0)),label:MOISL[s.getMonth()]+' '+s.getFullYear()}}
  const q=Math.floor(m/3);const sq=new Date(y,q*3-3,1),eq=new Date(y,q*3,0);const qq=Math.floor(sq.getMonth()/3)+1;
  return {from:iso(sq),to:iso(eq),due:iso(new Date(eq.getFullYear(),eq.getMonth()+2,0)),label:`${qq}${qq>1?'e':'er'} trimestre ${sq.getFullYear()}`};
}
function echeances(p){
  const now=today();const y=now.getFullYear();const out=[];const micro=p.statut==='micro'||p.statut==='nsp';
  if(micro){
    if(p.urssafPer==='mensuelle'){for(let k=0;k<3;k++){const d=new Date(y,now.getMonth()+k+1,0);const mp=new Date(d.getFullYear(),d.getMonth()-1,1);out.push({d,t:'Déclarer votre chiffre d’affaires',s:'URSSAF, pour '+MOISL[mp.getMonth()]})}}
    else{[[y,0],[y,3],[y,6],[y,9],[y+1,0],[y+1,3]].forEach(([yy,m])=>out.push({d:new Date(yy,m+1,0),t:'Déclarer votre chiffre d’affaires',s:'URSSAF, pour les 3 derniers mois'}))}
  }else out.push({d:new Date(y+1,4,20),t:'Faire votre bilan de l’année',s:'Avec votre comptable'});
  out.push({d:new Date(y,11,15),t:'Payer la CFE',s:'L’impôt local des entreprises'});out.push({d:new Date(y+1,11,15),t:'Payer la CFE',s:'L’impôt local des entreprises'});
  if(avecTVA(p)){out.push({d:new Date(y,6,24),t:'Payer un acompte de TVA',s:'Si vous êtes au régime simplifié'});out.push({d:new Date(y,11,24),t:'Payer un acompte de TVA',s:'Si vous êtes au régime simplifié'});out.push({d:new Date(y+1,6,24),t:'Payer un acompte de TVA',s:'Si vous êtes au régime simplifié'})}
  const reform=new Date(2027,8,1);if(reform>=now)out.push({d:reform,t:'Facture électronique obligatoire à l’émission',s:'Vos factures devront passer par une plateforme agréée'});
  now.setHours(0,0,0,0);
  return out.filter(e=>e.d>=now).sort((a,b)=>a.d-b.d).slice(0,4).map(e=>({...e,j:Math.round((e.d-now)/864e5)}));
}
const dansJ=j=>j===0?'aujourd’hui':j===1?'demain':j<60?`dans ${j} jours`:`dans ${Math.round(j/30)} mois`;

/* =====================================================================
   Formules et essai
   ===================================================================== */
const TRIAL_DAYS=14;
const PLANS=[
  {id:'decouverte',nom:'Découverte',prix:0,asks:20,f:[],pts:['Factures et devis conformes','Rappels des dates limites','Export comptable','20 demandes par mois à l’assistant']},
  {id:'essentiel',nom:'Essentiel',prix:12,asks:300,f:['relances','urssaf','facturx'],pts:['Tout Découverte','Relances prêtes à envoyer','Estimation URSSAF','Facture électronique Factur-X','300 demandes par mois à l’assistant']},
  {id:'complet',nom:'Complet',prix:25,asks:1000,f:['relances','urssaf','facturx','outils'],pts:['Tout Essentiel','Assistant branché sur vos emails, agenda et banque (bientôt)','Installation avec vous','1 000 demandes par mois à l’assistant']},
];
function trialLeft(p){if(!p||p.plan!=='essai')return -1;return Math.max(0,TRIAL_DAYS-daysBetween(p.trialStart||iso(today()),iso(today())))}
function planId(p){if(!p)return 'decouverte';if(p.plan==='essai')return trialLeft(p)>0?'complet':'decouverte';return PLANS.some(x=>x.id===p.plan)?p.plan:'decouverte'}
const planOf=p=>PLANS.find(x=>x.id===planId(p));
const can=f=>planOf(P()).f.includes(f);
const monthKey=()=>iso(today()).slice(0,7);
const asksUsed=p=>p.usage&&p.usage.m===monthKey()?p.usage.n:0;

/* =====================================================================
   Questionnaire : une question par écran
   ===================================================================== */
const QS=[
  {id:'pays',type:'choice',list:PAYS,h:'Où se trouve votre entreprise ?',help:'Pour l’instant, Tampon fonctionne en France. Les autres pays arrivent bientôt.'},
  {id:'prenom',type:'text',h:'Comment vous appelez-vous ?',help:'Votre prénom.',ph:'Prénom',ac:'given-name',req:'Écrivez votre prénom pour continuer.'},
  {id:'nom',type:'text',h:a=>`Et votre nom de famille, ${a.prenom} ?`,help:'Il apparaît sur vos factures, à côté de la mention « EI » si vous êtes entrepreneur individuel.',ph:'Nom',ac:'family-name'},
  {id:'entreprise',type:'text',h:'Comment s’appelle votre entreprise ?',help:'Le nom que vos clients connaissent. Si vous n’en avez pas, écrivez votre nom.',ph:'Nom de l’entreprise',ac:'organization',req:'Écrivez le nom de votre entreprise pour continuer.'},
  {id:'statut',type:'choice',list:STATUTS,h:'Quel est votre statut ?'},
  {id:'metier',type:'choice',list:METIERS,h:'Que fait votre entreprise ?'},
  {id:'tva',type:'choice',list:TVA,h:'Ajoutez-vous la TVA sur vos factures ?',help:'Si vous êtes auto-entrepreneur et que vous débutez, c’est souvent « Non ».'},
  {id:'siret',type:'siret',h:'Quel est votre numéro SIRET ?',help:'14 chiffres. Il est sur votre extrait Kbis ou votre avis de situation INSEE. Il est obligatoire sur vos factures.',ph:'123 456 789 00012',skip:'Je l’ajouterai plus tard'},
  {id:'adresse',type:'adresse',h:'Quelle est l’adresse de votre entreprise ?',help:'Elle est obligatoire sur vos factures.',skip:'Je l’ajouterai plus tard'},
  {id:'email',type:'email',h:'Quelle adresse email utilisez-vous pour le travail ?',help:'Tampon s’en sert pour signer vos messages et sur vos factures.',ph:'vous@entreprise.fr',ac:'email'},
  {id:'outils',type:'multi',list:OUTILS,h:'Que pourra utiliser Tampon pour vous aider ?',help:'Touchez pour cocher. Ces connexions arrivent bientôt ; vous pourrez changer d’avis à tout moment.'},
];
let qi=0,ans={};
function startQuiz(){ans=Object.assign(defaultsProfile(),P()?clone(P()):{});qi=0;renderQ()}
function renderQ(){
  const total=QS.length;const fin=qi>=total;
  $('#progBar').style.width=Math.round(Math.min(qi,total)/total*100)+'%';
  $('#progTxt').textContent=fin?'Terminé':`Question ${qi+1} sur ${total}`;
  $('#qBack').style.visibility=qi===0?'hidden':'visible';$('#qNext').hidden=false;
  if(fin){
    const finEssai=P()&&P().plan?null:fdate(addDays(iso(today()),TRIAL_DAYS));
    $('#qBody').innerHTML=`<div class="done-card"><span class="stampmark anim" aria-hidden="true">PRÊT</span><h1>C'est prêt, ${esc(ans.prenom)} !</h1><p class="help">Votre espace ${esc(ans.entreprise)} est créé.</p>${finEssai?`<div class="trial-badge">Formule Complet offerte jusqu’au ${esc(finEssai)}, sans carte bancaire</div>`:''}</div>`;
    if(!cloudUser()&&cloudAvailable()){
      $('#qBody').insertAdjacentHTML('beforeend',`<div class="panel" style="margin-top:8px;text-align:left"><b style="font-size:18px">Créez votre compte gratuit</b><p class="help" style="margin:0">Pour retrouver vos factures sur tous vos appareils et ne jamais les perdre.</p>
        <div class="fld"><label for="qMail">Email</label><input class="in" id="qMail" type="email" autocomplete="username" value="${esc(ans.email||'')}"></div>
        <div class="fld"><label for="qPwd">Mot de passe (8 caractères minimum)</label><input class="in" id="qPwd" type="password" autocomplete="new-password" minlength="8"></div>
        <span class="err" id="qErr" hidden></span><button class="link muted" type="button" id="qNoAcc" style="align-self:flex-start">Continuer sans compte (données sur cet appareil uniquement)</button></div>`);
      $('#qNext').textContent='Créer mon compte et ouvrir Tampon';$('#qNoAcc').onclick=()=>finishQuiz(false);
    }else $('#qNext').textContent='Ouvrir Tampon';
    $('#qFoot').style.justifyContent='center';$('#qBack').hidden=true;$('#qNext').focus({preventScroll:true});return;
  }
  $('#qFoot').style.justifyContent='';$('#qBack').hidden=false;
  const q=QS[qi];const h=typeof q.h==='function'?q.h(ans):q.h;let body='';
  if(q.type==='choice'||q.type==='multi'){
    body=q.list.map(o=>{const on=q.type==='multi'?ans.outils.includes(o.id):ans[q.id]===o.id;return `<button type="button" class="choice" data-v="${o.id}" aria-pressed="${on}" ${o.off?'disabled':''}><span class="tx"><b>${esc(o.nom)}</b>${o.info?`<span>${esc(o.info)}</span>`:''}</span>${o.off?'<span class="soon">Bientôt</span>':'<span class="ck"></span>'}</button>`}).join('');
  }else if(q.type==='adresse'){
    body=`<label for="qAdr" hidden>Rue</label><input class="big-in" id="qAdr" autocomplete="address-line1" placeholder="Numéro et rue" value="${esc(ans.adresse)}"><div style="display:grid;grid-template-columns:140px 1fr;gap:10px"><label for="qCp" hidden>Code postal</label><input class="big-in" id="qCp" inputmode="numeric" maxlength="5" autocomplete="postal-code" placeholder="Code postal" value="${esc(ans.cp)}"><label for="qVille" hidden>Ville</label><input class="big-in" id="qVille" autocomplete="address-level2" placeholder="Ville" value="${esc(ans.ville)}"></div><span class="err" id="qErr" hidden></span><button type="button" class="link" id="qSkip" style="align-self:flex-start">${esc(q.skip)}</button>`;
  }else{
    const type=q.type==='email'?'email':'text';
    body=`<label for="qIn" hidden>${esc(h)}</label><input class="big-in" id="qIn" type="${type}" ${q.type==='siret'?'inputmode="numeric" maxlength="17"':''} ${q.ac?`autocomplete="${q.ac}"`:''} placeholder="${esc(q.ph||'')}" value="${esc(q.type==='siret'?fmtSiret(ans.siret):ans[q.id]||'')}"><span class="err" id="qErr" hidden></span>${q.skip?`<button type="button" class="link" id="qSkip" style="align-self:flex-start">${esc(q.skip)}</button>`:''}`;
  }
  $('#qBody').innerHTML=`<h1>${esc(h)}</h1>${q.help?`<p class="help">${esc(q.help)}</p>`:''}<div class="body">${body}</div>`;
  $('#qNext').textContent='Continuer';$('#qNext').hidden=q.type==='choice';
  const inp=$('#qIn')||$('#qAdr');if(inp){inp.focus({preventScroll:true})}
  if(q.type==='siret')$('#qIn').addEventListener('input',e=>{e.target.value=fmtSiret(e.target.value)});
  const sk=$('#qSkip');if(sk)sk.addEventListener('click',()=>{qi++;renderQ()});
}
$('#qBody').addEventListener('click',e=>{
  const b=e.target.closest('.choice');if(!b||b.disabled)return;const q=QS[qi];
  if(q.type==='multi'){const i=ans.outils.indexOf(b.dataset.v);if(i>=0)ans.outils.splice(i,1);else ans.outils.push(b.dataset.v);b.setAttribute('aria-pressed',String(i<0));return}
  ans[q.id]=b.dataset.v;$$('#qBody .choice').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));
  setTimeout(()=>{qi++;renderQ()},220);
});
$('#qForm').addEventListener('submit',e=>{
  e.preventDefault();
  if(qi>=QS.length){const m=$('#qMail');if(m){const mail=m.value.trim(),pwd=$('#qPwd').value;const er=$('#qErr');
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)){er.textContent='Indiquez une adresse email valide.';er.hidden=false;return}
      if(pwd.length<8){er.textContent='Le mot de passe doit faire au moins 8 caractères.';er.hidden=false;return}
      finishQuiz({mail,pwd});return}
    finishQuiz(false);return}
  const q=QS[qi];const errBox=$('#qErr');const err=(m,el)=>{errBox.textContent=m;errBox.hidden=!m;if(el){el.classList.toggle('bad',!!m);if(m)el.focus()}};
  if(q.type==='adresse'){const a=$('#qAdr').value.trim(),c=$('#qCp').value.trim(),v=$('#qVille').value.trim();
    if((a||c||v)&&(!a||!/^\d{5}$/.test(c)||!v))return err('Complétez la rue, un code postal à 5 chiffres et la ville.',!a?$('#qAdr'):!/^\d{5}$/.test(c)?$('#qCp'):$('#qVille'));
    ans.adresse=a;ans.cp=c;ans.ville=v;qi++;return renderQ()}
  const inp=$('#qIn');
  if(inp){const v=inp.value.trim();
    if(q.req&&!v)return err(q.req,inp);
    if(q.type==='siret'&&v&&!siretOk(v))return err('Ce numéro ne semble pas correct. Vérifiez les 14 chiffres, ou ajoutez-le plus tard.',inp);
    if(q.type==='email'&&v&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))return err('Cette adresse email semble incomplète.',inp);
    ans[q.id]=q.type==='siret'?v.replace(/\s/g,''):v;
  }
  qi++;renderQ();
});
$('#qBack').addEventListener('click',()=>{if(qi>0){qi--;renderQ()}});

/* =====================================================================
   Ma journée : les tâches sont calculées à partir de vos données
   ===================================================================== */
const RELANCE_PALIERS=[7,15,30];
function computeTodo(){
  const p=P();const t=iso(today());const out=[];
  const snoozed=k=>DB.snooze[k]&&DB.snooze[k]>t;
  const miss=sellerMissing(p);
  if(miss.length)out.push({key:'setup',kind:'setup',urgent:0,why:'Obligatoire sur vos factures',title:'Complétez vos informations de facturation',note:'Il manque '+miss.map(m=>m.t).join(', ')+'.',acts:[['setup','Compléter maintenant',1]]});
  DB.docs.forEach(d=>{
    const c=docClient(d);const cn=c?c.nom:'un client';
    if(!d.num&&(d.type==='facture'||d.type==='devis')){
      out.push({key:'draft:'+d.id,kind:'draft',doc:d.id,why:'Brouillon à vérifier',title:`Envoyer ${d.type==='devis'?'le devis':'la facture'} de ${eur0(totals(d).ttc)} à ${cn}`,acts:[['open','Vérifier et envoyer',1],['later','Pas maintenant']]});
    }
    if(d.type==='facture'&&d.num&&!d.paid&&!d.annulee){
      const late=daysBetween(d.ech,t);const done=(d.relances||[]).length;let niveau=0;
      RELANCE_PALIERS.forEach((j,i)=>{if(late>=j)niveau=i+1});
      if(niveau>done){const k='rel:'+d.id+':'+niveau;const ok=can('relances');if(!snoozed(k))out.push({key:k,kind:'relance',doc:d.id,niveau,urgent:1,why:`Paiement en retard de ${late} jour${late>1?'s':''}`,title:`Relancer ${cn}, qui vous doit ${eur0(totals(d).ttc)}`,note:ok?'':'Les relances prêtes à envoyer sont incluses dans les formules Essentiel et Complet.',acts:ok?[['mail',niveau===1?'Voir la relance':niveau===2?'Voir la 2e relance':'Voir la relance finale',1],['paid','C’est payé'],['later','Pas maintenant']]:[['plans','Voir les formules',1],['paid','C’est payé'],['later','Pas maintenant']]})}
    }
    if(d.type==='devis'&&d.num&&!d.accepte&&!d.refuse){
      const since=daysBetween(d.date,t);const k='dev:'+d.id;
      if(since>=10&&!(d.relances||[]).length&&!snoozed(k))out.push({key:k,kind:'devis',doc:d.id,why:`Devis envoyé il y a ${since} jours, sans réponse`,title:`Relancer ${cn} pour le devis de ${eur0(totals(d).ttc)}`,acts:[can('relances')?['mail','Voir la relance',1]:['plans','Relance : voir les formules',1],['accept','Accepté'],['refuse','Refusé'],['later','Pas maintenant']]});
    }
  });
  if(p.statut==='micro'||p.statut==='nsp'){
    const per=periodeADeclarer(p);const j=daysBetween(t,per.due);const k='urssaf:'+per.to;
    if(j>=0&&j<=20&&!snoozed(k)){const ca=caEncaisse(per.from,per.to);out.push({key:k,kind:'urssaf',urgent:j<=7?1:0,why:`À faire avant le ${fdate(per.due)}`,title:`Déclarer ${eur0(ca)} de chiffre d’affaires à l’URSSAF`,note:`Période : ${per.label}. Montant encaissé d’après vos factures payées dans Tampon.${can('urssaf')?` Cotisations estimées : ${eur0(ca*tauxURSSAF(p)/100)}.`:''} Déclarez sur autoentrepreneur.urssaf.fr.`,acts:[['declared','C’est déclaré',1],['later','Pas maintenant']]})}
  }
  const nbDocs=DB.docs.filter(d=>d.num).length;const lb=DB.meta&&DB.meta.lastBackup;
  if(!cloudUser()&&nbDocs>=3&&(!lb||daysBetween(lb,t)>=30)&&!snoozed('backup'))out.push({key:'backup',kind:'setup',why:lb?`Dernière sauvegarde il y a ${daysBetween(lb,t)} jours`:'Aucune sauvegarde pour l’instant',title:'Mettez vos documents à l’abri',note:'Sans compte, vos factures ne sont que sur cet appareil. Créez un compte gratuit pour les garder en ligne, ou téléchargez une sauvegarde.',acts:[['account','Créer un compte',1],['backup','Télécharger une sauvegarde'],['later','Plus tard']]});
  if(t>='2026-09-01'&&p.paStatut!=='oui'&&!snoozed('pa'))out.push({key:'pa',kind:'pa',why:'Obligatoire depuis le 1er septembre 2026',title:'Choisissez votre plateforme agréée pour recevoir vos factures électroniques',note:'Toutes les entreprises doivent pouvoir recevoir des factures électroniques. Tampon vous aide à choisir et s’y connectera.',acts:[['einv','Voir comment faire',1],['later','Plus tard']]});
  return out;
}
function renderTrial(){
  const p=P();const left=trialLeft(p);let h='';
  if(p.plan==='essai'&&left>0)h=`<div class="trial ${left<=3?'end':''}"><div><b>Essai Complet : ${left} jour${left>1?'s':''} restant${left>1?'s':''}</b><span>Toutes les fonctions sont débloquées jusqu’au ${esc(fdate(addDays(p.trialStart,TRIAL_DAYS)))}.</span></div><button class="btn sm" type="button" data-goplans>Voir les formules</button></div>`;
  else if(p.plan==='essai')h=`<div class="trial end"><div><b>Votre essai est terminé</b><span>Vous êtes passé en Découverte. Choisissez une formule pour retrouver les relances, l’estimation URSSAF et Factur-X.</span></div><button class="btn sm" type="button" data-goplans>Choisir une formule</button></div>`;
  $('#trialBar').innerHTML=h;$('#trialBar').hidden=!h;
}
function renderDay(){
  const p=P();renderTrial();const now=new Date();const h=now.getHours();
  $('#hello').textContent=(h<18?'Bonjour ':'Bonsoir ')+p.prenom;
  const todo=computeTodo();const n=todo.length;
  const jour=now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  $('#helloSub').textContent=jour.charAt(0).toUpperCase()+jour.slice(1)+' · '+(n?`${n} chose${n>1?'s':''} à valider`:'rien à valider');
  $('#todoCount').textContent=n;$('#todoCount').hidden=!n;
  const hasDocs=DB.docs.some(d=>d.type!=='recue');
  $('#todo').innerHTML=n?todo.map(c=>`<article class="card ${c.urgent?'urgent':''} ${c.kind==='setup'||c.kind==='pa'?'info':''}" data-key="${esc(c.key)}"><div class="why"><span class="dot"></span>${esc(c.why)}</div><h3>${esc(c.title)}</h3>${c.note?`<p class="note">${esc(c.note)}</p>`:''}${c.doc?`<button type="button" class="docbtn" data-act="open">${ICON_DOC}<span>${esc(titleOf(docBy(c.doc)))}</span><span class="arr">›</span></button>`:''}<div class="acts">${c.acts.map(([k,l,pr])=>`<button class="btn ${pr?'primary':''}" type="button" data-act="${k}">${esc(l)}</button>`).join('')}</div></article>`).join('')
    :hasDocs?`<div class="allgood"><span class="stampmark" aria-hidden="true">OK</span>Tout est à jour. Profitez de votre soirée.</div>`
    :`<div class="empty"><b>Rien à valider pour l’instant.</b><span>Créez votre première facture ou votre premier devis, ou écrivez-le ci-dessus : « Fais une facture de 850 € pour M. Dupont ».</span><div class="row-btns" style="margin-top:8px"><button class="btn sm primary" type="button" data-new="facture">Nouvelle facture</button><button class="btn sm" type="button" data-new="devis">Nouveau devis</button></div></div>`;
  renderStart();
  renderMoney();
  $('#next').innerHTML=echeances(p).map(e=>`<div class="row"><div class="date"><b>${e.d.getDate()}</b><span>${MOIS[e.d.getMonth()]}</span></div><div class="tx"><b>${esc(e.t)}</b><span>${esc(e.s)}</span></div><span class="when ${e.j<=15?'soon':''}">${dansJ(e.j)}</span></div>`).join('');
  const j=DB.journal.slice(-40).reverse();
  $('#doneCount').textContent=j.length;
  $('#done').innerHTML=j.length?j.map(x=>{const d=new Date(x.t);return `<div class="row"><span class="t">${d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</span><span class="tx">${esc(x.x)}</span></div>`}).join(''):'<div class="row"><span class="tx">Rien pour l’instant.</span></div>';
  $('#ideas').innerHTML=['Fais une facture de 850 € pour M. Dupont','Fais un devis de 1 200 € pour Mme Durand, pose de parquet','Combien je dois mettre de côté pour l’URSSAF ?','Qui ne m’a pas payé ?'].map(s=>`<button type="button">${esc(s)}</button>`).join('');
}
function renderMoney(){
  const p=P();const y=today().getFullYear();
  const aEnc=DB.docs.reduce((s,d)=>s+dueAmount(d),0);
  const caAn=caEncaisse(y+'-01-01',y+'-12-31');
  const micro=p.statut==='micro'||p.statut==='nsp';
  const tiles=[];
  tiles.push(`<div class="tile"><div class="k">À encaisser</div><div class="v">${eur0(aEnc)}</div><div class="s">${DB.docs.filter(d=>dueAmount(d)>0).length} facture(s) en attente</div></div>`);
  if(micro){
    const per=periodeCourante(p);const ca=caEncaisse(per.from,per.to);const taux=tauxURSSAF(p);
    tiles.push(can('urssaf')?`<div class="tile"><div class="k">À mettre de côté pour l’URSSAF</div><div class="v">${eur0(ca*taux/100)}</div><div class="s">${taux.toString().replace('.',',')} % de ${eur0(ca)} encaissés, ${esc(per.label)}</div></div>`:`<div class="tile"><div class="k">À mettre de côté pour l’URSSAF</div><div class="v">—</div><div class="s">Inclus dans Essentiel et Complet. <button type="button" class="link" data-goplans style="padding:0;font-size:13.5px">Voir les formules</button></div></div>`);
    const a=activite(p);const pct=Math.min(100,caAn/a.plafond*100);
    tiles.push(`<div class="tile"><div class="k">Encaissé en ${y}</div><div class="v">${eur0(caAn)}</div><div class="s">Plafond micro : ${eur0(a.plafond)}</div><div class="gauge ${pct>80?'warn':''}"><i style="width:${pct.toFixed(1)}%"></i></div></div>`);
    $('#moneyNote').textContent='Estimation indicative pour '+a.nom.toLowerCase()+', hors contribution à la formation professionnelle et impôt. Réglez votre activité dans Réglages.';
  }else{
    tiles.push(`<div class="tile"><div class="k">Encaissé en ${y}</div><div class="v">${eur0(caAn)}</div><div class="s">Hors taxes, d’après vos factures payées</div></div>`);
    const fact=DB.docs.filter(d=>d.type==='facture'&&d.num&&d.date.startsWith(String(y))&&!d.annulee).reduce((s,d)=>s+totals(d).ht,0);
    tiles.push(`<div class="tile"><div class="k">Facturé en ${y}</div><div class="v">${eur0(fact)}</div><div class="s">Hors taxes</div></div>`);
    $('#moneyNote').textContent='';
  }
  $('#money').innerHTML=tiles.join('');
}
$('#todo').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const el=b.closest('.card');const key=el.dataset.key;const c=computeTodo().find(x=>x.key===key);if(!c)return;const d=c.doc&&docBy(c.doc);
  const a=b.dataset.act;
  if(a==='plans'){goPlans();return}
  if(a==='account'){authDialog('signup');return}
  if(a==='backup'){downloadBackup();renderDay();return}
  if(a==='later'){DB.snooze[key]=addDays(iso(today()),1);save();renderDay();toast('D’accord, je vous le remets demain');return}
  if(a==='setup'){location.hash='reglages';setTimeout(()=>{const s=document.getElementById('sec-entreprise');if(s)s.scrollIntoView({behavior:'smooth'})},80);return}
  if(a==='einv'){location.hash='reglages';setTimeout(()=>{const s=document.getElementById('sec-einv');if(s)s.scrollIntoView({behavior:'smooth'})},80);return}
  if(a==='open'){openDoc(d.id);return}
  if(a==='mail'){openMail(d.id,c.kind==='devis'?'devis':c.niveau);return}
  if(a==='paid'){askPaid(d.id);return}
  if(a==='accept'){acceptDevis(d.id);return}
  if(a==='refuse'){d.refuse=iso(today());log(`Devis ${d.num} refusé par ${docClient(d).nom}`);save();refresh();toast('Devis marqué comme refusé');return}
  if(a==='declared'){DB.snooze[key]='9999-12-31';log('Déclaration URSSAF faite ('+periodeADeclarer(P()).label+')');save();renderDay();toast('Noté. Prochain rappel à la prochaine période.');return}
});
document.addEventListener('click',e=>{const n=e.target.closest('[data-new]');if(n){newDoc(n.dataset.new)}});

/* =====================================================================
   Demander à Tampon (réponses simulées, en attendant la vraie IA)
   ===================================================================== */
function findOrCreateClient(nom){
  if(!nom)return null;const n=nom.trim();let c=DB.clients.find(x=>x.nom.toLowerCase()===n.toLowerCase());
  if(!c){c={id:uid(),type:/\b(sarl|sas|sasu|eurl|sci|sa|société|ste|ets|entreprise)\b/i.test(n)?'pro':'part',nom:n,adresse:'',cp:'',ville:'',email:'',siren:'',livraison:''};DB.clients.push(c)}
  return c;
}
function reply(q){
  const p=P(),l=q.toLowerCase();
  const amt=(q.match(/(\d[\d\s]*(?:[,.]\d+)?)\s*(?:€|euros?)/i)||[])[1];
  const who=((q.match(/pour\s+([^,!?]+)/i)||[])[1]||'').trim().replace(/\.$/,'')||null;
  if(/(factur|devis)/.test(l)&&amt){
    const type=/devis/.test(l)&&!/factur/.test(l)?'devis':'facture';const m=parseFloat(amt.replace(/\s/g,'').replace(',','.'));
    const objet=(q.match(/,\s*(.+)$/)||[])[1];const c=findOrCreateClient(who);
    const d=newDocData(type,c&&c.id);d.lignes=[{d:objet?objet.charAt(0).toUpperCase()+objet.slice(1):(type==='devis'?'Prestation':'Prestation'),q:1,u:'',pu:avecTVA(p)?r2(m/1.2):m,tva:20}];
    DB.docs.unshift(d);save();
    const miss=clientMissing(c);
    return {x:`J’ai préparé ${type==='devis'?'le devis':'la facture'} de ${eur0(m)}${who?' pour '+who:''}${avecTVA(p)?' TTC':''}.`+(miss.length?` Il me manque ${miss.join(', ')} : complétez-le avant l’envoi.`:' Vérifiez-le, puis envoyez-le.'),open:d.id,label:'Ouvrir le brouillon'};
  }
  if(/urssaf|cotis|côté|cote|charges/.test(l)){
    if(!(p.statut==='micro'||p.statut==='nsp'))return {x:'Les cotisations au réel dépendent de votre bénéfice : votre comptable les calcule. Je vous rappelle les dates limites.'};
    const per=periodeCourante(p);const ca=caEncaisse(per.from,per.to);const tx=tauxURSSAF(p);
    return {x:`Pour ${per.label}, vous avez encaissé ${eur0(ca)}. Avec un taux de ${String(tx).replace('.',',')} %, mettez de côté environ ${eur0(ca*tx/100)}. C’est une estimation, hors formation professionnelle et impôt.`};
  }
  if(/pay|relanc|doit|impay|argent/.test(l)){
    const due=DB.docs.filter(d=>dueAmount(d)>0);
    return {x:due.length?`${due.length} facture${due.length>1?'s':''} en attente de paiement : `+due.map(d=>`${d.num} (${docClient(d).nom}, ${eur0(totals(d).ttc)}${daysBetween(d.ech,iso(today()))>0?', en retard':''})`).join(' ; ')+'.':'Aucune facture envoyée n’attend de paiement. 👍'.replace(' 👍','')};
  }
  if(/chiffre|ca |gagné|encaiss/.test(l)){const y=today().getFullYear();return {x:`Vous avez encaissé ${eur0(caEncaisse(y+'-01-01',y+'-12-31'))} hors taxes depuis le 1er janvier.`}}
  if(/date|limite|déclar|declar|échéance|quand/.test(l)){const e=echeances(p)[0];return {x:e?`${e.t}, avant le ${e.d.getDate()} ${MOISL[e.d.getMonth()]} (${dansJ(e.j)}).`:'Aucune date limite proche.'}}
  if(/électronique|electronique|2027|factur-x|plateforme/.test(l))return {x:'Depuis le 1er septembre 2026, vous devez pouvoir recevoir des factures électroniques ; à partir du 1er septembre 2027, vous devrez aussi les émettre via une plateforme agréée. Tampon ajoute déjà les nouvelles mentions et produit vos factures au format Factur-X. Regardez la liste de contrôle dans Réglages.'};
  if(/rang|class|justif|ticket|reçu/.test(l))return {x:'Dans Documents, touchez « Scanner une facture reçue » et prenez la photo : je lis le fournisseur, la date, le montant et la TVA, vous vérifiez, puis vous enregistrez.'};
  if(/devis/.test(l))return {x:'Dites-moi pour qui, combien et pour quoi. Par exemple : « devis de 1 200 € pour Mme Durand, pose de parquet ».'};
  return {x:'Pour l’instant, je sais préparer une facture ou un devis, vous dire qui ne vous a pas payé, estimer vos cotisations URSSAF et donner vos prochaines dates limites. Bientôt, je pourrai aussi lire vos emails et votre banque.'};
}
let lastAnswer=null;
function ask(q){if(!q.trim())return;const p=P();const lim=planOf(p).asks;q=q.slice(0,500);
  if(asksUsed(p)>=lim)lastAnswer={x:`Vous avez utilisé vos ${lim} demandes à l’assistant ce mois-ci. Le compteur repart à zéro le 1er du mois prochain, ou passez à une formule supérieure. Le reste de Tampon fonctionne normalement.`,plans:true};
  else{p.usage={m:monthKey(),n:asksUsed(p)+1};save();lastAnswer=reply(q)}
  const _a=$('#answer');_a.hidden=false;_a.innerHTML=`<b>Tampon</b>${esc(lastAnswer.x)}${lastAnswer.open?` <button type="button" class="link" data-open-doc="${esc(lastAnswer.open)}">${esc(lastAnswer.label)}</button>`:''}${lastAnswer.plans?' <button type="button" class="link" data-goplans>Voir les formules</button>':''}`;renderDay();return;const a=$('#answer');a.hidden=false;a.innerHTML=`<b>Tampon</b>${esc(lastAnswer.x)}${lastAnswer.open?` <button type="button" class="link" data-open-doc="${lastAnswer.open}">${esc(lastAnswer.label)}</button>`:''}`;renderDay()}
$('#askForm').addEventListener('submit',e=>{e.preventDefault();const i=$('#askIn');ask(i.value);i.value=''});
$('#ideas').addEventListener('click',e=>{const b=e.target.closest('button');if(b)ask(b.textContent)});
document.addEventListener('click',e=>{const o=e.target.closest('[data-open-doc]');if(o)openDoc(o.dataset.openDoc)});

/* =====================================================================
   Documents
   ===================================================================== */
let docFilter='tout';
function renderDocs(){
  const F=[['tout','Tout'],['facture','Factures'],['devis','Devis'],['avoir','Avoirs'],['recue','Reçues'],['brouillon','Brouillons']];
  $('#docFilters').innerHTML=F.map(([k,l])=>`<button type="button" data-f="${k}" aria-pressed="${docFilter===k}">${l}</button>`).join('');
  const q=($('#docSearch').value||'').trim().toLowerCase();
  const list=DB.docs.filter(d=>docFilter==='tout'||(docFilter==='brouillon'?!d.num&&d.type!=='recue':d.type===docFilter)).filter(d=>{
    if(!q)return true;const c=docClient(d);const hay=[d.num,c&&c.nom,d.fournisseur,eur(totals(d).ttc),String(totals(d).ttc),(d.lignes||[]).map(l=>l.d).join(' ')].join(' ').toLowerCase();return hay.includes(q)});
  list.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.created||0)-(a.created||0));
  $('#docList').innerHTML=list.length?list.map(d=>{const T=totals(d);const c=docClient(d);const st=statutOf(d);const who=d.type==='recue'?(d.fournisseur||'Fournisseur'):(c?c.nom:'Client à choisir');
    return `<button type="button" class="drow" data-open-doc="${esc(d.id)}"><span class="dic ${esc(d.type)}">${{facture:'FAC',devis:'DEV',avoir:'AVO',recue:'REÇ'}[d.type]}</span><span class="tx"><b>${esc(d.type==='recue'?'Facture reçue':TYPES[d.type]+' '+numOf(d))}</b><span>${esc(who)} · ${esc(fdate(d.date))}</span></span><span class="amt"><b>${d.type==='avoir'?'-':''}${eur(T.ttc)}</b><span class="chip ${CHIP[st]||'mute'}">${esc(st)}</span></span></button>`}).join('')
    :`<div class="row"><span class="tx">${q?'Aucun résultat.':'Aucun document ici pour l’instant.'}</span></div>`;
}
$('#docFilters').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(b){docFilter=b.dataset.f;renderDocs()}});
$('#docSearch').addEventListener('input',renderDocs);

/* =====================================================================
   Clients
   ===================================================================== */
function renderClients(){
  const q=($('#cliSearch').value||'').trim().toLowerCase();
  const list=DB.clients.filter(c=>!q||[c.nom,c.ville,c.email,c.siren].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
  $('#cliList').innerHTML=list.length?list.map(c=>{const du=DB.docs.filter(d=>d.clientId===c.id).reduce((s,d)=>s+dueAmount(d),0);const miss=clientMissing(c);const ini=c.nom.split(/\s+/).filter(w=>!/^(m\.|mme|mr|m)$/i.test(w)).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';
    return `<button type="button" class="drow" data-client="${esc(c.id)}"><span class="avatar">${esc(ini)}</span><span class="tx"><b>${esc(c.nom)}</b><span>${c.type==='pro'?'Professionnel':'Particulier'}${c.ville?' · '+esc(c.ville):''}</span></span><span class="amt">${du?`<b>${eur0(du)} dû</b>`:''}${miss.length?'<span class="chip warn">À compléter</span>':''}</span></button>`}).join('')
    :`<div class="row"><span class="tx">${q?'Aucun résultat.':'Aucun client pour l’instant. Ils s’ajoutent aussi tout seuls quand vous créez une facture.'}</span></div>`;
}
$('#cliSearch').addEventListener('input',renderClients);
$('#cliList').addEventListener('click',e=>{const b=e.target.closest('[data-client]');if(b)clientDialog(b.dataset.client)});
$('#newClient').addEventListener('click',()=>clientDialog(null));

/* Petite fenêtre de dialogue réutilisable */
let dlgClose=null;
function dialog(html,onReady){const d=$('#dlg');$('#dlgBox').innerHTML=html;d.hidden=false;const f=$('#dlgBox').querySelector('input,select,textarea,button');if(f)f.focus();if(onReady)onReady($('#dlgBox'));dlgClose=null}
function closeDialog(){$('#dlg').hidden=true;$('#dlgBox').innerHTML='';if(dlgClose)dlgClose()}
$('#dlg').addEventListener('click',e=>{if(e.target.id==='dlg'||e.target.closest('[data-dlg-close]'))closeDialog()});
function confirmBox(title,text,okLabel,fn,danger){dialog(`<h2 id="dlgTitle">${esc(title)}</h2><p>${esc(text)}</p><div class="row-btns"><button class="btn ${danger?'danger':'primary'}" type="button" id="cfOk">${esc(okLabel)}</button><button class="btn" type="button" data-dlg-close>Annuler</button></div>`,box=>{box.querySelector('#cfOk').onclick=()=>{closeDialog();fn()}})}

function clientFormHTML(c){
  c=c||{type:'part',nom:'',adresse:'',cp:'',ville:'',email:'',siren:'',livraison:''};
  return `<div class="form">
    <div class="fld full"><span class="lbl">Type de client</span><div class="seg" id="cType"><button type="button" data-v="part" aria-pressed="${c.type!=='pro'}">Particulier</button><button type="button" data-v="pro" aria-pressed="${c.type==='pro'}">Professionnel</button></div></div>
    <div class="fld full"><label for="cNom">Nom ou raison sociale</label><input class="in" id="cNom" value="${esc(c.nom)}" autocomplete="off"></div>
    <div class="fld full" id="cSirenF" ${c.type==='pro'?'':'hidden'}><label for="cSiren">SIREN du client</label><input class="in mono" id="cSiren" inputmode="numeric" maxlength="11" value="${esc(fmtSiren(c.siren))}" placeholder="123 456 789"><span class="hint">9 chiffres. Obligatoire sur les factures aux professionnels depuis la réforme de la facture électronique.</span></div>
    <div class="fld full"><label for="cAdr">Adresse</label><input class="in" id="cAdr" value="${esc(c.adresse)}" autocomplete="off"></div>
    <div class="fld"><label for="cCp">Code postal</label><input class="in" id="cCp" inputmode="numeric" maxlength="5" value="${esc(c.cp)}"></div>
    <div class="fld"><label for="cVille">Ville</label><input class="in" id="cVille" value="${esc(c.ville)}"></div>
    <div class="fld full"><label for="cMail">Email</label><input class="in" id="cMail" type="email" value="${esc(c.email)}"></div>
    <div class="fld full"><label for="cLiv">Adresse de livraison ou de chantier, si différente</label><input class="in" id="cLiv" value="${esc(c.livraison)}" placeholder="Laisser vide si identique"></div>
  </div><span class="err" id="cErr" hidden></span>`;
}
function readClientForm(box,c){
  const type=box.querySelector('#cType [aria-pressed="true"]').dataset.v;
  const v=id=>box.querySelector(id).value.trim();
  const o={type,nom:v('#cNom'),adresse:v('#cAdr'),cp:v('#cCp'),ville:v('#cVille'),email:v('#cMail'),siren:v('#cSiren').replace(/\s/g,''),livraison:v('#cLiv')};
  const err=m=>{const e=box.querySelector('#cErr');e.textContent=m;e.hidden=!m;return null};
  if(!o.nom)return err('Indiquez le nom du client.');
  if(o.cp&&!/^\d{5}$/.test(o.cp))return err('Le code postal doit avoir 5 chiffres.');
  if(type==='pro'&&o.siren&&!sirenOk(o.siren))return err('Ce SIREN ne semble pas correct : vérifiez les 9 chiffres.');
  if(o.email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.email))return err('Cette adresse email semble incomplète.');
  return Object.assign(c||{id:uid()},o);
}
function wireClientForm(box){
  box.querySelector('#cType').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;box.querySelectorAll('#cType button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));box.querySelector('#cSirenF').hidden=b.dataset.v!=='pro'});
  box.querySelector('#cSiren').addEventListener('input',e=>{e.target.value=fmtSiren(e.target.value)});
}
function clientDialog(id,onSaved){
  const c=id?clientBy(id):null;
  const docs=c?DB.docs.filter(d=>d.clientId===c.id):[];const du=docs.reduce((s,d)=>s+dueAmount(d),0);
  const locked=docs.some(d=>d.num);
  dialog(`<h2 id="dlgTitle">${c?esc(c.nom):'Nouveau client'}</h2>${c?`<p class="fine" style="margin:0">${docs.length} document(s)${du?' · '+eur0(du)+' à encaisser':''}</p>`:''}${clientFormHTML(c)}
    <div class="row-btns"><button class="btn primary" type="button" id="cSave">Enregistrer</button>${c?`<button class="btn" type="button" id="cInv">Nouvelle facture</button>`:''}<button class="btn" type="button" data-dlg-close>Fermer</button>${c&&!locked?`<button class="link" type="button" id="cDel" style="color:var(--bad)">Supprimer ce client</button>`:''}</div>`,box=>{
    wireClientForm(box);
    box.querySelector('#cSave').onclick=()=>{const o=readClientForm(box,c);if(!o)return;if(!c)DB.clients.push(o);save();closeDialog();refresh();toast('Client enregistré');if(onSaved)onSaved(o)};
    const inv=box.querySelector('#cInv');if(inv)inv.onclick=()=>{closeDialog();newDoc('facture',c.id)};
    const del=box.querySelector('#cDel');if(del)del.onclick=()=>{DB.clients=DB.clients.filter(x=>x.id!==c.id);DB.docs=DB.docs.filter(d=>d.clientId!==c.id||d.num);save();closeDialog();refresh();toast('Client supprimé')};
  });
}

function goPlans(){if(!$('#viewer').hidden){$('#viewer').hidden=true;document.body.style.overflow='';V=null}if(!$('#dlg').hidden)closeDialog();location.hash='reglages';setTimeout(()=>{const s=document.getElementById('sec-formule');if(s)s.scrollIntoView({behavior:'smooth'})},80)}
document.addEventListener('click',e=>{if(e.target.closest('[data-goplans]'))goPlans()});

/* Pour bien démarrer */
function startItems(){
  const p=P();const docs=DB.docs.filter(d=>d.type!=='recue');
  return [
    {ok:sellerMissing(p).length===0,t:'Compléter vos informations de facturation (adresse, SIRET)',go:()=>{location.hash='reglages';setTimeout(()=>{const s=document.getElementById('sec-entreprise');if(s)s.scrollIntoView({behavior:'smooth'})},80)}},
    {ok:ibanOk(p.iban),t:'Ajouter votre IBAN pour être payé par virement',go:()=>{location.hash='reglages'}},
    {ok:!!safeImg(p.logo),t:'Ajouter votre logo',go:()=>{location.hash='reglages'}},
    {ok:DB.clients.length>0,t:'Ajouter votre premier client',go:()=>{location.hash='clients';setTimeout(()=>clientDialog(null),80)}},
    {ok:docs.length>0,t:'Créer votre premier devis ou votre première facture',go:()=>newDoc('facture')},
    {ok:!!cloudUser()||!!(DB.meta&&DB.meta.lastBackup),t:'Mettre vos données à l’abri avec un compte gratuit',go:()=>authDialog('signup')},
  ];
}
function renderStart(){
  const items=startItems();const done=items.filter(i=>i.ok).length;
  const show=!(DB.meta&&DB.meta.startHidden)&&done<items.length;
  $('#startSec').hidden=!show;if(!show)return;
  $('#start').innerHTML=`<p class="fine" style="margin:0 0 4px">${done} sur ${items.length} fait${done>1?'s':''}</p>`+items.map((i,k)=>`<div class="st ${i.ok?'ok':''}"><span class="ic">${i.ok?'✓':''}</span><span class="tx">${esc(i.t)}</span>${i.ok?'':`<button class="btn sm" type="button" data-start="${k}">Faire</button>`}</div>`).join('');
}
$('#start').addEventListener('click',e=>{const b=e.target.closest('[data-start]');if(b)startItems()[+b.dataset.start].go()});
$('#startHide').addEventListener('click',()=>{DB.meta=DB.meta||{};DB.meta.startHidden=true;save();renderDay()});

async function finishQuiz(acc){
  if(!ans.activite)ans.activite=activiteDefaut(ans.metier);if(!ans.plan){ans.plan='essai';ans.trialStart=iso(today())}
  DB.profile=clone(ans);save();if(!DB.journal.length)log('Espace Tampon créé');
  if(acc){$('#qNext').disabled=true;$('#qNext').textContent='Création du compte…';
    const r=await cloudSignUp(acc.mail,acc.pwd);$('#qNext').disabled=false;
    if(r.error){const er=$('#qErr');if(er){er.textContent=r.error;er.hidden=false}$('#qNext').textContent='Créer mon compte et ouvrir Tampon';return}
    if(r.confirm)toast('Compte créé : confirmez votre email avec le lien reçu pour activer la sauvegarde en ligne.');
  }
  if(cloudUser()){await refreshPlan();cloudQueue()}
  location.hash='journee';
}

/* =====================================================================
   Réglages
   ===================================================================== */
function renderSet(){
  const p=P();const v=vendeur(p);const micro=p.statut==='micro'||p.statut==='nsp';
  const opt=(list,val)=>list.map(o=>`<option value="${o.id}" ${o.id===val?'selected':''}>${esc(o.nom)}</option>`).join('');
  const proClients=DB.clients.filter(c=>c.type==='pro');const proOk=proClients.filter(c=>sirenOk(c.siren)).length;
  const checks=[
    [siretOk(p.siret),'Votre SIRET est renseigné et valide'],
    [!!(p.adresse&&p.cp&&p.ville),'Votre adresse est complète'],
    [!avecTVA(p)||!!v.tvaIntra,'Votre numéro de TVA intracommunautaire est calculé'],
    [!!ibanOk(p.iban),'Votre IBAN est renseigné (moyen de paiement sur la facture)'],
    [proClients.length===0||proOk===proClients.length,`SIREN renseigné pour vos clients professionnels (${proOk}/${proClients.length})`],
    [true,'Nature de l’opération, adresse de livraison et option sur les débits ajoutées sur chaque facture'],
    [true,'Factures produites au format Factur-X (PDF avec données intégrées)'],
    [p.paStatut==='oui','Plateforme agréée choisie (réception obligatoire depuis le 1er septembre 2026)'],
  ];
  const cur=planId(p);const left=trialLeft(p);const used=asksUsed(p);const lim=planOf(p).asks;
  const planCards=PLANS.map(pl=>{const isCur=cur===pl.id;let foot='';
    if(pl.id==='complet'&&p.plan==='essai'&&left>0)foot=`<span class="chip ok" style="align-self:flex-start">Essai en cours : ${left} jour${left>1?'s':''}</span><button class="btn sm primary" type="button" data-plan="complet">Garder Complet après l’essai</button>`;
    else if(isCur&&p.plan!=='essai')foot=`<span class="chip ok" style="align-self:flex-start">Votre formule</span>`;
    else if(isCur)foot=`<span class="chip warn" style="align-self:flex-start">Formule actuelle</span>`;
    else foot=`<button class="btn sm ${pl.id==='complet'?'primary':''}" type="button" data-plan="${pl.id}">Choisir ${esc(pl.nom)}</button>`;
    return `<div class="plan ${isCur?'cur':''}"><h3>${esc(pl.nom)}</h3><div class="amt">${pl.prix} €<small>${pl.prix?' HT / mois':' / mois'}</small></div><ul>${pl.pts.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><div class="foot">${foot}</div></div>`}).join('');
  const trialLine=p.plan==='essai'?(left>0?`<div class="trial ${left<=3?'end':''}"><div><b>Essai Complet : ${left} jour${left>1?'s':''} restant${left>1?'s':''}</b><span>Jusqu’au ${esc(fdate(addDays(p.trialStart,TRIAL_DAYS)))}. Ensuite, vous passez en Découverte, sauf si vous choisissez une formule.</span></div></div>`:`<div class="trial end"><div><b>Votre essai est terminé</b><span>Vous êtes en Découverte. Choisissez une formule pour retrouver toutes les fonctions.</span></div></div>`):'';
  $('#setRoot').innerHTML=`<h1>Réglages</h1>
  <section class="sec" id="sec-formule"><h2>Ma formule</h2><div style="display:flex;flex-direction:column;gap:12px">${trialLine}<div class="plans">${planCards}</div>
    <div class="tile"><div class="k">Demandes à l’assistant ce mois-ci</div><div class="v">${used} <small style="font-size:15px;color:var(--muted);font-weight:500">/ ${lim.toLocaleString('fr-FR')}</small></div><div class="gauge ${used/lim>.8?'warn':''}"><i style="width:${Math.min(100,used/lim*100).toFixed(1)}%"></i></div></div>
    ${p.statutPaiement==='active'||p.statutPaiement==='past_due'?'<div class="row-btns"><button class="btn sm" type="button" id="manageSub">Gérer mon abonnement</button></div>':''}<p class="fine" style="margin:0">${cloudUser()?'Paiement sécurisé par Stripe. Résiliable à tout moment.':'Phase de test : créez un compte pour choisir une formule. Sans compte, la formule choisie est activée sur cet appareil.'}</p></div></section>
  <section class="sec" id="sec-entreprise"><h2>Mon entreprise</h2><div class="panel"><div class="form">
    <div class="fld"><label for="sPrenom">Prénom</label><input class="in" id="sPrenom" value="${esc(p.prenom)}"></div>
    <div class="fld"><label for="sNom">Nom de famille</label><input class="in" id="sNom" value="${esc(p.nom)}"></div>
    <div class="fld full"><label for="sEnt">Nom de l’entreprise</label><input class="in" id="sEnt" value="${esc(p.entreprise)}"></div>
    <div class="fld"><label for="sStatut">Statut</label><select class="in" id="sStatut">${opt(STATUTS,p.statut)}</select></div>
    <div class="fld"><label for="sMetier">Activité</label><select class="in" id="sMetier">${opt(METIERS,p.metier)}</select></div>
    <div class="fld full"><label for="sSiret">SIRET</label><input class="in mono" id="sSiret" inputmode="numeric" maxlength="17" value="${esc(fmtSiret(p.siret))}"><span class="hint">${p.statut!=='societe'?'Sur vos factures : « '+esc(v.nomLegal)+' ».':''}</span></div>
    <div class="fld full"><label for="sAdr">Adresse</label><input class="in" id="sAdr" value="${esc(p.adresse)}"></div>
    <div class="fld"><label for="sCp">Code postal</label><input class="in" id="sCp" inputmode="numeric" maxlength="5" value="${esc(p.cp)}"></div>
    <div class="fld"><label for="sVille">Ville</label><input class="in" id="sVille" value="${esc(p.ville)}"></div>
    <div class="fld"><label for="sMail">Email</label><input class="in" id="sMail" type="email" value="${esc(p.email)}"></div>
    <div class="fld"><label for="sTel">Téléphone</label><input class="in" id="sTel" type="tel" value="${esc(p.tel||'')}"></div>
    <div class="fld full"><label for="sTva">TVA sur vos factures</label><select class="in" id="sTva">${opt(TVA,p.tva)}</select>${avecTVA(p)&&v.tvaIntra?`<span class="hint">Numéro de TVA intracommunautaire : <b class="mono">${esc(v.tvaIntra)}</b></span>`:''}</div>
    ${avecTVA(p)?`<label class="check full"><input type="checkbox" id="sDebits" ${p.debits?'checked':''}> J’ai opté pour le paiement de la TVA d’après les débits (la mention sera ajoutée sur vos factures)</label>`:''}
  </div><span class="err" id="sErr" hidden></span><div class="row-btns"><button class="btn primary" type="button" id="sSave">Enregistrer</button></div></div></section>

  <section class="sec"><h2>Sur mes factures</h2><div class="panel"><div class="form">
    <div class="fld full"><span class="lbl">Logo</span><div class="row-btns"><div class="logo-prev">${safeImg(p.logo)?`<img src="${esc(safeImg(p.logo))}" alt="Votre logo">`:'Aucun logo'}</div><div class="row-btns"><button class="btn sm" type="button" id="lUp">${p.logo?'Changer':'Ajouter un logo'}</button>${p.logo?'<button class="link" type="button" id="lDel" style="color:var(--bad)">Retirer</button>':''}</div></div></div>
    <div class="fld full"><label for="fIban">IBAN</label><input class="in mono" id="fIban" value="${esc(fmtIban(p.iban))}" placeholder="FR76 …"></div>
    <div class="fld"><label for="fBic">BIC</label><input class="in mono" id="fBic" value="${esc(p.bic||'')}"></div>
    <div class="fld"><label for="fDelai">Délai de paiement (jours)</label><input class="in" id="fDelai" type="number" min="0" max="60" value="${esc(p.delai??30)}"><span class="hint">60 jours maximum entre professionnels.</span></div>
    ${p.metier==='artisan'?`<div class="fld full"><span class="lbl">Assurance décennale</span><span class="hint">Obligatoire sur les devis et factures des travaux de bâtiment.</span></div>
    <div class="fld"><label for="fAss">Assureur</label><input class="in" id="fAss" value="${esc(p.decAssureur||'')}"></div>
    <div class="fld"><label for="fCtr">N° de contrat</label><input class="in" id="fCtr" value="${esc(p.decContrat||'')}"></div>
    <div class="fld full"><label for="fZone">Zone couverte</label><input class="in" id="fZone" value="${esc(p.decZone||'')}" placeholder="Ex. : France métropolitaine"></div>`:''}
    <div class="fld full"><label for="fPied">Texte libre en bas des factures (facultatif)</label><input class="in" id="fPied" value="${esc(p.piedPage||'')}" placeholder="Ex. : Merci pour votre confiance"></div>
  </div><span class="err" id="fErr" hidden></span><div class="row-btns"><button class="btn primary" type="button" id="fSave">Enregistrer</button></div></div></section>

  ${micro?`<section class="sec"><h2>URSSAF</h2><div class="panel"><div class="form">
    <div class="fld full"><label for="uAct">Activité déclarée</label><select class="in" id="uAct">${opt(ACTIVITES_URSSAF,activite(p).id)}</select><span class="hint">Taux appliqué : ${String(tauxURSSAF(p)).replace('.',',')} % du chiffre d’affaires encaissé.</span></div>
    <div class="fld"><label for="uPer">Déclaration</label><select class="in" id="uPer"><option value="trimestrielle" ${p.urssafPer!=='mensuelle'?'selected':''}>Tous les trimestres</option><option value="mensuelle" ${p.urssafPer==='mensuelle'?'selected':''}>Tous les mois</option></select></div>
    <div class="fld"><label for="uAcre">ACRE</label><select class="in" id="uAcre">${opt(ACRE,p.acre)}</select></div>
  </div><div class="row-btns"><button class="btn primary" type="button" id="uSave">Enregistrer</button></div></div></section>`:''}

  <section class="sec"><h2>Mes prestations et produits</h2><div class="panel"><p class="fine" style="margin:0">Vos prix habituels, pour remplir une facture en deux clics.</p>
    <div class="list" id="catList">${DB.catalogue.length?DB.catalogue.map(i=>`<div class="row"><div class="tx"><b>${esc(i.d)}</b><span>${eur(i.pu)} HT${i.u?' / '+esc(i.u):''}${avecTVA(p)?' · TVA '+String(i.tva).replace('.',',')+' %':''}</span></div><button class="link" type="button" data-cat-del="${esc(i.id)}" style="color:var(--bad)">Supprimer</button></div>`).join(''):'<div class="row"><span class="tx">Aucune prestation enregistrée.</span></div>'}</div>
    <div class="form"><div class="fld full"><label for="kD">Nouvelle prestation</label><input class="in" id="kD" placeholder="Ex. : Pose de parquet"></div><div class="fld"><label for="kPu">Prix HT</label><input class="in" id="kPu" type="number" step="0.01" min="0"></div><div class="fld"><label for="kU">Unité (facultatif)</label><input class="in" id="kU" placeholder="m², heure, pièce…"></div>${avecTVA(p)?`<div class="fld"><label for="kT">TVA</label><select class="in" id="kT">${TAUX_TVA.map(t=>`<option value="${t}">${String(t).replace('.',',')} %</option>`).join('')}</select></div>`:''}</div>
    <div class="row-btns"><button class="btn sm" type="button" id="kAdd">Ajouter</button></div></div></section>

  <section class="sec" id="sec-einv"><h2>Facture électronique 2026-2027</h2><div class="panel">
    <p>Depuis le 1er septembre 2026, toutes les entreprises doivent pouvoir <b>recevoir</b> des factures électroniques. À partir du 1er septembre 2027, les TPE et micro-entreprises devront aussi les <b>émettre</b>, en passant par une plateforme agréée par l’administration.</p>
    <ul class="check-list">${checks.map(([ok,t])=>`<li><span class="ic ${ok?'ok':'no'}">${ok?'✓':'!'}</span><span>${esc(t)}</span></li>`).join('')}</ul>
    <div class="form"><div class="fld"><label for="paSt">Plateforme agréée</label><select class="in" id="paSt"><option value="non" ${p.paStatut!=='oui'?'selected':''}>Je n’en ai pas encore</option><option value="oui" ${p.paStatut==='oui'?'selected':''}>J’en ai une</option></select></div><div class="fld"><label for="paNom">Laquelle ?</label><input class="in" id="paNom" value="${esc(p.pa||'')}" placeholder="Nom de la plateforme"></div></div>
    <p class="fine" style="margin:0">Votre banque ou votre logiciel de facturation actuel en propose souvent une. La liste officielle est sur impots.gouv.fr. Tampon se branchera sur la plateforme que vous choisissez pour envoyer vos factures.</p>
    <div class="row-btns"><button class="btn sm primary" type="button" id="paSave">Enregistrer</button></div></div></section>

  <section class="sec"><h2>Ce que Tampon pourra utiliser</h2><div class="list">${OUTILS.map(o=>{const on=(p.outils||[]).includes(o.id);return `<div class="row"><div class="tx"><b>${o.nom}</b><span>${o.info}</span></div><button class="switch" type="button" role="switch" aria-checked="${on}" aria-label="${o.nom}" data-tool="${esc(o.id)}"></button></div>`}).join('')}</div><p class="fine">Les connexions arrivent avec la formule Complet. Vos choix sont gardés en attendant.</p></section>

  <section class="sec" id="sec-secu"><h2>Sécurité</h2><div class="panel">
    <p>${DB.sec?'Tampon demande votre code à chaque ouverture, et après 5 minutes sans l’utiliser.':'Protégez l’accès à Tampon par un code, si quelqu’un prend votre téléphone ou votre ordinateur.'}</p>
    <div class="row-btns">${DB.sec?'<button class="btn sm" type="button" data-pin="lock">Verrouiller maintenant</button><button class="btn sm" type="button" data-pin="set">Changer le code</button><button class="btn sm danger" type="button" data-pin="off">Retirer le code</button>':'<button class="btn sm primary" type="button" data-pin="set">Créer un code</button>'}</div>
    <p class="fine" style="margin:0">Vos données restent sur cet appareil et ne sont envoyées à personne. Le code bloque l’accès à l’appli ; pour ne rien perdre, faites aussi des sauvegardes.</p></div></section>

  <section class="sec" id="sec-compte"><h2>Mon compte</h2><div class="panel" id="accountPanel"></div></section>

  <section class="sec"><h2>Mes données</h2><div class="panel"><p>${cloudUser()?'Vos données sont enregistrées en ligne dans votre compte, et gardées aussi sur cet appareil pour fonctionner sans réseau.':'Vos données sont gardées dans ce navigateur, sur cet appareil. Créez un compte pour les garder en ligne, ou faites une sauvegarde de temps en temps.'}${DB.meta&&DB.meta.lastBackup?` Dernière sauvegarde téléchargée : ${esc(fdate(DB.meta.lastBackup))}.`:''}</p>
    <div class="row-btns"><button class="btn sm" type="button" id="bkSave">Télécharger une sauvegarde</button><button class="btn sm" type="button" id="bkLoad">Restaurer une sauvegarde</button><button class="btn sm danger" type="button" id="wipe">Tout effacer</button></div></div></section>
  <p class="fine"><a href="#aide">Aide</a> · <a href="#mentions">Mentions légales</a> · <a href="#confidentialite">Confidentialité</a></p>`;
  renderAccount();
  const S=id=>$(id);const val=id=>S(id)?S(id).value.trim():'';
  S('#sSiret').addEventListener('input',e=>{e.target.value=fmtSiret(e.target.value)});
  S('#sSave').onclick=()=>{
    const err=m=>{S('#sErr').textContent=m;S('#sErr').hidden=!m};
    const siret=val('#sSiret').replace(/\s/g,'');
    if(siret&&!siretOk(siret))return err('Le SIRET ne semble pas correct : vérifiez les 14 chiffres.');
    if(val('#sCp')&&!/^\d{5}$/.test(val('#sCp')))return err('Le code postal doit avoir 5 chiffres.');
    if(!val('#sPrenom')||!val('#sEnt'))return err('Le prénom et le nom de l’entreprise sont nécessaires.');
    Object.assign(p,{prenom:val('#sPrenom'),nom:val('#sNom'),entreprise:val('#sEnt'),statut:val('#sStatut'),metier:val('#sMetier'),siret,adresse:val('#sAdr'),cp:val('#sCp'),ville:val('#sVille'),email:val('#sMail'),tel:val('#sTel'),tva:val('#sTva'),debits:S('#sDebits')?S('#sDebits').checked:p.debits});
    save();renderSet();toast('Informations enregistrées');
  };
  S('#fSave').onclick=()=>{
    const err=m=>{S('#fErr').textContent=m;S('#fErr').hidden=!m};
    const iban=ibanClean(val('#fIban'));if(iban&&!ibanOk(iban))return err('Cet IBAN ne semble pas correct : vérifiez-le.');
    const del=Math.max(0,Math.min(60,parseInt(val('#fDelai'))||0));
    Object.assign(p,{iban,bic:val('#fBic').toUpperCase(),delai:del,piedPage:val('#fPied')});
    if(S('#fAss'))Object.assign(p,{decAssureur:val('#fAss'),decContrat:val('#fCtr'),decZone:val('#fZone')});
    save();renderSet();toast('Enregistré');
  };
  S('#lUp').onclick=()=>$('#logoIn').click();
  if(S('#lDel'))S('#lDel').onclick=()=>{p.logo='';save();renderSet()};
  if(S('#uSave'))S('#uSave').onclick=()=>{Object.assign(p,{activite:val('#uAct'),urssafPer:val('#uPer'),acre:val('#uAcre')});save();renderSet();toast('Enregistré')};
  S('#kAdd').onclick=()=>{const d=val('#kD'),pu=parseFloat(val('#kPu'));if(!d||!(pu>=0)){toast('Indiquez un nom et un prix');return}DB.catalogue.push({id:uid(),d,pu:r2(pu),u:val('#kU'),tva:S('#kT')?+S('#kT').value:20});save();renderSet();toast('Prestation ajoutée')};
  S('#catList').addEventListener('click',e=>{const b=e.target.closest('[data-cat-del]');if(b){DB.catalogue=DB.catalogue.filter(i=>i.id!==b.dataset.catDel);save();renderSet()}});
  S('#paSave').onclick=()=>{p.paStatut=val('#paSt');p.pa=val('#paNom');save();renderSet();toast('Enregistré')};
  $$('#setRoot [data-tool]').forEach(b=>b.onclick=()=>{const o=p.outils||(p.outils=[]);const i=o.indexOf(b.dataset.tool);if(i>=0)o.splice(i,1);else o.push(b.dataset.tool);save();renderSet()});
  $$('#setRoot [data-plan]').forEach(b=>b.onclick=()=>{const pl=PLANS.find(x=>x.id===b.dataset.plan);
    const txt=pl.prix?`Le paiement en ligne arrive bientôt. Pendant la phase de test, la formule ${pl.nom} est activée gratuitement.`:(p.plan==='essai'&&trialLeft(p)>0?'Votre essai de la formule Complet s’arrête maintenant.':'Les relances, l’estimation URSSAF et Factur-X ne seront plus disponibles.');
    if(cloudUser())return choosePlanOnline(pl);
    confirmBox(`Passer en ${pl.nom} ?`,txt,`Choisir ${pl.nom}`,()=>{p.plan=pl.id;save();log(`Formule ${pl.nom} choisie`);renderSet();toast(`Formule ${pl.nom} activée`)})});
  $$('#setRoot [data-pin]').forEach(b=>b.onclick=()=>{const k=b.dataset.pin;if(k==='set')pinDialog();if(k==='lock')lockNow();if(k==='off')confirmBox('Retirer le code ?','Tampon s’ouvrira sans code sur cet appareil.','Retirer le code',()=>{DB.sec=null;save();renderSet();toast('Code retiré')},true)});
  if(S('#manageSub'))S('#manageSub').onclick=()=>openPortal();
  S('#bkSave').onclick=()=>{downloadBackup();renderSet()};
  S('#bkLoad').onclick=()=>$('#importIn').click();
  S('#wipe').onclick=()=>confirmBox('Tout effacer ?','Votre entreprise, vos clients et tous vos documents seront supprimés de cet appareil. Pensez à télécharger une sauvegarde avant.','Tout effacer',()=>{try{localStorage.removeItem(KEY);localStorage.removeItem('tampon.profil.v2');localStorage.removeItem('tampon.donnees.v1')}catch(e){}DB=blank();if(cloudUser())cloudSignOut(true);location.hash='accueil';toast('Tout est effacé de cet appareil')},true);
}
async function compressImage(file,max,q){
  const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
  const k=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',q);
}
$('#logoIn').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{P().logo=await compressImage(f,400,.85);save();renderSet();toast('Logo ajouté')}catch(err){toast('Cette image n’a pas pu être lue')}});
$('#importIn').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>25e6)throw 0;const o=cleanDB(JSON.parse(await f.text()));if(!o.profile||!o.profile.prenom)throw 0;confirmBox('Restaurer cette sauvegarde ?','Les données actuelles de cet appareil seront remplacées. Votre code de verrouillage actuel est conservé.','Restaurer',()=>{o.sec=DB.sec;DB=o;save();location.hash='journee';refresh();toast('Sauvegarde restaurée')})}catch(err){toast('Ce fichier n’est pas une sauvegarde Tampon')}});

/* =====================================================================
   Création et édition des factures, devis et avoirs
   ===================================================================== */
function newDocData(type,clientId){
  const p=P();const d=iso(today());
  return {id:uid(),type,num:null,created:Date.now(),clientId:clientId||null,date:d,ech:addDays(d,type==='devis'?30:(+p.delai||30)),nature:(p.metier==='commerce'||p.metier==='resto')?'LB':'PS',livraison:'',lignes:[],notes:'',relances:[]};
}
function newDoc(type,clientId){const d=newDocData(type,clientId);d.lignes=[{d:'',q:1,u:'',pu:0,tva:20}];DB.docs.unshift(d);save();openEditor(d.id,true)}

let V=null;// état de la visionneuse
function openViewer(title,tools,body){
  $('#vTitle').textContent=title;$('#vTools').innerHTML=tools||'';
  const nb=document.createElement('div');nb.id='vBody';nb.innerHTML=body;$('#vBody').replaceWith(nb);
  const v=$('#viewer');if(v.hidden){V&&(V.lastFocus=V.lastFocus||document.activeElement);v.hidden=false;document.body.style.overflow='hidden'}
  $('#vScroll').scrollTop=0;
}
function closeViewer(){
  if(V&&V.mode==='edit'){const d=docBy(V.id);if(d&&!d.num&&V.fresh&&!(d.lignes||[]).some(l=>l.d||+l.pu)){DB.docs=DB.docs.filter(x=>x.id!==d.id);save()}}
  $('#viewer').hidden=true;document.body.style.overflow='';const f=V&&V.lastFocus;V=null;refresh();if(f&&f.focus)f.focus();
}
$('#vClose').addEventListener('click',closeViewer);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#dlg').hidden)closeDialog();else if(!$('#viewer').hidden)closeViewer()}});

function openDoc(id){const d=docBy(id);if(!d)return;if(d.type==='recue')return openRecue(id);if(!d.num)return openEditor(id);openSheet(id)}

/* --- Éditeur --- */
function openEditor(id,fresh){
  const d=docBy(id);const p=P();V={mode:'edit',id,fresh:!!fresh,lastFocus:document.activeElement};
  const tvaOn=avecTVA(p);
  const cliOpts=`<option value="">Choisir un client…</option>`+DB.clients.slice().sort((a,b)=>a.nom.localeCompare(b.nom,'fr')).map(c=>`<option value="${esc(c.id)}" ${c.id===d.clientId?'selected':''}>${esc(c.nom)}</option>`).join('')+`<option value="__new">+ Nouveau client</option>`;
  const line=(l,i)=>`<div class="line ${tvaOn?'':'notva'}" data-i="${i}">
    <div class="fld f-desc"><label for="lD${i}">Désignation</label><input class="in" id="lD${i}" data-k="d" value="${esc(l.d)}" list="catNames"></div>
    <div class="fld"><label for="lQ${i}">Quantité</label><input class="in" id="lQ${i}" data-k="q" type="number" min="0" step="any" value="${l.q}"></div>
    <div class="fld"><label for="lP${i}">Prix unitaire HT</label><input class="in" id="lP${i}" data-k="pu" type="number" min="0" step="0.01" value="${l.pu}"></div>
    ${tvaOn?`<div class="fld f-tva"><label for="lT${i}">TVA</label><select class="in" id="lT${i}" data-k="tva">${TAUX_TVA.map(t=>`<option value="${t}" ${+l.tva===t?'selected':''}>${String(t).replace('.',',')} %</option>`).join('')}</select></div>`:''}
    <button type="button" class="del" data-del="${i}" aria-label="Supprimer la ligne">×</button></div>`;
  const body=`<div class="editor">
    <div class="form">
      <div class="fld full"><label for="eCli">Client</label><select class="in" id="eCli">${cliOpts}</select><span class="hint" id="eCliHint"></span></div>
      <div class="fld"><label for="eDate">Date</label><input class="in" id="eDate" type="date" value="${d.date}"></div>
      <div class="fld"><label for="eEch">${d.type==='devis'?'Valable jusqu’au':'À payer avant le'}</label><input class="in" id="eEch" type="date" value="${d.ech}"></div>
      ${d.type!=='devis'?`<div class="fld full"><span class="lbl">Nature de l’opération</span><div class="seg" id="eNat">${NATURES.map(n=>`<button type="button" data-v="${n.id}" aria-pressed="${d.nature===n.id}">${n.nom}</button>`).join('')}</div><span class="hint">Mention obligatoire depuis la réforme de la facture électronique.</span></div>`:''}
    </div>
    <h3>Lignes</h3>
    <datalist id="catNames">${DB.catalogue.map(i=>`<option value="${esc(i.d)}">`).join('')}</datalist>
    <div class="lines" id="eLines">${d.lignes.map(line).join('')}</div>
    <div class="row-btns"><button class="btn sm" type="button" id="eAdd">+ Ajouter une ligne</button>${DB.catalogue.length?`<select class="in" id="eCat" style="max-width:260px;min-height:42px"><option value="">Ajouter depuis mes prestations…</option>${DB.catalogue.map(i=>`<option value="${esc(i.id)}">${esc(i.d)} · ${eur(i.pu)}</option>`).join('')}</select>`:''}</div>
    <div class="tot-live" id="eTot"></div>
    <div class="fld"><label for="eNotes">Note pour le client (facultatif)</label><textarea class="in" id="eNotes" placeholder="Ex. : détail du chantier, conditions particulières">${esc(d.notes||'')}</textarea></div>
    <div class="vwarn" id="eWarn" hidden style="margin:0"></div>
    <div class="row-btns"><button class="btn primary" type="button" id="eFinal">${d.type==='devis'?'Finaliser le devis':'Finaliser la facture'}</button><button class="btn" type="button" id="eSave">Enregistrer le brouillon</button><button class="link" type="button" id="eDel" style="color:var(--bad)">Supprimer le brouillon</button></div>
    <p class="fine" style="margin:0">Une fois finalisée, ${d.type==='devis'?'le devis reçoit':'la facture reçoit'} son numéro définitif et ne peut plus être modifiée${d.type==='facture'?' (on fait alors un avoir)':''}.</p>
  </div>`;
  openViewer(`${TYPES[d.type]} · brouillon`,'',body);
  const B=$('#vBody');
  const read=()=>{
    d.clientId=B.querySelector('#eCli').value&&B.querySelector('#eCli').value!=='__new'?B.querySelector('#eCli').value:d.clientId;
    d.date=B.querySelector('#eDate').value||d.date;d.ech=B.querySelector('#eEch').value||d.ech;d.notes=B.querySelector('#eNotes').value.trim();
    const n=B.querySelector('#eNat [aria-pressed="true"]');if(n)d.nature=n.dataset.v;
    d.lignes=[...B.querySelectorAll('.line')].map(r=>{const g=k=>r.querySelector(`[data-k="${k}"]`);return {d:g('d').value.trim(),q:Math.max(0,parseFloat(g('q').value)||0),pu:Math.max(0,parseFloat(g('pu').value)||0),tva:g('tva')?+g('tva').value:20,u:''}});
  };
  const upd=()=>{read();const T=totals(d);B.querySelector('#eTot').innerHTML=tvaOn?`<span>Total HT ${eur(T.ht)} · TVA ${eur(T.tva)}</span><b>${eur(T.ttc)} TTC</b>`:`<b>${eur(T.ttc)}</b><span class="fine" style="margin:0">TVA non applicable, art. 293 B du CGI</span>`;
    const c=clientBy(d.clientId);const h=B.querySelector('#eCliHint');const m=c?clientMissing(c):[];h.innerHTML=c&&m.length?`<span style="color:var(--warn)">À compléter : ${esc(m.join(', '))}.</span> <button type="button" class="link" id="eCliEdit" style="padding:0">Compléter</button>`:c?`${c.type==='pro'?'Professionnel':'Particulier'}${c.ville?' · '+esc(c.ville):''} <button type="button" class="link" id="eCliEdit" style="padding:0 0 0 6px">Modifier</button>`:'';};
  upd();
  B.addEventListener('input',e=>{if(e.target.closest('.line')){const inp=e.target;if(inp.dataset.k==='d'){const it=DB.catalogue.find(i=>i.d===inp.value);if(it){const r=inp.closest('.line');r.querySelector('[data-k="pu"]').value=it.pu;const t=r.querySelector('[data-k="tva"]');if(t)t.value=it.tva}}}upd();save()});
  B.addEventListener('change',e=>{
    if(e.target.id==='eCli'&&e.target.value==='__new'){e.target.value=d.clientId||'';clientDialog(null,c=>{d.clientId=c.id;save();openEditor(d.id,V&&V.fresh)});return}
    if(e.target.id==='eCat'&&e.target.value){read();const it=DB.catalogue.find(i=>i.id===e.target.value);const empty=d.lignes.length===1&&!d.lignes[0].d&&!d.lignes[0].pu;const l={d:it.d+(it.u?` (${it.u})`:''),q:1,u:it.u,pu:it.pu,tva:it.tva};if(empty)d.lignes=[l];else d.lignes.push(l);save();openEditor(d.id,V.fresh);return}
    upd();save();
  });
  B.addEventListener('click',e=>{
    const n=e.target.closest('#eNat [data-v]');if(n){B.querySelectorAll('#eNat button').forEach(x=>x.setAttribute('aria-pressed',String(x===n)));upd();save();return}
    const del=e.target.closest('[data-del]');if(del){read();d.lignes.splice(+del.dataset.del,1);if(!d.lignes.length)d.lignes.push({d:'',q:1,u:'',pu:0,tva:20});save();openEditor(d.id,V.fresh);return}
    if(e.target.closest('#eCliEdit')){read();save();clientDialog(d.clientId,()=>openEditor(d.id,V&&V.fresh));return}
  });
  B.querySelector('#eAdd').onclick=()=>{read();d.lignes.push({d:'',q:1,u:'',pu:0,tva:20});save();openEditor(d.id,V.fresh);const all=$$('#eLines [data-k="d"]');all[all.length-1].focus()};
  B.querySelector('#eSave').onclick=()=>{read();save();V.fresh=false;closeViewer();toast('Brouillon enregistré')};
  B.querySelector('#eDel').onclick=()=>confirmBox('Supprimer ce brouillon ?','Il sera définitivement supprimé.','Supprimer',()=>{DB.docs=DB.docs.filter(x=>x.id!==d.id);save();V.fresh=false;closeViewer();toast('Brouillon supprimé')},true);
  B.querySelector('#eFinal').onclick=()=>{read();save();
    const probs=[];const c=clientBy(d.clientId);
    if(!c)probs.push('choisissez un client');else probs.push(...clientMissing(c).map(x=>'complétez '+x));
    if(!d.lignes.some(l=>l.d&&l.q>0))probs.push('ajoutez au moins une ligne avec une désignation et une quantité');
    if(d.lignes.some(l=>(l.q>0||l.pu>0)&&!l.d))probs.push('donnez une désignation à chaque ligne');
    if(d.type==='facture')probs.push(...sellerMissing(P()).map(m=>'ajoutez '+m.t+' dans Réglages'));
    const w=B.querySelector('#eWarn');
    if(probs.length){w.hidden=false;w.innerHTML=`Avant de finaliser :<ul>${probs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;w.scrollIntoView({behavior:'smooth',block:'center'});return}
    finalize(d);
  };
}
function finalize(d){
  const c=clientBy(d.clientId);
  d.lignes=d.lignes.filter(l=>l.d&&l.q>0);
  d.num=nextNum(d.type,d.date);d.clientSnap=clone(c);d.sellerSnap=Object.assign(vendeur(P()),{iban:P().iban,bic:P().bic,debits:avecTVA(P())&&P().debits,logo:P().logo,piedPage:P().piedPage,decAssureur:P().decAssureur,decContrat:P().decContrat,decZone:P().decZone,metier:P().metier,statut:P().statut});
  d.tvaOn=avecTVA(P());d.finalized=new Date().toISOString();
  log(`${TYPES[d.type]} ${d.num} finalisé${d.type==='facture'?'e':''} pour ${c.nom} (${eur0(totals(d).ttc)})`);save();
  if(V)V.fresh=false;openSheet(d.id);sendDialog(d);
}
function sendDialog(d){
  const c=docClient(d);const m=mailFor(d,'envoi');
  dialog(`<h2 id="dlgTitle">${esc(titleOf(d))} est ${d.type==='devis'?'prêt':'prête'}</h2>
    <p>Envoyez-${d.type==='devis'?'le':'la'} à ${esc(c.nom)}${c.email?` (<span class="mono">${esc(c.email)}</span>)`:''} : téléchargez le PDF, puis joignez-le à votre email avec le message ci-dessous.</p>
    <div class="row-btns"><button class="btn primary" type="button" id="sdPdf">Télécharger le PDF</button><button class="btn" type="button" id="sdCopy">Copier le message</button>${c.email?`<a class="btn" href="mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(m.objet)}&body=${encodeURIComponent(m.body)}">Ouvrir mon email</a>`:''}</div>
    <div class="mailv" style="margin:0"><dl><dt>Objet</dt><dd>${esc(m.objet)}</dd></dl><div class="mbody">${esc(m.body)}</div></div>
    <p class="fine" style="margin:0">Bientôt, Tampon l’enverra pour vous depuis votre boîte mail, puis via votre plateforme agréée à partir de 2027.</p>
    <div class="row-btns"><button class="btn" type="button" data-dlg-close>Fermer</button></div>`,box=>{
    box.querySelector('#sdPdf').onclick=()=>makePDF(d.id,can('facturx'));
    box.querySelector('#sdCopy').onclick=()=>copyText(m.objet+'\n\n'+m.body);
  });
}
function copyText(t){try{navigator.clipboard.writeText(t).then(()=>toast('Message copié'),()=>toast('Copie impossible ici : sélectionnez le texte'))}catch(e){toast('Copie impossible ici : sélectionnez le texte')}}

/* --- Messages (envoi, relances) --- */
function mailFor(d,kind){
  const p=P();const c=docClient(d);const T=totals(d);const civ=c.nom;const sig=`${p.prenom}${p.nom?' '+p.nom:''}\n${p.entreprise}${p.tel?'\n'+p.tel:''}`;
  const late=d.ech?daysBetween(d.ech,iso(today())):0;
  if(kind==='envoi')return {objet:`${TYPES[d.type]} ${d.num} · ${p.entreprise}`,body:`Bonjour,\n\nVeuillez trouver ci-joint ${d.type==='devis'?'le devis':d.type==='avoir'?'l’avoir':'la facture'} ${d.num} d’un montant de ${eur(T.ttc)}${d.type==='facture'?`, à régler avant le ${fdate(d.ech)}`:''}${d.type==='devis'?`, valable jusqu’au ${fdate(d.ech)}`:''}.${d.type==='facture'&&p.iban?`\n\nRèglement par virement : IBAN ${fmtIban(p.iban)}.`:''}\n\nJe reste à votre disposition pour toute question.\n\nBien cordialement,\n${sig}`};
  if(kind==='devis')return {objet:`Suite à notre devis ${d.num}`,body:`Bonjour,\n\nJe me permets de revenir vers vous au sujet du devis ${d.num} de ${eur(T.ttc)} envoyé le ${fdate(d.date)}.\n\nAvez-vous pu en prendre connaissance ? Je suis disponible pour en parler ou l’ajuster si besoin.\n\nBien cordialement,\n${sig}`};
  if(kind===1)return {objet:`Facture ${d.num} en attente de règlement`,body:`Bonjour,\n\nSauf erreur de ma part, la facture ${d.num} de ${eur(T.ttc)}, arrivée à échéance le ${fdate(d.ech)}, n’a pas encore été réglée. Vous la trouverez de nouveau en pièce jointe.\n\nSi le paiement est déjà parti, merci de ne pas tenir compte de ce message.\n\nBien cordialement,\n${sig}`};
  if(kind===2)return {objet:`2e relance : facture ${d.num}`,body:`Bonjour,\n\nMalgré mon précédent message, la facture ${d.num} de ${eur(T.ttc)} reste impayée depuis ${late} jours.\n\nMerci de procéder au règlement dans les meilleurs délais${p.iban?` par virement (IBAN ${fmtIban(p.iban)})`:''}, ou de me dire si quelque chose bloque.\n\nBien cordialement,\n${sig}`};
  return {objet:`Dernière relance avant mise en demeure : facture ${d.num}`,body:`Bonjour,\n\nLa facture ${d.num} de ${eur(T.ttc)} est impayée depuis ${late} jours, malgré deux relances.\n\nSans règlement sous 8 jours, je serai contraint${c.type==='pro'?' d’appliquer les pénalités de retard prévues ainsi que l’indemnité forfaitaire de 40 € pour frais de recouvrement, et':''} d’engager une procédure de recouvrement.\n\nBien cordialement,\n${sig}`};
}
function openMail(id,kind){
  const d=docBy(id);const c=docClient(d);const m=mailFor(d,kind);V={mode:'mail',id,kind,lastFocus:document.activeElement};
  openViewer(kind==='devis'?'Relance du devis':kind===1?'Relance':kind===2?'2e relance':'Relance finale',`<button class="btn sm" type="button" id="mEdit">Modifier</button>`,
    `<article class="mailv"><dl><dt>À</dt><dd>${esc(c.nom)}${c.email?` · <span class="mono">${esc(c.email)}</span>`:' · <span style="color:var(--warn)">email à ajouter dans la fiche client</span>'}</dd><dt>Objet</dt><dd><b>${esc(m.objet)}</b></dd></dl><div class="mbody" id="mBody">${esc(m.body)}</div>
    <div style="padding:14px 18px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:10px"><span class="fine" style="margin:0">Pièce jointe</span><button type="button" class="docbtn" id="mDoc">${ICON_DOC}<span>${esc(titleOf(d))}.pdf</span><span class="arr">›</span></button></div></article>
    <div class="vactions" style="margin-top:14px"><button class="btn primary" type="button" id="mSent">Copier et marquer comme envoyée</button>${c.email?`<a class="btn" id="mMailto" href="mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(m.objet)}&body=${encodeURIComponent(m.body)}">Ouvrir mon email</a>`:''}<button class="btn" type="button" id="mPdf">Télécharger la facture</button></div>`);
  const B=$('#vBody');
  $('#mEdit').onclick=()=>{const b=B.querySelector('#mBody');const on=b.contentEditable!=='true';b.contentEditable=on?'true':'false';$('#mEdit').textContent=on?'Terminer':'Modifier';if(on)b.focus()};
  B.querySelector('#mDoc').onclick=()=>openSheet(id);
  B.querySelector('#mPdf').onclick=()=>makePDF(id,can('facturx'));
  B.querySelector('#mSent').onclick=()=>{const body=B.querySelector('#mBody').innerText;copyText(m.objet+'\n\n'+body);d.relances=d.relances||[];d.relances.push({date:iso(today()),niveau:kind});log(kind==='devis'?`Relance du devis ${d.num} envoyée à ${c.nom}`:`Relance ${kind} de la facture ${d.num} envoyée à ${c.nom}`);save();closeViewer();toast('Relance notée. Le message est copié.')};
}

/* --- Feuille du document --- */
function sellerOf(d){const p=P();return d.sellerSnap||Object.assign(vendeur(p),{iban:p.iban,bic:p.bic,debits:avecTVA(p)&&p.debits,logo:p.logo,piedPage:p.piedPage,decAssureur:p.decAssureur,decContrat:p.decContrat,decZone:p.decZone,metier:p.metier,statut:p.statut})}
function conditionsOf(d,s,isPro){
  const c=[];
  if(d.type==='facture')c.push('Pas d’escompte pour paiement anticipé. En cas de retard de paiement, des pénalités au taux de trois fois le taux d’intérêt légal sont exigibles'+(isPro?', ainsi qu’une indemnité forfaitaire de 40 € pour frais de recouvrement.':'.'));
  if(d.type==='devis')c.push('Devis gratuit. Les prix sont fermes pendant la durée de validité indiquée.');
  if(s.metier==='artisan'&&s.decAssureur)c.push(`Assurance décennale : ${s.decAssureur}${s.decContrat?', contrat n° '+s.decContrat:''}${s.decZone?', couverture : '+s.decZone:''}.`);
  if(s.piedPage)c.push(s.piedPage);
  return c;
}
function sheetHTML(d){
  const s=sellerOf(d);const c=docClient(d)||{nom:'Client à choisir'};const T=totals(d);const tvaOn=T.tvaOn;const st=statutOf(d);
  const isPro=c.type==='pro';const isDevis=d.type==='devis';const ref=d.ref?docBy(d.ref):null;const logo=safeImg(s.logo);
  const rows=[['Numéro',numOf(d)],['Date',fdate(d.date)]];
  if(d.type==='facture')rows.push(['Échéance',fdate(d.ech)]);if(isDevis)rows.push(['Valable jusqu’au',fdate(d.ech)]);if(ref)rows.push(['Facture d’origine',ref.num]);
  const info=[];
  if(!isDevis)info.push(['Nature de l’opération',(nomDe(NATURES,d.nature)||'Prestation de services')+(s.debits?' · TVA sur les débits':'')]);
  if(c.livraison)info.push([d.nature==='PS'||isDevis?'Lieu d’exécution':'Adresse de livraison',c.livraison]);
  if(isDevis)info.push(['Validité','Ce devis est valable jusqu’au '+fdate(d.ech)+'.']);
  const sl=[s.nomAffiche!==s.nomLegal?s.nomLegal:'',s.adresse,[s.cp,s.ville].filter(Boolean).join(' '),'SIRET '+fmtSiret(s.siret)+(s.tvaIntra?' · TVA '+s.tvaIntra:''),[s.email,s.tel].filter(Boolean).join(' · ')].filter(Boolean);
  const cl=[c.adresse,[c.cp,c.ville].filter(Boolean).join(' '),isPro&&c.siren?'SIREN '+fmtSiren(c.siren):''].filter(Boolean);
  const pay=[];
  if(d.type==='facture'){pay.push('<span class="lbl-g">Règlement</span>');if(!d.paid)pay.push(`<span>À régler avant le ${esc(fdate(d.ech))}</span>`);if(s.iban)pay.push(`<span>Virement : ${esc(fmtIban(s.iban))}</span>`);if(s.bic)pay.push(`<span>BIC : ${esc(s.bic)}</span>`);if(d.paid)pay.push(`<span class="p-paid">Payée le ${esc(fdate(d.paid.date))} · ${esc(d.paid.mode)}</span>`)}
  const cond=conditionsOf(d,s,isPro);
  return `<article class="paper" aria-label="${esc(titleOf(d))}"><div class="p-band"></div>
    <header class="p-head"><div class="p-from">${logo?`<img class="p-logo" src="${esc(logo)}" alt="">`:''}<div><div class="p-co">${esc(s.nomAffiche)}</div><div class="p-small">${sl.map(esc).join('<br>')}</div></div></div>
    <div class="p-title"><div class="p-type">${esc(TYPES[d.type])}</div><dl class="p-cart">${rows.map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}<dt>Statut</dt><dd><span class="p-status ${CHIP[st]||'mute'}">${esc(st)}</span></dd></dl></div></header>
    <div class="p-parties"><div class="p-info">${info.map(([k,v])=>`<div><span class="lbl-g">${esc(k)}</span>${esc(v)}</div>`).join('')}</div>
    <div class="p-client"><span class="lbl-g">${isDevis?'Devis pour':'Facturé à'}</span><b>${esc(c.nom)}</b><div class="p-small">${cl.map(esc).join('<br>')}</div></div></div>
    <div class="p-tablewrap"><table class="p-table"><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">Prix unit.${tvaOn?' HT':''}</th>${tvaOn?'<th class="r">TVA</th>':''}<th class="r">Total${tvaOn?' HT':''}</th></tr></thead>
    <tbody>${(d.lignes||[]).map(l=>`<tr><td>${esc(l.d)}</td><td class="r">${esc(String(l.q).replace('.',','))}</td><td class="r">${eur(l.pu)}</td>${tvaOn?`<td class="r m">${esc(String(l.tva).replace('.',','))} %</td>`:''}<td class="r b">${eur((+l.q)*(+l.pu))}</td></tr>`).join('')}</tbody></table></div>
    <div class="p-bottom"><div class="p-pay">${pay.join('')}</div>
      <div class="p-tot">${tvaOn?`<div class="tr"><span>Total HT</span><span>${eur(T.ht)}</span></div>${T.parTaux.map(t=>`<div class="tr"><span>TVA ${esc(String(t.taux).replace('.',','))} %</span><span>${eur(t.montant)}</span></div>`).join('')}`:''}
      <div class="p-grand"><span>${d.type==='avoir'?'Montant de l’avoir':tvaOn?'Total TTC':isDevis?'Montant total':'Total à payer'}</span><span>${eur(T.ttc)}</span></div>${!tvaOn?'<div class="p-legal">TVA non applicable, art. 293 B du CGI</div>':''}</div></div>
    ${d.notes?`<div class="p-note"><span class="lbl-g">Note</span>${esc(d.notes).replace(/\n/g,'<br>')}</div>`:''}
    ${cond.length?`<div class="p-cond"><span class="lbl-g">Conditions</span>${cond.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}
    ${isDevis?'<div class="p-sign"><span class="lbl-g">Bon pour accord</span><span>Date, signature et mention « lu et approuvé »</span><span>Le …………………… à ……………………</span><span class="ln"></span></div>':''}
    <footer class="p-foot"><span>${esc(s.nomLegal||s.nomAffiche)} · SIRET ${esc(fmtSiret(s.siret))}</span><span>${esc(numOf(d))}</span></footer>
  </article>`;
}
function openSheet(id){
  const d=docBy(id);V={mode:'sheet',id,lastFocus:(V&&V.lastFocus)||document.activeElement};const st=statutOf(d);const acts=[];
  if(d.type==='facture'&&!d.paid&&!d.annulee){acts.push(['paid','Marquer comme payée',1]);acts.push(['relance','Relancer']);acts.push(['avoir','Annuler par un avoir'])}
  if(d.type==='facture'&&d.paid&&!d.annulee)acts.push(['avoir','Faire un avoir']);
  if(d.type==='devis'&&!d.accepte&&!d.refuse){acts.push(['accept','Accepté : créer la facture',1]);acts.push(['refuse','Refusé']);acts.push(['relance','Relancer'])}
  if(d.type==='devis'&&d.accepte&&d.facture)acts.push(['gofact','Voir la facture']);
  acts.push(['send','Envoyer au client']);acts.push(['dup','Dupliquer']);
  acts.push(['pdf','Télécharger le PDF']);if(d.type!=='devis')acts.push(['fx','Facture électronique (Factur-X)']);
  openViewer(titleOf(d),'',`<div class="vactions">${acts.map(([k,l,pr])=>`<button type="button" class="btn sm ${pr?'primary':''}" data-va="${k}">${esc(l)}</button>`).join('')}</div>`+sheetHTML(d));
}
$('#viewer').addEventListener('click',e=>{
  const b=e.target.closest('[data-va]');if(!b||!V)return;const d=docBy(V.id);const k=b.dataset.va;
  if(k==='pdf')return makePDF(d.id,false);
  if(k==='fx'){if(!can('facturx'))return confirmBox('Facture électronique Factur-X','Le format Factur-X est inclus dans les formules Essentiel et Complet.','Voir les formules',goPlans);return makePDF(d.id,true)}
  if(k==='xml')return download((d.num||'brouillon')+'.xml',buildCII(d),'application/xml');
  if(k==='paid')return askPaid(d.id);
  if(k==='relance'){if(d.type==='devis')return openMail(d.id,'devis');const n=Math.min(3,(d.relances||[]).length+1);return openMail(d.id,n)}
  if(k==='accept')return acceptDevis(d.id);
  if(k==='refuse'){d.refuse=iso(today());log(`Devis ${d.num} refusé`);save();openSheet(d.id);toast('Devis marqué comme refusé');return}
  if(k==='gofact')return openDoc(d.facture);
  if(k==='send')return sendDialog(d);
  if(k==='dup'){const n=newDocData(d.type==='avoir'?'facture':d.type,d.clientId);n.lignes=clone(d.lignes);n.nature=d.nature;n.notes=d.notes;DB.docs.unshift(n);save();openEditor(n.id);toast('Copie créée : vérifiez-la');return}
  if(k==='avoir')return makeAvoir(d.id);
});
function askPaid(id){
  const d=docBy(id);
  dialog(`<h2 id="dlgTitle">${esc(titleOf(d))} payée</h2><div class="form"><div class="fld"><label for="pDate">Date du paiement</label><input class="in" id="pDate" type="date" value="${iso(today())}"></div><div class="fld"><label for="pMode">Moyen de paiement</label><select class="in" id="pMode">${MODES.map(m=>`<option>${m}</option>`).join('')}</select></div></div><p class="fine" style="margin:0">La date compte pour votre chiffre d’affaires encaissé et votre déclaration URSSAF.</p><div class="row-btns"><button class="btn primary" type="button" id="pOk">Enregistrer le paiement</button><button class="btn" type="button" data-dlg-close>Annuler</button></div>`,box=>{
    box.querySelector('#pOk').onclick=()=>{d.paid={date:box.querySelector('#pDate').value||iso(today()),mode:box.querySelector('#pMode').value};log(`Paiement de ${eur0(totals(d).ttc)} reçu pour la facture ${d.num} (${d.paid.mode})`);save();closeDialog();if(V&&V.mode==='sheet')openSheet(d.id);refresh();toast('Paiement enregistré')};
  });
}
function acceptDevis(id){
  const d=docBy(id);d.accepte=iso(today());const f=newDocData('facture',d.clientId);f.lignes=clone(d.lignes);f.notes=d.notes;f.devis=d.id;f.nature=d.lignes.length?'PS':'PS';
  DB.docs.unshift(f);d.facture=f.id;log(`Devis ${d.num} accepté : facture préparée`);save();openEditor(f.id);toast('Facture préparée à partir du devis');
}
function makeAvoir(id){
  const d=docBy(id);
  confirmBox(d.paid?'Faire un avoir ?':'Annuler cette facture ?',d.paid?`Un avoir de ${eur(totals(d).ttc)} sera créé pour rembourser ${docClient(d).nom}. Vous pourrez l’ajuster avant de le finaliser.`:`Une facture envoyée ne peut pas être supprimée. Un avoir du même montant va l’annuler.`,'Créer l’avoir',()=>{
    const a=newDocData('avoir',d.clientId);a.ref=d.id;a.lignes=clone(d.lignes);a.nature=d.nature;a.date=iso(today());a.ech=a.date;a.rembourse=!!d.paid;a.notes=`Avoir sur la facture ${d.num}.`;
    a.num=nextNum('avoir',a.date);a.clientSnap=clone(d.clientSnap||clientBy(d.clientId));a.sellerSnap=clone(d.sellerSnap||vendeur(P()));a.tvaOn=d.tvaOn;a.finalized=new Date().toISOString();
    if(!d.paid)d.annulee=a.id;DB.docs.unshift(a);log(`Avoir ${a.num} émis sur la facture ${d.num}`);save();openSheet(a.id);toast('Avoir créé');
  });
}

/* =====================================================================
   Scanner : lecture de la photo sur l'appareil (aucun envoi, gratuit)
   ===================================================================== */
const SCAN_DIR=new URL('vendor/tesseract/',location.href).href;
let ocrW=null,ocrLoading=null;
function loadScript(src){return new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=ko;document.head.appendChild(s)})}
async function ocrWorker(onProg){
  if(ocrW)return ocrW;
  if(!ocrLoading)ocrLoading=(async()=>{
    if(!window.Tesseract)await loadScript(SCAN_DIR+'tesseract.min.js');
    ocrW=await Tesseract.createWorker('fra',1,{workerPath:SCAN_DIR+'worker.min.js',corePath:SCAN_DIR,langPath:SCAN_DIR,workerBlobURL:false,gzip:true,
      logger:m=>{if(scanProg)scanProg(m)}});
    return ocrW})();
  try{return await ocrLoading}catch(e){ocrLoading=null;throw e}
}
let scanProg=null;
/* Image redimensionnée et en niveaux de gris : plus rapide et plus fiable */
async function scanCanvas(file){
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=ko;i.src=url});
    const k=Math.min(1,2000/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    const x=c.getContext('2d');x.filter='grayscale(1) contrast(1.25)';x.drawImage(img,0,0,c.width,c.height);return c}
  finally{URL.revokeObjectURL(url)}
}
const MOIS_RE={janv:1,'févr':2,fevr:2,mars:3,avr:4,mai:5,juin:6,juil:7,'août':8,aout:8,sept:9,oct:10,nov:11,'déc':12,dec:12};
function amountsIn(s){
  const out=[];const re=/(?<![\d,.])(\d{1,3}(?:[ .\u00a0\u202f]\d{3})+|\d+)\s?[,.]\s?(\d{2})(?![\d%])(?!\s?%)/g;let m;
  while((m=re.exec(s)))out.push(parseFloat(m[1].replace(/[ .\u00a0\u202f]/g,'')+'.'+m[2]));
  return out.filter(v=>v>0&&v<1e6);
}
function extractInvoice(text,todayIso){
  const lines=text.split(/\r?\n/).map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
  const r={fournisseur:'',date:'',ttc:0,tva:0,cat:''};
  /* Montant TTC : mots-clés du plus sûr au moins sûr */
  const KEYS=[/net\s*[àa]\s*payer|reste\s*[àa]\s*payer|total\s*[àa]\s*payer|montant\s*[àa]\s*payer/i,/total\s*t\.?\s?t\.?\s?c|montant\s*t\.?\s?t\.?\s?c|\bttc\b/i,/\btotal\b|\bmontant\b|\bcb\b|carte bancaire|esp[eè]ces/i];
  const lineAmt=i=>{let a=amountsIn(lines[i]);if(!a.length&&lines[i+1])a=amountsIn(lines[i+1]);return a.length?a[a.length-1]:0};
  for(const k of KEYS){const c=[];lines.forEach((l,i)=>{if(k.test(l)&&!/\bh\.?\s?t\b|hors\s*taxe|sous[- ]total|tva/i.test(l)){const v=lineAmt(i);if(v)c.push(v)}});if(c.length){r.ttc=Math.max(...c);break}}
  const all=lines.flatMap(amountsIn);if(!r.ttc&&all.length)r.ttc=Math.max(...all);
  /* TVA : montant (pas le taux) sur une ligne TVA, hors numéro de TVA */
  const tv=[];lines.forEach((l,i)=>{if(/t\.?\s?v\.?\s?a/i.test(l)&&!/intra|n[°o]\s*tva|tva\s*:?\s*fr|FR\s?\d{2}\s?\d{3}/i.test(l)){const a=amountsIn(l).filter(v=>v<r.ttc);if(a.length)tv.push(a[a.length-1])}});
  if(tv.length)r.tva=tv.reduce((s,v)=>Math.max(s,v),0);
  if(!r.tva){let ht=0;lines.forEach((l,i)=>{if(/total\s*h\.?\s?t|\bh\.?\s?t\b|hors\s*taxe/i.test(l)){const v=lineAmt(i);if(v&&v<r.ttc)ht=Math.max(ht,v)}});if(ht){const t=Math.round((r.ttc-ht)*100)/100;if(t>0&&t/ht<0.21)r.tva=t}}
  if(r.tva>=r.ttc*0.25)r.tva=0;
  /* Date */
  const today=todayIso||new Date().toISOString().slice(0,10);const lim=Number(today.slice(0,4))-3;const dates=[];
  lines.forEach(l=>{let m;const re=/\b(\d{1,2})\s?[\/.\-]\s?(\d{1,2})\s?[\/.\-]\s?(\d{4}|\d{2})\b/g;
    while((m=re.exec(l))){let y=+m[3];if(y<100)y+=2000;const d=+m[1],mo=+m[2];if(d>=1&&d<=31&&mo>=1&&mo<=12)dates.push({v:`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`,p:/date|factur|émis|emis|\ble\b/i.test(l)?0:1})}
    const re2=/\b(\d{1,2})(?:er)?\s+(janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[ée]c)[a-zéû.]*\s+(\d{4})\b/gi;
    while((m=re2.exec(l))){const mo=MOIS_RE[m[2].toLowerCase().replace('û','u')]||MOIS_RE[m[2].toLowerCase()];if(mo)dates.push({v:`${m[3]}-${String(mo).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`,p:0})}});
  const ok=dates.filter(d=>d.v<=today&&+d.v.slice(0,4)>=lim&&!isNaN(new Date(d.v))).sort((a,b)=>a.p-b.p);
  if(ok.length)r.date=ok[0].v;
  /* Fournisseur : première ligne qui ressemble à un nom */
  const BAD=/factur|ticket|re[çc]u|date|t[ée]l|siret|siren|rcs|ape|naf|tva|adresse|www|http|@|client|devis|page|n°|^\W*$|total|caisse|bienvenue|merci/i;
  for(const l of lines.slice(0,8)){const t=l.replace(/[^\p{L}\d&'’.\- ]/gu,'').trim();if(t.replace(/[^\p{L}]/gu,'').length>=3&&!BAD.test(t)&&!/^\d/.test(t)&&!/\d{5}/.test(t)){r.fournisseur=t.slice(0,60);break}}
  /* Catégorie */
  const T=text.toLowerCase();
  const CATK=[['Carburant et déplacements',/gazole|gasoil|diesel|sp\s?95|sp\s?98|carburant|station|essence|p[ée]age|parking|sncf|total\s?energies|esso|shell|avia|adblue/],
    ['Repas',/restaurant|brasserie|boulangerie|caf[ée]\b|menu|repas|pizz|kebab|traiteur/],
    ['Téléphone et internet',/orange|sfr|bouygues|free mobile|forfait|internet|box|t[ée]l[ée]phon/],
    ['Assurance',/assurance|mutuelle|cotisation annuelle|contrat n|maaf|maif|axa|macif|groupama/],
    ['Matériel',/perceuse|visseuse|outil|machine|ordinateur|imprimante|makita|bosch|dewalt|hilti|mat[ée]riel/],
    ['Achats et fournitures',/leroy|castorama|brico|point\.?p|cedeo|gedimat|fourniture|vis\b|ciment|peinture|plaque|carrelage|bois|quincaill/]];
  for(const [c,re] of CATK)if(re.test(T)){r.cat=c;break}
  r.ttc=Math.round(r.ttc*100)/100;r.tva=Math.round(r.tva*100)/100;
  return r;
}
async function scanFile(file,onStep){
  onStep('Préparation…',0);scanProg=m=>{if(m.status==='recognizing text')onStep('Lecture du document…',m.progress);else if(/load|init/.test(m.status))onStep('Première utilisation : chargement du lecteur…',null)};
  try{const c=await scanCanvas(file);const w=await ocrWorker();const {data}=await w.recognize(c);return extractInvoice(data.text||'',iso(today()))}
  finally{scanProg=null}
}

/* =====================================================================
   Factures reçues (photo ou PDF)
   ===================================================================== */
let pendingFile=null;
$('#addRecue').addEventListener('click',()=>recueDialog(null));
$('#scanRecue').addEventListener('click',()=>{recueDialog(null);$('#fileIn').click()});
function recueDialog(id){
  const d=id?docBy(id):null;pendingFile=null;
  dialog(`<h2 id="dlgTitle">${d?'Modifier la facture reçue':'Ajouter une facture reçue'}</h2>
    <div class="row-btns"><button class="btn sm" type="button" id="rFile">${d&&d.file?'Changer le fichier':'📷 Photo ou fichier'}</button><span class="fine" id="rFileName" style="margin:0">${d&&d.file?esc(d.file.name||'Fichier joint'):''}</span></div>
    <p class="fine scanst" id="rScan" hidden aria-live="polite"></p>
    <div class="form"><div class="fld full"><label for="rFour">Fournisseur</label><input class="in" id="rFour" value="${esc(d?d.fournisseur:'')}"></div>
    <div class="fld"><label for="rDate">Date</label><input class="in" id="rDate" type="date" value="${d?d.date:iso(today())}"></div>
    <div class="fld"><label for="rTtc">Montant TTC</label><input class="in" id="rTtc" type="number" step="0.01" min="0" value="${d?d.ttc:''}"></div>
    <div class="fld"><label for="rTva">Dont TVA (facultatif)</label><input class="in" id="rTva" type="number" step="0.01" min="0" value="${d&&d.tvaAmt?d.tvaAmt:''}"></div>
    <div class="fld"><label for="rCat">Catégorie</label><select class="in" id="rCat">${CATS.map(c=>`<option ${d&&d.cat===c?'selected':''}>${c}</option>`).join('')}</select></div>
    <label class="check full"><input type="checkbox" id="rPaye" ${!d||d.paye?'checked':''}> Déjà payée</label></div>
    <span class="err" id="rErr" hidden></span>
    <div class="row-btns"><button class="btn primary" type="button" id="rOk">Enregistrer</button><button class="btn" type="button" data-dlg-close>Annuler</button>${d?'<button class="link" type="button" id="rDel" style="color:var(--bad)">Supprimer</button>':''}</div>`,box=>{
    box.querySelector('#rFile').onclick=()=>$('#fileIn').click();
    box.querySelector('#rOk').onclick=()=>{
      const four=box.querySelector('#rFour').value.trim(),ttc=parseFloat(box.querySelector('#rTtc').value);
      const er=box.querySelector('#rErr');if(!four||!(ttc>0)){er.textContent='Indiquez le fournisseur et le montant.';er.hidden=false;return}
      const o=d||{id:uid(),type:'recue',created:Date.now()};Object.assign(o,{fournisseur:four,date:box.querySelector('#rDate').value||iso(today()),ttc:r2(ttc),tvaAmt:r2(parseFloat(box.querySelector('#rTva').value)||0),cat:box.querySelector('#rCat').value,paye:box.querySelector('#rPaye').checked});
      if(pendingFile)o.file=pendingFile;if(!d){DB.docs.unshift(o);log(`Facture reçue de ${four} ajoutée (${eur0(ttc)})`)}
      if(!save()&&pendingFile){delete o.file;save();toast('Fichier trop lourd pour l’appareil : la facture est enregistrée sans le fichier')}
      closeDialog();refresh();if(V&&V.mode==='recue')openRecue(o.id);else toast('Facture reçue enregistrée');
    };
    const del=box.querySelector('#rDel');if(del)del.onclick=()=>{DB.docs=DB.docs.filter(x=>x.id!==d.id);save();closeDialog();if(V)closeViewer();refresh();toast('Supprimée')};
  });
}
$('#fileIn').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{
    if(f.type.startsWith('image/'))pendingFile={name:f.name,type:'image/jpeg',data:await compressImage(f,1400,.7)};
    else if(f.size<1.5e6)pendingFile={name:f.name,type:f.type,data:await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)})};
    else{toast('PDF trop lourd (1,5 Mo maximum) : prenez plutôt une photo');return}
    const n=$('#rFileName');if(n)n.textContent=f.name;
  }catch(err){toast('Ce fichier n’a pas pu être lu');return}
  if(f.type.startsWith('image/')&&$('#rScan'))runScan(f);
  else if($('#rScan')){const st=$('#rScan');st.hidden=false;st.textContent='Fichier joint. Le scanner lit les photos : pour un PDF, remplissez les champs.'}
});
let scanBusy=false;
async function runScan(f){
  const st=$('#rScan');if(!st||scanBusy)return;scanBusy=true;st.hidden=false;st.className='fine scanst busy';
  const step=(t,p)=>{if($('#rScan'))$('#rScan').textContent=t+(p!=null&&p>0?` ${Math.round(p*100)} %`:'')};
  try{
    const r=await scanFile(f,step);const box=$('#dlgBox');if(!box.querySelector('#rFour'))return;
    const set=(sel,v)=>{const el=box.querySelector(sel);if(v&&el&&!el.value){el.value=v;el.classList.add('auto')}};
    set('#rFour',r.fournisseur);if(r.date){const el=box.querySelector('#rDate');el.value=r.date;el.classList.add('auto')}
    set('#rTtc',r.ttc?String(r.ttc):'');set('#rTva',r.tva?String(r.tva):'');
    if(r.cat){const el=box.querySelector('#rCat');el.value=r.cat;el.classList.add('auto')}
    const n=[r.fournisseur,r.date,r.ttc,r.tva].filter(Boolean).length;
    st.className='fine scanst '+(n?'ok':'warn');
    st.textContent=n?'Lu par le scanner : vérifiez les champs surlignés, puis enregistrez.':'Le document n’a pas pu être lu. Reprenez la photo bien à plat et éclairée, ou remplissez les champs.';
  }catch(e){if($('#rScan')){st.className='fine scanst warn';st.textContent='Le scanner n’a pas pu démarrer. Remplissez les champs, la photo reste jointe.'}}
  finally{scanBusy=false}
}

function openRecue(id){
  const d=docBy(id);V={mode:'recue',id,lastFocus:(V&&V.lastFocus)||document.activeElement};const f=safeFile(d.file);
  openViewer(`Facture reçue · ${d.fournisseur}`,`<button class="btn sm" type="button" id="rcEdit">Modifier</button>${f?'<button class="btn sm" type="button" id="rcDl">Télécharger le fichier</button>':''}`,
    `<article class="paper p-recu"><div class="p-band"></div><header class="p-head"><div><div class="p-co">${esc(d.fournisseur)}</div><div class="p-small">${esc(d.cat||'')}</div></div><div class="p-title"><div class="p-type" style="font-size:24px">Facture reçue</div><dl class="p-cart"><dt>Date</dt><dd>${esc(fdate(d.date))}</dd><dt>Statut</dt><dd><span class="p-status ${d.paye?'ok':'warn'}">${d.paye?'Payée':'À payer'}</span></dd></dl></div></header>
    <div class="p-bottom" style="border-top:0"><div class="p-pay"></div><div class="p-tot">${d.tvaAmt?`<div class="tr"><span>Dont TVA</span><span>${eur(d.tvaAmt)}</span></div>`:''}<div class="p-grand"><span>Montant TTC</span><span>${eur(d.ttc)}</span></div></div></div>
    ${f?(f.type.startsWith('image/')?`<img src="${esc(f.data)}" alt="Photo de la facture">`:`<p class="p-note">Fichier PDF joint : ${esc(f.name)}</p>`):'<p class="p-note">Aucun fichier joint.</p>'}</article>`);
  $('#rcEdit').onclick=()=>recueDialog(id);
  if($('#rcDl'))$('#rcDl').onclick=()=>{const b64=f.data.split(',')[1];const bin=atob(b64);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);download((f.name||'facture').replace(/[^\w.\- ]/g,'_'),new Blob([u],{type:f.type}))};
}

/* =====================================================================
   Exports pour le comptable
   ===================================================================== */
const csv=rows=>'﻿'+rows.map(r=>r.map(v=>{v=String(v??'');return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(';')).join('\r\n');
const n2=n=>String(r2(n).toFixed(2)).replace('.',',');
$('#exportBtn').addEventListener('click',()=>{
  const y=today().getFullYear();
  dialog(`<h2 id="dlgTitle">Exporter pour le comptable</h2><div class="fld"><label for="xY">Année</label><select class="in" id="xY">${[y,y-1].map(a=>`<option>${a}</option>`).join('')}</select></div>
  <div class="list">
    <button class="drow" type="button" data-x="recettes"><span class="tx"><b>Livre des recettes</b><span>Obligatoire pour les micro-entrepreneurs : tous vos encaissements, dans l’ordre</span></span><span class="arr">›</span></button>
    <button class="drow" type="button" data-x="achats"><span class="tx"><b>Registre des achats</b><span>Vos factures reçues</span></span><span class="arr">›</span></button>
    <button class="drow" type="button" data-x="factures"><span class="tx"><b>Liste des factures et avoirs</b><span>Numéros, clients, montants HT, TVA et TTC</span></span><span class="arr">›</span></button>
  </div><p class="fine" style="margin:0">Fichiers CSV, à ouvrir dans Excel ou à envoyer à votre comptable.</p><div class="row-btns"><button class="btn" type="button" data-dlg-close>Fermer</button></div>`,box=>{
    box.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{
      const yy=box.querySelector('#xY').value;const k=b.dataset.x;
      if(k==='recettes'){const rows=[['Date d’encaissement','N° de facture','Client','Nature','Montant HT','Montant TTC','Mode de règlement']];
        DB.docs.filter(d=>d.type==='facture'&&d.paid&&d.paid.date.startsWith(yy)).sort((a,b)=>a.paid.date.localeCompare(b.paid.date)).forEach(d=>{const T=totals(d);rows.push([fshort(d.paid.date),d.num,docClient(d).nom,nomDe(NATURES,d.nature),n2(T.ht),n2(T.ttc),d.paid.mode])});
        DB.docs.filter(d=>d.type==='avoir'&&d.rembourse&&d.date.startsWith(yy)).forEach(d=>{const T=totals(d);rows.push([fshort(d.date),d.num,docClient(d).nom,'Avoir (remboursement)',n2(-T.ht),n2(-T.ttc),''])});
        download(`livre-des-recettes-${yy}.csv`,csv(rows),'text/csv')}
      if(k==='achats'){const rows=[['Date','Fournisseur','Catégorie','Montant TTC','Dont TVA','Payée']];DB.docs.filter(d=>d.type==='recue'&&d.date.startsWith(yy)).sort((a,b)=>a.date.localeCompare(b.date)).forEach(d=>rows.push([fshort(d.date),d.fournisseur,d.cat,n2(d.ttc),n2(d.tvaAmt||0),d.paye?'Oui':'Non']));download(`registre-des-achats-${yy}.csv`,csv(rows),'text/csv')}
      if(k==='factures'){const rows=[['N°','Type','Date','Client','SIREN client','Nature','HT','TVA','TTC','Statut']];DB.docs.filter(d=>(d.type==='facture'||d.type==='avoir')&&d.num&&d.date.startsWith(yy)).sort((a,b)=>a.num.localeCompare(b.num)).forEach(d=>{const T=totals(d);const sg=d.type==='avoir'?-1:1;const c=docClient(d);rows.push([d.num,TYPES[d.type],fshort(d.date),c.nom,c.siren||'',nomDe(NATURES,d.nature),n2(sg*T.ht),n2(sg*T.tva),n2(sg*T.ttc),statutOf(d)])});download(`factures-${yy}.csv`,csv(rows),'text/csv')}
      log('Export comptable téléchargé');toast('Fichier téléchargé');
    });
  });
});

/* =====================================================================
   Factur-X : données de la facture au format CII (norme EN 16931)
   ===================================================================== */
const x=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const d8=s=>String(s||'').replace(/-/g,'');
const a2=n=>r2(n).toFixed(2);
function buildCII(d){
  const s=d.sellerSnap||vendeur(P());const c=docClient(d)||{};const T=totals(d);const tvaOn=T.tvaOn;
  const ref=d.ref?docBy(d.ref):null;const cat=t=>tvaOn?(t>0?'S':'Z'):'E';
  const exo='TVA non applicable, art. 293 B du CGI';
  const party=(tag,o)=>`<ram:${tag}><ram:Name>${x(o.nom)}</ram:Name>${o.siren?`<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${x(o.siren)}</ram:ID></ram:SpecifiedLegalOrganization>`:''}<ram:PostalTradeAddress>${o.cp?`<ram:PostcodeCode>${x(o.cp)}</ram:PostcodeCode>`:''}${o.adresse?`<ram:LineOne>${x(o.adresse)}</ram:LineOne>`:''}${o.ville?`<ram:CityName>${x(o.ville)}</ram:CityName>`:''}<ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>${o.email?`<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${x(o.email)}</ram:URIID></ram:URIUniversalCommunication>`:''}${o.tva?`<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${x(o.tva)}</ram:ID></ram:SpecifiedTaxRegistration>`:''}</ram:${tag}>`;
  const lines=(d.lignes||[]).map((l,i)=>{const t=tvaOn?+l.tva:0;return `<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>${i+1}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct><ram:Name>${x(l.d)}</ram:Name></ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${a2(l.pu)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${+l.q}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat(t)}</ram:CategoryCode><ram:RateApplicablePercent>${t}</ram:RateApplicablePercent></ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${a2(l.q*l.pu)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`}).join('');
  const taxes=(T.parTaux.length?T.parTaux:[{taux:0,base:T.ht,montant:0}]).map(t=>`<ram:ApplicableTradeTax><ram:CalculatedAmount>${a2(t.montant)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>${!tvaOn?`<ram:ExemptionReason>${x(exo)}</ram:ExemptionReason>`:''}<ram:BasisAmount>${a2(t.base)}</ram:BasisAmount><ram:CategoryCode>${cat(t.taux)}</ram:CategoryCode>${!tvaOn?'<ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>':''}${tvaOn&&s.debits?'<ram:DueDateTypeCode>5</ram:DueDateTypeCode>':''}<ram:RateApplicablePercent>${t.taux}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`).join('');
  const notes=[`Catégorie de l'opération : ${d.nature||'PS'}`];if(!tvaOn)notes.push(exo);if(s.debits)notes.push("Option pour le paiement de la taxe d'après les débits");
  if(d.type==='facture')notes.push(`Pénalités de retard : trois fois le taux d'intérêt légal${c.type==='pro'?". Indemnité forfaitaire pour frais de recouvrement : 40 €":''}. Pas d'escompte pour paiement anticipé.`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument><ram:ID>${x(d.num)}</ram:ID><ram:TypeCode>${d.type==='avoir'?381:380}</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${d8(d.date)}</udt:DateTimeString></ram:IssueDateTime>${notes.map(n=>`<ram:IncludedNote><ram:Content>${x(n)}</ram:Content></ram:IncludedNote>`).join('')}</rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>${lines}
<ram:ApplicableHeaderTradeAgreement>${party('SellerTradeParty',{nom:s.nomLegal,siren:s.siren,cp:s.cp,adresse:s.adresse,ville:s.ville,email:s.email,tva:s.tvaIntra})}${party('BuyerTradeParty',{nom:c.nom,siren:c.type==='pro'?c.siren:'',cp:c.cp,adresse:c.adresse,ville:c.ville,email:c.email})}</ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery>${c.livraison?`<ram:ShipToTradeParty><ram:PostalTradeAddress><ram:LineOne>${x(c.livraison)}</ram:LineOne><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress></ram:ShipToTradeParty>`:''}</ram:ApplicableHeaderTradeDelivery>
<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${s.iban?`<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${x(ibanClean(s.iban))}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>`:''}${taxes}${d.type==='facture'?`<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${d8(d.ech)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>`:''}<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${a2(T.ht)}</ram:LineTotalAmount><ram:TaxBasisTotalAmount>${a2(T.ht)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${a2(T.tva)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${a2(T.ttc)}</ram:GrandTotalAmount><ram:DuePayableAmount>${a2(d.paid||d.type==='avoir'?0:T.ttc)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>${ref?`<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${x(ref.num)}</ram:IssuerAssignedID></ram:InvoiceReferencedDocument>`:''}</ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

/* =====================================================================
   PDF (avec Factur-X intégré pour les factures et avoirs)
   ===================================================================== */
async function makePDF(id,fx){
  const d=docBy(id);if(!window.jspdf){toast('Le module PDF n’a pas pu se charger : vérifiez votre connexion');return}
  const p=P();const s=d.sellerSnap||Object.assign(vendeur(p),{iban:p.iban,bic:p.bic,logo:p.logo,piedPage:p.piedPage,metier:p.metier,decAssureur:p.decAssureur,decContrat:p.decContrat,decZone:p.decZone,debits:avecTVA(p)&&p.debits});
  const c=docClient(d)||{nom:''};const T=totals(d);const tvaOn=T.tvaOn;const isPro=c.type==='pro';
  const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4'});const W=210,M=16;let y=18;
  const clean=t=>String(t??'').replace(/²/g,'2').replace(/³/g,'3').replace(/·/g,'-').replace(/[\u202F\u00A0]/g,' ').replace(/[“”«»]/g,'"');
  const _t=pdf.text.bind(pdf);pdf.text=(t,...a)=>_t(Array.isArray(t)?t.map(clean):clean(t),...a);
  const _s=pdf.splitTextToSize.bind(pdf);pdf.splitTextToSize=(t,...a)=>_s(clean(t),...a);
  /* Mise en page soignée : bandeau, cartouche, tableau, totaux, conditions, signature, pied de page */
  const G=[30,77,58],GS=[225,237,229],INK=[24,24,27],MUT=[102,99,93],LINE=[226,223,216],SOFT=[246,245,242];
  const col=c=>pdf.setTextColor(...c),fill=c=>pdf.setFillColor(...c),draw=c=>pdf.setDrawColor(...c);
  const font=(w,sz)=>{pdf.setFont('helvetica',w);pdf.setFontSize(sz)};
  const BOTTOM=268;// au-delà, nouvelle page (le pied de page commence à 280)
  const label=(t,x,yy)=>{font('bold',7.2);col(G);pdf.text(t.toUpperCase(),x,yy,{charSpace:.35})};
  const R=W-M;// bord droit
  // Bandeau vert en haut
  fill(G);pdf.rect(0,0,W,5,'F');
  // Émetteur
  y=20;let lx=M;
  if(safeImg(s.logo)){try{const pr=pdf.getImageProperties(s.logo);const h=17,w=Math.min(42,pr.width/pr.height*h);pdf.addImage(s.logo,'JPEG',M,y-6,w,h);lx=M+w+5}catch(e){}}
  font('bold',15);col(INK);pdf.text(s.nomAffiche||'',lx,y);
  font('normal',8.6);col(MUT);
  const sl=[s.nomAffiche!==s.nomLegal?s.nomLegal:'',s.adresse,[s.cp,s.ville].filter(Boolean).join(' '),'SIRET '+fmtSiret(s.siret)+(s.tvaIntra?'  -  TVA '+s.tvaIntra:''),[s.email,s.tel].filter(Boolean).join('  -  ')].filter(Boolean);
  pdf.text(sl,lx,y+5.2,{lineHeightFactor:1.45});
  const leftBottom=y+5.2+sl.length*4.4;
  // Titre et cartouche
  const isDevis=d.type==='devis';
  font('bold',24);col(G);pdf.text(TYPES[d.type].toUpperCase(),R,y+1,{align:'right'});
  const rows=[['Numéro',numOf(d)],['Date',fdate(d.date)]];
  if(d.type==='facture')rows.push(['Échéance',fdate(d.ech)]);
  if(isDevis)rows.push(['Valable jusqu’au',fdate(d.ech)]);
  if(d.ref)rows.push(['Facture d’origine',docBy(d.ref).num]);
  const bw=72,bx=R-bw;let by=y+6;
  fill(SOFT);pdf.roundedRect(bx,by,bw,rows.length*6.2+4,2,2,'F');
  rows.forEach((r,i)=>{const yy=by+6.3+i*6.2;font('normal',8.3);col(MUT);pdf.text(r[0],bx+4,yy);font('bold',8.8);col(INK);pdf.text(r[1],R-4,yy,{align:'right'})});
  y=Math.max(leftBottom,by+rows.length*6.2+4)+9;
  // Client (carte à droite) et informations (à gauche)
  const cw=86,cx=R-cw;
  const cl=[c.adresse,[c.cp,c.ville].filter(Boolean).join(' '),isPro&&c.siren?'SIREN '+fmtSiren(c.siren):''].filter(Boolean);
  const ch=15+cl.length*4.4;
  draw(LINE);pdf.setLineWidth(.3);pdf.roundedRect(cx,y,cw,ch,2,2,'S');fill(G);pdf.rect(cx,y+3,1.2,ch-6,'F');
  label(isDevis?'Devis pour':'Facturé à',cx+6,y+6);font('bold',11);col(INK);pdf.text(c.nom||'',cx+6,y+11.5);
  font('normal',8.8);col(MUT);if(cl.length)pdf.text(cl,cx+6,y+16.5,{lineHeightFactor:1.45});
  let iy=y+6;
  const info=[];
  if(!isDevis)info.push(['Nature de l’opération',(nomDe(NATURES,d.nature)||'Prestation de services')+(s.debits?' - TVA sur les débits':'')]);
  if(c.livraison)info.push([d.nature==='PS'||isDevis?'Lieu d’exécution':'Adresse de livraison',c.livraison]);
  if(isDevis)info.push(['Validité','Ce devis est valable jusqu’au '+fdate(d.ech)+'.']);
  info.forEach(([k,v])=>{label(k,M,iy);font('normal',8.8);col(INK);const vl=pdf.splitTextToSize(v,cx-M-8);pdf.text(vl,M,iy+4.6,{lineHeightFactor:1.4});iy+=6+vl.length*4.3});
  y=Math.max(y+ch,iy)+8;
  // Tableau des lignes
  const C=tvaOn?{q:120,pu:148,t:166,tot:R-3}:{q:134,pu:164,tot:R-3};const dw=(tvaOn?C.q-14:C.q-14)-(M+3);
  const head=()=>{fill(G);pdf.roundedRect(M,y-5.6,R-M,9,1.5,1.5,'F');font('bold',8.3);pdf.setTextColor(255,255,255);
    pdf.text('Désignation',M+3,y);pdf.text('Qté',C.q,y,{align:'right'});pdf.text('Prix unit.'+(tvaOn?' HT':''),C.pu,y,{align:'right'});if(tvaOn)pdf.text('TVA',C.t,y,{align:'right'});pdf.text('Total'+(tvaOn?' HT':''),C.tot,y,{align:'right'});y+=9};
  head();
  (d.lignes||[]).forEach((l,i)=>{
    font('normal',9);const lines=pdf.splitTextToSize(l.d,dw);const h=Math.max(8,lines.length*4.4+3.6);
    if(y+h>BOTTOM){pdf.addPage();fill(G);pdf.rect(0,0,W,5,'F');y=20;head()}
    if(i%2===1){fill(SOFT);pdf.rect(M,y-5.2,R-M,h,'F')}
    col(INK);pdf.text(lines,M+3,y,{lineHeightFactor:1.4});
    pdf.text(String(l.q).replace('.',','),C.q,y,{align:'right'});pdf.text(eur(l.pu),C.pu,y,{align:'right'});
    if(tvaOn){col(MUT);pdf.text(String(l.tva).replace('.',',')+' %',C.t,y,{align:'right'});col(INK)}
    font('bold',9);pdf.text(eur(l.q*l.pu),C.tot,y,{align:'right'});y+=h;
  });
  draw(LINE);pdf.setLineWidth(.3);pdf.line(M,y-4,R,y-4);
  // Totaux (à droite) et règlement ou conditions (à gauche)
  const totRows=tvaOn?[['Total HT',eur(T.ht)],...T.parTaux.map(t=>[`TVA ${String(t.taux).replace('.',',')} %`,eur(t.montant)])]:[];
  const needed=totRows.length*6+30+(isDevis?42:0);
  if(y+needed>BOTTOM){pdf.addPage();fill(G);pdf.rect(0,0,W,5,'F');y=20}
  y+=3;const tw=78,tx=R-tw;let ty=y;
  totRows.forEach(r=>{font('normal',9);col(MUT);pdf.text(r[0],tx+4,ty+4);col(INK);pdf.text(r[1],R-4,ty+4,{align:'right'});ty+=6});
  fill(G);pdf.roundedRect(tx,ty,tw,12,2,2,'F');font('bold',11);pdf.setTextColor(255,255,255);
  pdf.text(d.type==='avoir'?'Montant de l’avoir':tvaOn?'Total TTC':isDevis?'Montant total':'Total à payer',tx+4,ty+7.8);pdf.text(eur(T.ttc),R-4,ty+7.8,{align:'right'});ty+=12;
  if(!tvaOn&&d.type!=='recue'){font('normal',7.8);col(MUT);pdf.text('TVA non applicable, art. 293 B du CGI',R,ty+4.5,{align:'right'});ty+=5}
  // Bloc de gauche
  let gy=y+1;const gw=tx-M-8;
  if(d.type==='facture'){
    label('Règlement',M,gy+3);font('normal',8.8);col(INK);
    const pl=d.paid?[]:[`À régler avant le ${fdate(d.ech)}`];if(s.iban)pl.push('Virement : '+fmtIban(s.iban));if(s.bic)pl.push('BIC : '+s.bic);
    if(pl.length)pdf.text(pl,M,gy+8,{lineHeightFactor:1.45});gy+=(d.paid?4:8)+pl.length*4.4;
  }
  if(d.paid){const t=`PAYÉE LE ${fdate(d.paid.date).toUpperCase()} - ${d.paid.mode.toUpperCase()}`;font('bold',8);const w=pdf.getTextWidth(t)+8;fill([221,242,232]);pdf.roundedRect(M,gy+1,w,7,3.5,3.5,'F');col([19,122,83]);pdf.text(t,M+4,gy+5.8);gy+=10}
  y=Math.max(ty,gy)+8;
  // Note
  if(d.notes){font('normal',9);const nl=pdf.splitTextToSize(d.notes,R-M-8);const nh=nl.length*4.4+10;if(y+nh>BOTTOM){pdf.addPage();y=20}
    fill(SOFT);pdf.roundedRect(M,y,R-M,nh,2,2,'F');label('Note',M+4,y+5.5);font('normal',9);col(INK);pdf.text(nl,M+4,y+10.5,{lineHeightFactor:1.4});y+=nh+6}
  // Conditions
  const cond=[];
  if(d.type==='facture'){cond.push('Pas d’escompte pour paiement anticipé. En cas de retard de paiement, des pénalités au taux de trois fois le taux d’intérêt légal sont exigibles'+(isPro?', ainsi qu’une indemnité forfaitaire de 40 € pour frais de recouvrement.':'.'))}
  if(isDevis)cond.push('Devis gratuit. Les prix sont fermes pendant la durée de validité indiquée.');
  if(s.metier==='artisan'&&s.decAssureur)cond.push(`Assurance décennale : ${s.decAssureur}${s.decContrat?', contrat n° '+s.decContrat:''}${s.decZone?', couverture : '+s.decZone:''}.`);
  if(s.piedPage)cond.push(s.piedPage);
  if(cond.length){font('normal',7.8);const all=cond.flatMap(t=>pdf.splitTextToSize(t,R-M));if(y+all.length*3.6+6>BOTTOM){pdf.addPage();y=20}
    label('Conditions',M,y);col(MUT);font('normal',7.8);pdf.text(all,M,y+4.5,{lineHeightFactor:1.4});y+=6+all.length*3.6+4}
  // Bon pour accord (devis)
  if(isDevis){const sh=34;if(y+sh>BOTTOM){pdf.addPage();y=20}
    const sx=R-96;draw(LINE);pdf.setLineWidth(.3);pdf.roundedRect(sx,y,96,sh,2,2,'S');
    label('Bon pour accord',sx+5,y+6);font('normal',8);col(MUT);pdf.text('Date, signature et mention « lu et approuvé »',sx+5,y+11);
    draw([200,196,188]);pdf.setLineDashPattern([1,1],0);pdf.line(sx+5,y+sh-6,sx+91,y+sh-6);pdf.setLineDashPattern([],0);
    font('normal',8);col(MUT);pdf.text('Le',sx+5,y+20);pdf.text('À',sx+50,y+20);y+=sh+6}
  // Pied de page sur chaque page
  const nP=pdf.internal.getNumberOfPages();
  for(let i=1;i<=nP;i++){pdf.setPage(i);draw(LINE);pdf.setLineWidth(.3);pdf.line(M,282,R,282);font('normal',7.4);col(MUT);
    pdf.text(`${s.nomLegal||s.nomAffiche}  -  SIRET ${fmtSiret(s.siret)}${s.adresse?'  -  '+s.adresse+', '+s.cp+' '+s.ville:''}`,M,287);
    pdf.text(`${numOf(d)}  -  page ${i}/${nP}`,R,287,{align:'right'})}
  pdf.setPage(nP);
  const name=(d.num||'brouillon')+'.pdf';
  if(!fx||d.type==='devis'||!window.PDFLib){download(name,pdf.output('blob'),'application/pdf');if(fx&&d.type!=='devis'&&!window.PDFLib)toast('Factur-X indisponible : PDF simple téléchargé');return}
  try{
    const {PDFDocument,PDFName,PDFString,AFRelationship}=window.PDFLib;
    const doc=await PDFDocument.load(pdf.output('arraybuffer'));const xml=new TextEncoder().encode(buildCII(d));const now=new Date();
    const opts={mimeType:'text/xml',description:'Factur-X',creationDate:now,modificationDate:now};if(AFRelationship)opts.afRelationship=AFRelationship.Data;
    await doc.attach(xml,'factur-x.xml',opts);
    doc.setTitle(`${TYPES[d.type]} ${d.num}`);doc.setAuthor(s.nomAffiche||'');doc.setCreator('Tampon');doc.setProducer('Tampon (bnia.lab)');doc.setSubject('Factur-X EN 16931');
    const xmp=`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${x(TYPES[d.type]+' '+d.num)}</rdf:li></rdf:Alt></dc:title></rdf:Description><rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
    const st=doc.context.stream(xmp,{Type:'Metadata',Subtype:'XML'});doc.catalog.set(PDFName.of('Metadata'),doc.context.register(st));
    const bytes=await doc.save();download(name,new Blob([bytes],{type:'application/pdf'}));toast('Facture Factur-X téléchargée');
  }catch(err){download(name,pdf.output('blob'),'application/pdf');toast('Factur-X indisponible : PDF simple téléchargé')}
}

/* =====================================================================
   Navigation
   ===================================================================== */
const VIEWS=['accueil','aide','mentions','confidentialite','bienvenue','journee','documents','clients','reglages'];
const APP=['journee','documents','clients','reglages'];
function refresh(){const v=current;if(!P())return;if(v==='journee')renderDay();if(v==='documents')renderDocs();if(v==='clients')renderClients();if(v==='reglages')renderSet()}
let current='accueil';
function show(v){
  if(!VIEWS.includes(v))v=P()?'journee':'accueil';
  if(APP.includes(v)&&!P())v='bienvenue';
  current=v;VIEWS.forEach(x=>$('#v-'+x).hidden=x!==v);
  const inApp=APP.includes(v);document.body.classList.toggle('inapp',inApp);
  $('#appTabs').hidden=!inApp;$('#navStart').hidden=inApp||v==='bienvenue';
  $('#navStart').textContent=P()?'Ouvrir Tampon':'Commencer';$('#navStart').href=P()?'#journee':'#bienvenue';
  $('#heroCta').textContent=P()?'Ouvrir Tampon':'Essayer gratuitement 14 jours';$('#heroTrial').hidden=!!P();$('#heroLogin').hidden=!!P();$('#heroCta').href=P()?'#journee':'#bienvenue';
  $$('#appTabs a').forEach(a=>{if(a.dataset.tab===v)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(v==='bienvenue')startQuiz();else refresh();
  window.scrollTo({top:0});
}
window.addEventListener('hashchange',()=>{if(!$('#viewer').hidden){$('#viewer').hidden=true;document.body.style.overflow='';V=null}if(!$('#dlg').hidden)closeDialog();show(location.hash.slice(1))});
/* =====================================================================
   Verrouillage par code (PBKDF2, le code n'est jamais stocké)
   ===================================================================== */
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function pinHash(pin,saltHex,iter){
  const salt=new Uint8Array(saltHex.match(/../g).map(h=>parseInt(h,16)));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},key,256));
}
const cryptoOk=()=>!!(window.crypto&&crypto.subtle&&window.isSecureContext);
function pinDialog(){
  if(!cryptoOk()){toast('Le code n’est disponible que sur une connexion sécurisée (https)');return}
  dialog(`<h2 id="dlgTitle">${DB.sec?'Changer le code':'Créer un code'}</h2><p>De 4 à 8 chiffres. Si vous l’oubliez, il faudra effacer les données de cet appareil et restaurer une sauvegarde.</p>
    <div class="fld"><label for="pin1">Nouveau code</label><input class="in pin" id="pin1" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8"></div>
    <div class="fld"><label for="pin2">Confirmez le code</label><input class="in pin" id="pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8"></div>
    <span class="err" id="pinErr" hidden></span><div class="row-btns"><button class="btn primary" type="button" id="pinOk">Enregistrer</button><button class="btn" type="button" data-dlg-close>Annuler</button></div>`,box=>{
    box.querySelector('#pinOk').onclick=async()=>{const a=box.querySelector('#pin1').value,b=box.querySelector('#pin2').value;const er=box.querySelector('#pinErr');
      if(!/^\d{4,8}$/.test(a)){er.textContent='Le code doit contenir de 4 à 8 chiffres.';er.hidden=false;return}
      if(a!==b){er.textContent='Les deux codes ne sont pas identiques.';er.hidden=false;return}
      const salt=hex(crypto.getRandomValues(new Uint8Array(16)));const iter=210000;DB.sec={salt,iter,hash:await pinHash(a,salt,iter)};save();log('Code de verrouillage enregistré');closeDialog();renderSet();toast('Code enregistré')};
  });
}
let locked=false,fails=0,waitUntil=0,hiddenAt=0;
function lockNow(){
  if(!DB.sec)return;locked=true;closeDialog();const L=$('#lock');
  L.innerHTML=`<form class="lock-box" id="lockForm" novalidate><svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="var(--stamp)"/><g transform="rotate(-10 256 256)"><circle cx="256" cy="256" r="150" fill="none" stroke="var(--paper)" stroke-width="30"/><rect x="190" y="190" width="132" height="34" rx="7" fill="var(--paper)"/><rect x="239" y="190" width="34" height="138" rx="7" fill="var(--paper)"/></g></svg>
    <h1 style="font-size:26px">Tampon est verrouillé</h1><label for="lockIn">Entrez votre code</label><input class="big-in pin" id="lockIn" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8"><span class="err" id="lockErr" hidden></span>
    <button class="btn primary" type="submit" style="width:100%">Déverrouiller</button><button class="link muted" type="button" id="lockForgot">Code oublié ?</button></form>`;
  L.hidden=false;document.body.style.overflow='hidden';setTimeout(()=>{const i=$('#lockIn');if(i)i.focus()},50);
  $('#lockForm').onsubmit=async e=>{e.preventDefault();const er=$('#lockErr');const now=Date.now();
    if(now<waitUntil){er.textContent=`Trop d’essais. Réessayez dans ${Math.ceil((waitUntil-now)/1000)} secondes.`;er.hidden=false;return}
    const v=$('#lockIn').value;let ok=false;try{ok=(await pinHash(v,DB.sec.salt,DB.sec.iter))===DB.sec.hash}catch(err){}
    if(ok){locked=false;fails=0;L.hidden=true;L.innerHTML='';document.body.style.overflow='';return}
    fails++;if(fails>=5){waitUntil=Date.now()+30000*(fails-4)}er.textContent=fails>=5?'Code incorrect. Patientez 30 secondes avant de réessayer.':'Code incorrect.';er.hidden=false;$('#lockIn').value='';$('#lockIn').focus()};
  $('#lockForgot').onclick=()=>{const b=$('#lockForm');b.innerHTML=`<h1 style="font-size:24px">Code oublié</h1><p>Pour des raisons de sécurité, le code ne peut pas être récupéré. Vous pouvez effacer les données de cet appareil, puis restaurer votre dernière sauvegarde.</p><button class="btn danger" type="button" id="lockWipe" style="width:100%">Effacer les données de cet appareil</button><button class="link" type="button" id="lockBack">Revenir</button>`;
    $('#lockBack').onclick=lockNow;$('#lockWipe').onclick=()=>{try{localStorage.removeItem(KEY)}catch(e){}DB=blank();locked=false;$('#lock').hidden=true;document.body.style.overflow='';location.hash='accueil';show('accueil');toast('Données effacées')}};
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(DB.sec&&!locked&&hiddenAt&&Date.now()-hiddenAt>5*60000)lockNow()});

load();
show(location.hash.slice(1)||(P()?'journee':'accueil'));
if(DB.sec)lockNow();
if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(()=>{})}


/* =====================================================================
   Comptes en ligne (Supabase) : connexion, synchronisation, formule
   La clé ci-dessous est la clé publique du projet : elle ne donne accès
   qu'à ce que les règles de la base autorisent pour l'utilisateur connecté.
   ===================================================================== */
var SB_URL='https://cxdcmaguipvztmctxkkh.supabase.co';
var SB_KEY='sb_publishable_hRiEUv_4zV-tsojFGQTfMw_yaF0acgF';
var RETOUR=location.origin+location.pathname;
var sb=null,cUser=null,cVersion=null,cTimer=null,cBusy=false,cPending=false,cLastSync=null,cErr='',cApplying=false;
function cloudAvailable(){return !!(window.supabase&&window.supabase.createClient)&&location.protocol==='https:'||!!window.__TAMPON_TEST_SB}
function cloudUser(){return cUser}
function downloadBackup(){download(`tampon-sauvegarde-${iso(today())}.json`,JSON.stringify(Object.assign({},DB,{sec:null})),'application/json');DB.meta=DB.meta||{};DB.meta.lastBackup=iso(today());log('Sauvegarde téléchargée')}
document.addEventListener('click',e=>{if(e.target.closest('[data-login]'))authDialog('login')});

function cloudInit(){
  if(!cloudAvailable())return;
  const factory=window.__TAMPON_TEST_SB||window.supabase;
  sb=factory.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
  sb.auth.onAuthStateChange((ev,session)=>{
    if(ev==='PASSWORD_RECOVERY'){setTimeout(newPasswordDialog,100);return}
    if(ev==='SIGNED_OUT'){cUser=null;cVersion=null;renderAfterCloud();return}
    if(session&&session.user&&(!cUser||cUser.id!==session.user.id)){cUser=session.user;setTimeout(()=>afterLogin(),0)}
  });
  sb.auth.getSession().then(({data})=>{if(data&&data.session&&!cUser){cUser=data.session.user;afterLogin()}});
  // nettoie l'adresse après un lien reçu par email
  if(/[?&]code=/.test(location.search))setTimeout(()=>history.replaceState(null,'',location.pathname+location.hash),1500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cUser)pullIfNewer()});
  window.addEventListener('online',()=>{if(cUser&&cPending)cloudQueue()});
}
function renderAfterCloud(){try{if(current==='reglages')renderSet();else refresh();show(current)}catch(e){}}

/* Après connexion : récupère l'espace en ligne ou y envoie celui de l'appareil */
async function afterLogin(){
  try{
    const {data:row,error}=await sb.from('tampon_espaces').select('data,version').eq('user_id',cUser.id).maybeSingle();
    if(error)throw error;
    const localHas=!!(DB.profile&&(DB.docs.length||DB.clients.length));
    const localOther=DB.meta&&DB.meta.uid&&DB.meta.uid!==cUser.id;
    if(row){
      cVersion=row.version;
      const remote=cleanDB(row.data||{});
      if(localHas&&!localOther&&!(DB.meta&&DB.meta.uid)&&remote.profile){
        // données créées sans compte sur cet appareil + données en ligne : on demande
        return chooseSide(remote);
      }
      applyRemote(remote);
    }else{
      cVersion=null;
      if(localOther){DB=blank()}
      DB.meta=DB.meta||{};DB.meta.uid=cUser.id;
      if(DB.profile)await pushNow();
    }
    await refreshPlan();
    cErr='';renderAfterCloud();
    if(!DB.profile&&location.hash!=='#bienvenue')location.hash='bienvenue';
  }catch(e){cErr='Connexion au serveur impossible pour l’instant. Vos données restent sur cet appareil.';renderAfterCloud()}
}
function applyRemote(remote){const sec=DB.sec;cApplying=true;DB=remote;DB.sec=sec;DB.meta=DB.meta||{};DB.meta.uid=cUser.id;save();cApplying=false}
function chooseSide(remote){
  const nR=remote.docs.length,nL=DB.docs.length;
  dialog(`<h2 id="dlgTitle">Quelles données garder ?</h2><p>Votre compte contient déjà un espace (${nR} document${nR>1?'s':''}), et cet appareil aussi (${nL} document${nL>1?'s':''}).</p>
    <div class="row-btns"><button class="btn primary" type="button" id="csRemote">Garder celles du compte</button><button class="btn" type="button" id="csLocal">Garder celles de cet appareil</button></div>
    <p class="fine" style="margin:0">L’autre version sera remplacée. Par précaution, téléchargez d’abord une sauvegarde.</p><button class="link" type="button" id="csBk" style="align-self:flex-start">Télécharger une sauvegarde de cet appareil</button>`,box=>{
    box.querySelector('#csBk').onclick=()=>downloadBackup();
    box.querySelector('#csRemote').onclick=async()=>{closeDialog();applyRemote(remote);await refreshPlan();renderAfterCloud();toast('Données du compte chargées')};
    box.querySelector('#csLocal').onclick=async()=>{closeDialog();DB.meta=DB.meta||{};DB.meta.uid=cUser.id;await pushNow(true);await refreshPlan();renderAfterCloud();toast('Données de cet appareil envoyées dans votre compte')};
  });
}

/* Formule lue sur le serveur (l'essai, la formule et le paiement ne se modifient pas depuis l'appareil) */
async function refreshPlan(){
  if(!cUser||!DB.profile)return;
  const {data,error}=await sb.rpc('tampon_mon_abonnement',{p_siret:DB.profile.siret||null});
  if(error||!data)return;
  const a=Array.isArray(data)?data[0]:data;
  cApplying=true;DB.profile.plan=a.formule;DB.profile.trialStart=a.essai_debut||'';DB.profile.statutPaiement=a.statut_paiement||'';DB.profile.finPeriode=a.fin_periode||'';save();cApplying=false;
}

/* Synchronisation : envoi groupé 1,5 seconde après une modification */
function cloudQueue(){if(!sb||!cUser||cApplying)return;cPending=true;clearTimeout(cTimer);cTimer=setTimeout(()=>pushNow(),1500)}
async function pushNow(force){
  if(!sb||!cUser||!DB.profile)return;
  if(cBusy){cPending=true;return}
  cBusy=true;cPending=false;
  const data=Object.assign({},DB,{sec:null});
  try{
    if(cVersion==null){
      const {data:r,error}=await sb.from('tampon_espaces').upsert({user_id:cUser.id,data,version:1,updated_at:new Date().toISOString()}).select('version').single();
      if(error)throw error;cVersion=r.version;
    }else{
      let q=sb.from('tampon_espaces').update({data,version:cVersion+1,updated_at:new Date().toISOString()}).eq('user_id',cUser.id);
      if(!force)q=q.eq('version',cVersion);
      const {data:r,error}=await q.select('version');
      if(error)throw error;
      if(!r||!r.length){cBusy=false;return conflict()}
      cVersion=r[0].version;
    }
    cLastSync=new Date();cErr='';
  }catch(e){cErr=navigator.onLine?'Synchronisation impossible pour l’instant : nouvel essai automatique.':'Hors ligne : vos changements seront envoyés au retour du réseau.';cPending=true;setTimeout(()=>{if(cPending)cloudQueue()},30000)}
  cBusy=false;if(current==='reglages')renderAccount();
  if(cPending)cloudQueue();
}
async function pullIfNewer(){
  if(!sb||!cUser||cBusy||cPending)return;
  const {data:row}=await sb.from('tampon_espaces').select('data,version').eq('user_id',cUser.id).maybeSingle();
  if(row&&cVersion!=null&&row.version>cVersion){cVersion=row.version;applyRemote(cleanDB(row.data||{}));await refreshPlan();renderAfterCloud();toast('Données mises à jour depuis votre autre appareil')}
  else{await refreshPlan();if(current==='journee')renderDay()}
}
function conflict(){
  dialog(`<h2 id="dlgTitle">Modifié sur un autre appareil</h2><p>Votre espace a été modifié ailleurs pendant que vous travailliez ici. Quelle version garder ?</p>
    <div class="row-btns"><button class="btn primary" type="button" id="cfRemote">Reprendre la version en ligne</button><button class="btn" type="button" id="cfLocal">Garder celle de cet appareil</button></div>`,box=>{
    box.querySelector('#cfRemote').onclick=async()=>{closeDialog();const {data:row}=await sb.from('tampon_espaces').select('data,version').eq('user_id',cUser.id).maybeSingle();if(row){cVersion=row.version;applyRemote(cleanDB(row.data||{}));renderAfterCloud()}};
    box.querySelector('#cfLocal').onclick=()=>{closeDialog();pushNow(true)};
  });
}

/* Connexion, création de compte, mot de passe */
const AUTH_ERR=m=>/invalid login/i.test(m)?'Email ou mot de passe incorrect.':/already registered|already exists/i.test(m)?'Un compte existe déjà avec cet email : connectez-vous.':/rate limit|too many/i.test(m)?'Trop de tentatives : réessayez dans quelques minutes.':/password/i.test(m)?'Mot de passe trop faible : 8 caractères minimum, évitez les mots de passe courants.':/email not confirmed/i.test(m)?'Confirmez d’abord votre email avec le lien reçu.':'Impossible de se connecter pour l’instant. Vérifiez votre connexion.';
async function cloudSignUp(mail,pwd){
  if(!sb)return {error:'Les comptes ne sont pas disponibles hors connexion.'};
  const {data,error}=await sb.auth.signUp({email:mail,password:pwd,options:{emailRedirectTo:RETOUR}});
  if(error)return {error:AUTH_ERR(error.message)};
  if(data&&data.session)return {ok:true};
  return {confirm:true};
}
function authDialog(mode){
  if(!cloudAvailable()||!sb){toast('Les comptes en ligne ne sont pas disponibles ici. Ouvrez Tampon depuis son adresse web.');return}
  const login=mode==='login';
  dialog(`<h2 id="dlgTitle">${login?'Se connecter':'Créer un compte gratuit'}</h2>
    ${login?'':'<p class="fine" style="margin:0">Vos documents seront gardés en ligne et sur tous vos appareils.</p>'}
    <form id="auF" class="form" novalidate style="grid-template-columns:1fr"><div class="fld"><label for="auMail">Email</label><input class="in" id="auMail" type="email" autocomplete="username" value="${esc((P()&&P().email)||'')}"></div>
    <div class="fld"><label for="auPwd">Mot de passe${login?'':' (8 caractères minimum)'}</label><input class="in" id="auPwd" type="password" autocomplete="${login?'current-password':'new-password'}"></div>
    <span class="err" id="auErr" hidden></span><div class="row-btns"><button class="btn primary" type="submit" id="auOk">${login?'Se connecter':'Créer mon compte'}</button><button class="btn" type="button" data-dlg-close>Annuler</button></div></form>
    <div class="row-btns">${login?'<button class="link" type="button" id="auForgot">Mot de passe oublié ?</button><button class="link" type="button" id="auSwitch">Créer un compte</button>':'<button class="link" type="button" id="auSwitch">J’ai déjà un compte</button>'}</div>`,box=>{
    const er=m=>{const e=box.querySelector('#auErr');e.textContent=m;e.hidden=!m};
    box.querySelector('#auSwitch').onclick=()=>authDialog(login?'signup':'login');
    const fg=box.querySelector('#auForgot');if(fg)fg.onclick=async()=>{const mail=box.querySelector('#auMail').value.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail))return er('Indiquez votre email, puis touchez « Mot de passe oublié ».');const {error}=await sb.auth.resetPasswordForEmail(mail,{redirectTo:RETOUR});er('');if(error)return er(AUTH_ERR(error.message));closeDialog();toast('Si un compte existe, un email de réinitialisation vient d’être envoyé.')};
    box.querySelector('#auF').onsubmit=async e=>{e.preventDefault();const mail=box.querySelector('#auMail').value.trim(),pwd=box.querySelector('#auPwd').value;
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail))return er('Indiquez une adresse email valide.');
      if(!login&&pwd.length<8)return er('Le mot de passe doit faire au moins 8 caractères.');
      const b=box.querySelector('#auOk');b.disabled=true;
      if(login){const {error}=await sb.auth.signInWithPassword({email:mail,password:pwd});b.disabled=false;if(error)return er(AUTH_ERR(error.message));closeDialog();toast('Connecté');if(location.hash==='#accueil'||!location.hash)location.hash='journee'}
      else{const r=await cloudSignUp(mail,pwd);b.disabled=false;if(r.error)return er(r.error);closeDialog();toast(r.confirm?'Compte créé : confirmez votre email avec le lien reçu.':'Compte créé')}
    };
  });
}
function newPasswordDialog(){
  dialog(`<h2 id="dlgTitle">Nouveau mot de passe</h2><div class="fld"><label for="npPwd">Mot de passe (8 caractères minimum)</label><input class="in" id="npPwd" type="password" autocomplete="new-password"></div><span class="err" id="npErr" hidden></span><div class="row-btns"><button class="btn primary" type="button" id="npOk">Enregistrer</button></div>`,box=>{
    box.querySelector('#npOk').onclick=async()=>{const v=box.querySelector('#npPwd').value;const e=box.querySelector('#npErr');if(v.length<8){e.textContent='8 caractères minimum.';e.hidden=false;return}
      const {error}=await sb.auth.updateUser({password:v});if(error){e.textContent=AUTH_ERR(error.message);e.hidden=false;return}closeDialog();toast('Mot de passe modifié')};
  });
}
async function cloudSignOut(silent){
  if(!sb)return;try{await sb.auth.signOut()}catch(e){}
  cUser=null;cVersion=null;
  if(!silent){const sec=DB.sec;DB=blank();DB.sec=sec;save();location.hash='accueil';toast('Déconnecté. Vos données restent dans votre compte.')}
}
function renderAccount(){
  const el=$('#accountPanel');if(!el)return;
  if(!cloudAvailable()){el.innerHTML='<p>Les comptes en ligne sont disponibles quand Tampon est ouvert depuis son adresse web.</p>';return}
  if(!cUser){el.innerHTML=`<p>Sans compte, vos données ne sont que sur cet appareil. Avec un compte gratuit, elles sont gardées en ligne, en Europe, et vous les retrouvez partout.</p><div class="row-btns"><button class="btn sm primary" type="button" id="acNew">Créer un compte</button><button class="btn sm" type="button" data-login>Se connecter</button></div>`;
    el.querySelector('#acNew').onclick=()=>authDialog('signup');return}
  const when=cLastSync?`Synchronisé à ${String(cLastSync.getHours()).padStart(2,'0')}:${String(cLastSync.getMinutes()).padStart(2,'0')}`:'Données synchronisées';
  el.innerHTML=`<p><b>${esc(cUser.email||'')}</b><br><span class="fine" style="margin:0"><span class="syncdot ${cErr?'off':''}"></span>${esc(cErr||when)}</span></p>
    <div class="row-btns"><button class="btn sm" type="button" id="acSync">Synchroniser maintenant</button><button class="btn sm" type="button" id="acOut">Se déconnecter</button><button class="btn sm danger" type="button" id="acDel">Supprimer mon compte</button></div>`;
  el.querySelector('#acSync').onclick=()=>{pushNow().then(pullIfNewer)};
  el.querySelector('#acOut').onclick=()=>confirmBox('Se déconnecter ?','Vos données restent dans votre compte et seront retirées de cet appareil.','Se déconnecter',async()=>{await pushNow();cloudSignOut(false)});
  el.querySelector('#acDel').onclick=()=>confirmBox('Supprimer votre compte ?','Votre compte, vos factures, devis, clients et justificatifs seront effacés définitivement, en ligne et sur cet appareil. Vous devez conserver vos factures 10 ans : téléchargez d’abord une sauvegarde.','Supprimer définitivement',async()=>{
    const {error}=await sb.functions.invoke('tampon-supprimer-compte',{body:{}});
    if(error){toast('Suppression impossible pour l’instant. Réessayez plus tard.');return}
    try{await sb.auth.signOut()}catch(e){}cUser=null;cVersion=null;try{localStorage.removeItem(KEY)}catch(e){}DB=blank();location.hash='accueil';toast('Compte supprimé')},true);
}

/* Formules payantes : Stripe si configuré, sinon activation de test */
async function choosePlanOnline(pl){
  const p=P();
  if(pl.prix){
    toast('Ouverture du paiement sécurisé…');
    const {data,error}=await sb.functions.invoke('tampon-paiement',{body:{formule:pl.id}});
    if(data&&data.url){location.href=data.url;return}
    let code='';try{code=error&&error.context&&(await error.context.json()).erreur}catch(e){}
    if(code!=='paiement_non_configure'){toast('Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.');return}
  }
  const txt=pl.prix?`Le paiement en ligne n’est pas encore activé. Pendant la phase de test, la formule ${pl.nom} est activée gratuitement.`:'Les relances, l’estimation URSSAF et Factur-X ne seront plus disponibles.';
  confirmBox(`Passer en ${pl.nom} ?`,txt,`Choisir ${pl.nom}`,async()=>{
    const {error}=await sb.rpc('tampon_choisir_formule_test',{p_formule:pl.id});
    if(error){toast('Changement impossible : '+(/paiement/.test(error.message)?'votre abonnement se gère depuis « Gérer mon abonnement ».':'réessayez plus tard.'));return}
    await refreshPlan();log(`Formule ${pl.nom} choisie`);renderSet();toast(`Formule ${pl.nom} activée`)});
}
async function openPortal(){
  const {data}=await sb.functions.invoke('tampon-paiement',{body:{action:'portail'}});
  if(data&&data.url)location.href=data.url;else toast('La gestion de l’abonnement n’est pas disponible pour l’instant.');
}

cloudInit();
})();
