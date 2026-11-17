/* bnia.lab · Assistant administratif artisans
   Données dans Supabase (voir ../supabase/schema.sql).
   La clé ci-dessous est la clé PUBLIQUE : la sécurité repose sur les règles RLS de la base. */
const SB_URL = 'https://cxdcmaguipvztmctxkkh.supabase.co';
const SB_KEY = 'sb_publishable_hRiEUv_4zV-tsojFGQTfMw_yaF0acgF';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

/* ---------- état ---------- */
let user = null, entId = null, role = null, members = [];
let db = { profile: {}, clients: [], docs: [] };

/* ---------- utilitaires ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + (+n || 0)); return x.toISOString().slice(0, 10) };
const fdate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR') : '';
const daysLate = d => Math.floor((new Date(today()) - new Date(d)) / 864e5);
const P = () => db.profile;
const isMicro = () => P().statut === 'micro';
const isDir = () => role === 'directeur';
const client = id => db.clients.find(c => c.id === id) || { nom: 'Client supprimé' };
const $ = id => document.getElementById(id);
function toast(m, ms = 2600) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms) }

/* Appel Supabase : affiche l'erreur en clair et interrompt l'action. */
async function q(promise) {
  const { data, error } = await promise;
  if (error) { toast(errMsg(error), 4500); throw error }
  return data;
}
function errMsg(e) {
  const m = e?.message || String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Pas de connexion internet. Réessayez.';
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(m)) return 'Confirmez d\'abord votre e-mail (lien reçu par mail).';
  if (/already registered/i.test(m)) return 'Un compte existe déjà avec cet e-mail : connectez-vous.';
  if (/Password should be/i.test(m)) return 'Mot de passe trop court (6 caractères minimum).';
  if (/row-level security|permission denied/i.test(m)) return 'Action non autorisée pour votre compte.';
  return m;
}
async function busy(fn) { document.body.classList.add('loading'); try { return await fn() } catch (e) { console.error(e) } finally { document.body.classList.remove('loading') } }

/* ---------- conversion base <-> appli ---------- */
const P_MAP = { nom: 'nom', statut: 'statut', metier: 'metier', siret: 'siret', rm: 'rm', adresse: 'adresse', cp: 'cp', ville: 'ville', tel: 'tel', email: 'email', tvaIntra: 'tva_intra', capital: 'capital', assureur: 'assureur', assuranceZone: 'assurance_zone', iban: 'iban', delai: 'delai_paiement', validite: 'validite_devis' };
const profileFromRow = r => Object.fromEntries(Object.entries(P_MAP).map(([k, c]) => [k, r[c] ?? '']));
const lignesFromRows = rows => (rows || []).sort((a, b) => a.position - b.position).map(l => ({ d: l.designation, q: +l.quantite, u: l.unite || '', pu: +l.prix_unitaire_ht, tva: +l.taux_tva }));
const lignesToRows = lignes => lignes.map((l, i) => ({ position: i, designation: l.d || '', quantite: +l.q || 0, unite: l.u || null, prix_unitaire_ht: +l.pu || 0, taux_tva: isMicro() ? 0 : (+l.tva || 0) }));
const devisFromRow = r => ({ id: r.id, type: 'devis', num: r.numero, clientId: r.client_id, objet: r.objet, chantier: r.chantier, date: r.date_devis, validite: r.validite_jours, acompte: +r.acompte_pct, note: r.note, statut: r.statut, envoyeLe: r.envoye_le, cree: Date.parse(r.created_at), lignes: lignesFromRows(r.lignes) });
const factFromRow = r => ({ id: r.id, type: 'facture', num: r.numero, clientId: r.client_id, objet: r.objet, chantier: r.chantier, date: r.date_facture, dateExec: r.date_execution, echeance: r.echeance, note: r.note, statut: r.statut === 'emise' ? 'envoyee' : r.statut, payeLe: r.paye_le, devisId: r.devis_id, cree: Date.parse(r.created_at), relances: (r.relances || []).map(x => x.envoyee_le).sort(), lignes: lignesFromRows(r.lignes) });

/* ---------- chargement ---------- */
async function loadAll() {
  const [ent, clients, devis, facts, mem] = await Promise.all([
    q(sb.from('entreprises').select('*').eq('id', entId).single()),
    q(sb.from('clients').select('*').eq('entreprise_id', entId)),
    q(sb.from('devis').select('*, lignes(*)').eq('entreprise_id', entId)),
    isDir() ? q(sb.from('factures').select('*, lignes(*), relances(envoyee_le)').eq('entreprise_id', entId)) : [],
    q(sb.from('membres').select('user_id, role').eq('entreprise_id', entId)),
  ]);
  db.profile = profileFromRow(ent);
  db.clients = clients;
  db.docs = [...devis.map(devisFromRow), ...facts.map(factFromRow)];
  db.docs.forEach(d => { if (d.devisId) d.devisNum = db.docs.find(x => x.id === d.devisId)?.num });
  members = mem;
}
async function refresh() { await loadAll(); render() }

/* ---------- connexion ---------- */
let authMode = 'login';
function showAuth(html) { $('auth').classList.add('on'); $('authBody').innerHTML = html }
function hideAuth() { $('auth').classList.remove('on') }
function authForm() {
  const signup = authMode === 'signup';
  showAuth(`
    <h1>${signup ? 'Créer mon compte' : 'Connexion'}</h1>
    <p>${signup ? 'Devis, factures et relances, depuis votre téléphone.' : 'Retrouvez vos devis et factures sur tous vos appareils.'}</p>
    <div class="seg" id="authSeg"><button type="button" data-v="login" class="${signup ? '' : 'on'}">J'ai un compte</button><button type="button" data-v="signup" class="${signup ? 'on' : ''}">Créer un compte</button></div>
    <form onsubmit="doAuth(event)">
      <label>E-mail</label><input id="a_email" type="email" autocomplete="email" required>
      <label>Mot de passe</label><input id="a_pass" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required>
      <div class="actions"><button class="btn dark" style="width:100%">${signup ? 'Créer mon compte' : 'Se connecter'}</button></div>
      <div class="err" id="a_err"></div>
    </form>
    ${signup ? '' : '<button class="btn ghost sm" onclick="forgot()">Mot de passe oublié ?</button>'}`);
  bindSeg('authSeg', v => { authMode = v; authForm() });
}
async function doAuth(e) {
  e.preventDefault();
  const email = $('a_email').value.trim(), password = $('a_pass').value, err = $('a_err');
  err.textContent = '';
  const btn = e.target.querySelector('button'); btn.disabled = true;
  try {
    if (authMode === 'signup') {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      if (!data.session) showAuth(`<h1>Vérifiez vos e-mails</h1><p>Un lien de confirmation a été envoyé à <b>${esc(email)}</b>. Cliquez dessus, puis revenez vous connecter.</p><button class="btn dark" onclick="authMode='login';authForm()">Se connecter</button>`);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (x) { err.textContent = errMsg(x) } finally { btn.disabled = false }
}
async function forgot() {
  const email = $('a_email').value.trim();
  if (!email) { $('a_err').textContent = 'Indiquez d\'abord votre e-mail ci-dessus.'; return }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  $('a_err').textContent = error ? errMsg(error) : 'Un e-mail pour choisir un nouveau mot de passe vient d\'être envoyé.';
}
function newPassword() {
  showAuth(`<h1>Nouveau mot de passe</h1><form onsubmit="savePassword(event)"><label>Nouveau mot de passe</label><input id="a_new" type="password" minlength="6" required autocomplete="new-password"><div class="actions"><button class="btn dark" style="width:100%">Enregistrer</button></div><div class="err" id="a_err"></div></form>`);
}
async function savePassword(e) {
  e.preventDefault();
  const { error } = await sb.auth.updateUser({ password: $('a_new').value });
  if (error) return $('a_err').textContent = errMsg(error);
  recovering = false; toast('Mot de passe modifié'); boot();
}
async function logout() { await sb.auth.signOut() }

function onboarding() {
  showAuth(`<h1>Bienvenue 👋</h1><p>Dernière étape : le nom de votre entreprise. Vous compléterez le reste (SIRET, adresse…) juste après.</p>
    <form onsubmit="createEnt(event)"><label>Nom de l'entreprise</label><input id="o_nom" required placeholder="Dupont Plomberie">
    <div class="actions"><button class="btn dark" style="width:100%">Continuer</button></div><div class="err" id="a_err"></div></form>
    <p class="hint" style="margin-top:18px">Vous êtes salarié ? Ne créez pas d'entreprise : demandez à votre directeur de vous ajouter avec l'e-mail <b>${esc(user.email)}</b>, puis <a href="#" onclick="boot();return false">actualisez</a>.</p>
    <button class="btn ghost sm" onclick="logout()">Se déconnecter</button>`);
}
async function createEnt(e) {
  e.preventDefault();
  const { error } = await sb.rpc('creer_entreprise', { p_nom: $('o_nom').value.trim() });
  if (error) return $('a_err').textContent = errMsg(error);
  await boot(); go('reglages');
}

/* Démarrage : session → entreprise → données */
let booting = false, recovering = false;
async function boot() {
  if (booting) return; booting = true;
  try {
    const { data: { session } } = await sb.auth.getSession();
    user = session?.user || null;
    if (!user) { entId = role = null; authMode = 'login'; db = { profile: {}, clients: [], docs: [] }; authForm(); return }
    const m = await q(sb.from('membres').select('entreprise_id, role').eq('user_id', user.id).order('created_at').limit(1));
    if (recovering) return newPassword();
    if (!m.length) return onboarding();
    entId = m[0].entreprise_id; role = m[0].role;
    document.body.classList.toggle('salarie', !isDir());
    await loadAll();
    hideAuth(); fillProfile(); go(document.querySelector('section.on')?.id === 's-reglages' && profileOk() ? 'home' : (document.querySelector('section.on')?.id || 's-home').slice(2));
  } catch (e) { console.error(e); showAuth(`<h1>Connexion impossible</h1><p>${esc(errMsg(e))}</p><button class="btn dark" onclick="boot()">Réessayer</button>`) }
  finally { booting = false }
}
sb.auth.onAuthStateChange((ev) => {
  // Ne jamais appeler Supabase directement dans ce callback (risque de blocage).
  if (ev === 'PASSWORD_RECOVERY') { recovering = true; setTimeout(newPassword, 0) }
  else if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'INITIAL_SESSION') setTimeout(boot, 0);
});

/* ---------- navigation ---------- */
$('tabs').onclick = e => { const b = e.target.closest('button'); if (b) go(b.dataset.s) };
function go(s) { if (s === 'factures' && !isDir()) s = 'home'; document.querySelectorAll('section').forEach(x => x.classList.toggle('on', x.id === 's-' + s)); document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.s === s)); window.scrollTo(0, 0); render() }

function totals(doc) { let ht = 0, tva = 0; (doc.lignes || []).forEach(l => { const m = (+l.q || 0) * (+l.pu || 0); ht += m; if (!isMicro()) tva += m * (+l.tva || 0) / 100 }); return { ht, tva, ttc: ht + tva } }
const profileOk = () => { const p = P(); return p.nom && p.siret && p.adresse && p.cp && p.ville };

/* ---------- rendu ---------- */
function statusTag(d) {
  if (d.type === 'devis') {
    const m = { brouillon: ['Brouillon', ''], envoye: ['Envoyé', 'acc'], accepte: ['Accepté', 'ok'], refuse: ['Refusé', ''], facture: ['Facturé', 'ok'] }; const [t, c] = m[d.statut] || m.brouillon;
    if (d.statut === 'envoye' && daysLate(addDays(d.date, d.validite)) > 0) return '<span class="tag warn">Expiré</span>'; return `<span class="tag ${c}">${t}</span>`
  }
  if (d.statut === 'payee') return '<span class="tag ok">Payée</span>';
  if (d.statut === 'annulee') return '<span class="tag">Annulée</span>';
  const late = daysLate(d.echeance); if (late > 0) return `<span class="tag warn">En retard · ${late} j</span>`;
  return '<span class="tag acc">À encaisser</span>';
}
function rowHtml(d) { const t = totals(d); return `<div class="row" onclick="openDoc('${d.id}')"><div class="l"><b>${esc(client(d.clientId).nom)}</b><small>${esc(d.num)} · ${esc(d.objet || 'Sans objet')}</small></div><div class="r"><b>${eur(t.ttc)}</b><br>${statusTag(d)}</div></div>` }
const emptyHtml = m => `<div class="empty">${m}</div>`;

function render() {
  if (!entId) return;
  const y = String(new Date().getFullYear());
  const facts = db.docs.filter(d => d.type === 'facture' && d.statut !== 'annulee');
  const encY = facts.filter(d => d.statut === 'payee' && (d.payeLe || '').startsWith(y)).reduce((s, d) => s + totals(d).ttc, 0);
  const attente = facts.filter(d => d.statut !== 'payee').reduce((s, d) => s + totals(d).ttc, 0);
  const devisOuverts = db.docs.filter(d => d.type === 'devis' && d.statut === 'envoye');
  const retard = facts.filter(d => d.statut !== 'payee' && daysLate(d.echeance) > 0);
  $('stats').innerHTML = isDir() ? `
    <div class="stat"><small>Encaissé ${y}</small><b>${eur(encY)}</b></div>
    <div class="stat"><small>À encaisser</small><b>${eur(attente)}</b></div>
    <div class="stat"><small>Devis en attente</small><b>${devisOuverts.length}</b></div>
    <div class="stat ${retard.length ? 'alert' : ''}"><small>Factures en retard</small><b>${retard.length}</b></div>`
    : `<div class="stat"><small>Devis en attente</small><b>${devisOuverts.length}</b></div><div class="stat"><small>Devis acceptés</small><b>${db.docs.filter(d => d.type === 'devis' && d.statut === 'accepte').length}</b></div>`;
  $('setupBanner').innerHTML = profileOk() ? '' : isDir() ? `<div class="banner"><b>Première étape :</b> renseignez votre entreprise une seule fois, pour qu'elle apparaisse sur vos devis et factures. <a href="#" onclick="go('reglages');return false">Compléter →</a></div>` : `<div class="banner">Votre directeur doit d'abord compléter les informations de l'entreprise.</div>`;
  const todo = [];
  retard.sort((a, b) => a.echeance < b.echeance ? -1 : 1).forEach(d => { const n = (d.relances || []).length; todo.push(`<div class="row" onclick="relance('${d.id}')"><div class="l"><b>Relancer ${esc(client(d.clientId).nom)}</b><small>${esc(d.num)} · ${daysLate(d.echeance)} jours de retard · ${n ? n + ' relance(s) faite(s)' : 'jamais relancé'}</small></div><div class="r"><b>${eur(totals(d).ttc)}</b><br><span class="tag warn">Relancer</span></div></div>`) });
  if (isDir()) db.docs.filter(d => d.type === 'devis' && d.statut === 'accepte').forEach(d => todo.push(`<div class="row" onclick="toFacture('${d.id}')"><div class="l"><b>Facturer ${esc(client(d.clientId).nom)}</b><small>Devis ${esc(d.num)} accepté</small></div><div class="r"><b>${eur(totals(d).ttc)}</b><br><span class="tag ok">Facturer</span></div></div>`));
  devisOuverts.filter(d => daysLate(d.envoyeLe || d.date) >= 7 && daysLate(addDays(d.date, d.validite)) <= 0).forEach(d => todo.push(`<div class="row" onclick="openDoc('${d.id}')"><div class="l"><b>Pas de réponse : ${esc(client(d.clientId).nom)}</b><small>Devis ${esc(d.num)} envoyé il y a ${daysLate(d.envoyeLe || d.date)} jours</small></div><div class="r"><span class="tag acc">Rappeler</span></div></div>`));
  $('todo').innerHTML = todo.join('') || emptyHtml('Rien d\'urgent. 👌');
  const sorted = [...db.docs].sort((a, b) => (b.cree || 0) - (a.cree || 0));
  $('recent').innerHTML = sorted.slice(0, 5).map(rowHtml).join('') || emptyHtml('Aucun document. Commencez par <a href="#" onclick="newDevis();return false">un devis</a>.');
  $('devisList').innerHTML = sorted.filter(d => d.type === 'devis').map(rowHtml).join('') || emptyHtml('Aucun devis pour l\'instant.');
  $('factList').innerHTML = sorted.filter(d => d.type === 'facture').map(rowHtml).join('') || emptyHtml('Les factures se créent en un clic depuis un devis accepté.');
  $('clientList').innerHTML = [...db.clients].sort((a, b) => a.nom.localeCompare(b.nom)).map(c => { const n = db.docs.filter(d => d.clientId === c.id).length; return `<div class="row" onclick="editClient('${c.id}')"><div class="l"><b>${esc(c.nom)}</b><small>${c.type === 'pro' ? 'Professionnel' : 'Particulier'} · ${esc(c.ville || '')}</small></div><div class="r"><small style="color:var(--soft)">${n} doc.</small></div></div>` }).join('') || emptyHtml('Vos clients s\'ajoutent automatiquement quand vous faites un devis.');
  $('accountInfo').innerHTML = `${esc(user?.email)} · ${isDir() ? 'Directeur' : 'Salarié'} de <b>${esc(P().nom)}</b>`;
  const nbSal = members.filter(m => m.role === 'salarie').length;
  $('teamInfo').textContent = `${members.length} membre${members.length > 1 ? 's' : ''} : vous${nbSal ? ` et ${nbSal} salarié${nbSal > 1 ? 's' : ''}` : ''}.`;
  $('salarieNote').style.display = isDir() ? 'none' : '';
}

/* ---------- modal ---------- */
function modal(title, html) { $('sheet').innerHTML = `<div class="top"><h3>${title}</h3><button class="close" onclick="closeModal()" aria-label="Fermer">×</button></div>${html}`; $('modal').classList.add('on'); document.body.style.overflow = 'hidden' }
function closeModal() { $('modal').classList.remove('on'); document.body.style.overflow = '' }

/* ---------- profil entreprise ---------- */
const pf = $('profileForm');
function fillProfile() { Object.entries(P()).forEach(([k, v]) => { if (pf.elements[k]) pf.elements[k].value = v ?? '' }); toggleProfileFields() }
function toggleProfileFields() { const s = pf.elements.statut.value; $('tvaField').style.display = s === 'micro' ? 'none' : ''; $('capField').style.display = s === 'societe' ? '' : 'none' }
pf.elements.statut.onchange = toggleProfileFields;
function saveProfile(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(pf)), row = {};
  Object.entries(P_MAP).forEach(([k, c]) => { if (k in f) row[c] = (k === 'delai' || k === 'validite') ? (+f[k] || 30) : (f[k].trim() || null) });
  busy(async () => { await q(sb.from('entreprises').update(row).eq('id', entId)); await refresh(); toast('Entreprise enregistrée'); go('home') });
}
function addMember() {
  const email = $('memberEmail').value.trim(); if (!email) return;
  busy(async () => { await q(sb.rpc('ajouter_membre', { p_entreprise: entId, p_email: email, p_role: 'salarie' })); $('memberEmail').value = ''; await refresh(); toast('Salarié ajouté') });
}

/* ---------- clients ---------- */
function clientFields(c = {}) {
  return `
  <div class="seg" id="ctype"><button type="button" data-v="particulier" class="${c.type !== 'pro' ? 'on' : ''}">Particulier</button><button type="button" data-v="pro" class="${c.type === 'pro' ? 'on' : ''}">Professionnel</button></div>
  <label>Nom *</label><input id="c_nom" value="${esc(c.nom)}" placeholder="M. et Mme Martin">
  <label>Adresse</label><input id="c_adresse" value="${esc(c.adresse)}">
  <div class="g2"><div><label>Code postal</label><input id="c_cp" inputmode="numeric" value="${esc(c.cp)}"></div><div><label>Ville</label><input id="c_ville" value="${esc(c.ville)}"></div></div>
  <div class="g2"><div><label>E-mail</label><input id="c_email" type="email" value="${esc(c.email)}"></div><div><label>Téléphone</label><input id="c_tel" type="tel" value="${esc(c.tel)}"></div></div>
  <div id="c_prof" style="display:${c.type === 'pro' ? '' : 'none'}"><label>SIREN du client</label><input id="c_siren" inputmode="numeric" value="${esc(c.siren)}"></div>`
}
function bindSeg(id, cb) { const s = $(id); s.onclick = e => { const b = e.target.closest('button'); if (!b) return; s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); cb && cb(b.dataset.v) } }
const segVal = id => document.querySelector('#' + id + ' .on').dataset.v;
function readClient() { const c = { type: segVal('ctype') }; ['nom', 'adresse', 'cp', 'ville', 'email', 'tel', 'siren'].forEach(k => c[k] = $('c_' + k).value.trim() || null); return c }
function editClient(id) { const c = id ? db.clients.find(x => x.id === id) : {}; modal(id ? 'Client' : 'Nouveau client', clientFields(c) + `<div class="actions"><button class="btn dark" onclick="saveClient('${id || ''}')">Enregistrer</button>${id && !db.docs.some(d => d.clientId === id) ? `<button class="btn ghost" onclick="delClient('${id}')">Supprimer</button>` : ''}</div>`); bindSeg('ctype', v => $('c_prof').style.display = v === 'pro' ? '' : 'none') }
function saveClient(id) {
  const c = readClient(); if (!c.nom) return toast('Le nom est obligatoire');
  busy(async () => {
    await q(id ? sb.from('clients').update(c).eq('id', id) : sb.from('clients').insert({ ...c, entreprise_id: entId }));
    closeModal(); await refresh(); toast('Client enregistré');
  });
}
function delClient(id) { busy(async () => { await q(sb.from('clients').delete().eq('id', id)); closeModal(); await refresh() }) }

/* ---------- formulaire devis / facture ---------- */
let draft = null;
const needProfile = () => { if (profileOk()) return false; toast(isDir() ? 'Renseignez d\'abord votre entreprise' : 'Votre directeur doit d\'abord compléter l\'entreprise'); if (isDir()) go('reglages'); return true };
function newDevis() { if (needProfile()) return; draft = { type: 'devis', lignes: [{ d: '', q: 1, u: '', pu: '', tva: 10 }], date: today(), validite: +P().validite || 30, acompte: 0 }; docForm() }
function newFacture() { if (needProfile()) return; draft = { type: 'facture', lignes: [{ d: '', q: 1, u: '', pu: '', tva: 10 }], date: today(), dateExec: today(), acompte: 0 }; docForm() }
function editDoc(id) { draft = JSON.parse(JSON.stringify(db.docs.find(d => d.id === id))); docForm() }

function docForm() {
  const d = draft, isF = d.type === 'facture';
  const opts = [...db.clients].sort((a, b) => a.nom.localeCompare(b.nom)).map(c => `<option value="${c.id}" ${c.id === d.clientId ? 'selected' : ''}>${esc(c.nom)}</option>`).join('');
  modal(d.id ? 'Modifier le devis' : (isF ? 'Nouvelle facture' : 'Nouveau devis'), `
    <label>Client</label>
    <select id="f_client" onchange="$('newClient').style.display=this.value==='new'?'':'none'">${opts}<option value="new" ${!d.clientId ? 'selected' : ''}>+ Nouveau client</option></select>
    <div id="newClient" class="card" style="margin-top:10px;display:${d.clientId ? 'none' : ''}">${clientFields()}</div>
    <label>Objet des travaux</label><input id="f_objet" value="${esc(d.objet)}" placeholder="Remplacement chauffe-eau">
    <label>Adresse du chantier (si différente)</label><input id="f_chantier" value="${esc(d.chantier)}">
    <div id="lines"></div>
    <button class="btn sm" style="margin-top:10px" onclick="addLine()">+ Ajouter une ligne</button>
    <div class="g2">
      <div><label>Date</label><input id="f_date" type="date" value="${d.date}"></div>
      ${isF ? `<div><label>Date des travaux</label><input id="f_exec" type="date" value="${d.dateExec || d.date}"></div>` : `<div><label>Validité (jours)</label><input id="f_validite" type="number" min="1" value="${d.validite}"></div>`}
    </div>
    ${isF ? '' : `<label>Acompte à la signature (%)</label><input id="f_acompte" type="number" min="0" max="100" value="${d.acompte || 0}">`}
    <label>Note (facultatif)</label><textarea id="f_note" placeholder="Délai d'intervention, conditions particulières…">${esc(d.note)}</textarea>
    <div class="card" style="margin-top:14px" id="liveTot"></div>
    <div class="actions"><button class="btn acc" id="saveBtn" onclick="saveDoc()">${d.id ? 'Enregistrer' : (isF ? 'Créer la facture' : 'Créer le devis')}</button><button class="btn ghost" onclick="closeModal()">Annuler</button></div>
    ${isF ? '<p class="hint">Une facture créée reçoit un numéro définitif et ne peut plus être modifiée ni supprimée (obligation légale). Vérifiez avant de valider.</p>' : ''}`);
  if (!d.clientId) bindSeg('ctype', v => $('c_prof').style.display = v === 'pro' ? '' : 'none');
  drawLines();
}
function drawLines() {
  const micro = isMicro();
  $('lines').innerHTML = draft.lignes.map((l, i) => `
    <div class="line">${draft.lignes.length > 1 ? `<button class="x" onclick="rmLine(${i})" aria-label="Supprimer la ligne">×</button>` : ''}
      <label>Prestation ou fourniture ${i + 1}</label><input value="${esc(l.d)}" placeholder="Main d'œuvre, matériel…" oninput="setL(${i},'d',this.value)">
      <div class="g3">
        <div><label>Prix unitaire HT</label><input type="number" step="0.01" inputmode="decimal" value="${l.pu}" oninput="setL(${i},'pu',this.value)"></div>
        <div><label>Qté</label><input type="number" step="0.01" inputmode="decimal" value="${l.q}" oninput="setL(${i},'q',this.value)"></div>
        <div><label>Unité</label><input value="${esc(l.u)}" placeholder="h, m², u" oninput="setL(${i},'u',this.value)"></div>
      </div>
      ${micro ? '' : `<label>TVA</label><select onchange="setL(${i},'tva',this.value)">${[20, 10, 5.5, 0].map(t => `<option value="${t}" ${+l.tva === t ? 'selected' : ''}>${String(t).replace('.', ',')} %</option>`).join('')}</select>`}
    </div>`).join('');
  liveTot();
}
function setL(i, k, v) { draft.lignes[i][k] = v; liveTot() }
function addLine() { draft.lignes.push({ d: '', q: 1, u: '', pu: '', tva: draft.lignes.at(-1)?.tva ?? 10 }); drawLines() }
function rmLine(i) { draft.lignes.splice(i, 1); drawLines() }
function liveTot() { const t = totals(draft); $('liveTot').innerHTML = `<div class="tot"><span>Total HT</span><span>${eur(t.ht)}</span></div>${isMicro() ? '<div class="tot"><span>TVA</span><span>non applicable</span></div>' : `<div class="tot"><span>TVA</span><span>${eur(t.tva)}</span></div>`}<div class="tot big"><span>${isMicro() ? 'Total' : 'Total TTC'}</span><span>${eur(t.ttc)}</span></div>` }

function saveDoc() {
  const d = draft;
  const lignes = d.lignes.filter(l => String(l.d).trim() || +l.pu);
  if (!lignes.length) return toast('Ajoutez au moins une ligne');
  let cid = $('f_client').value, newC = null;
  if (cid === 'new') { newC = readClient(); if (!newC.nom) return toast('Indiquez le nom du client') }
  const f = { objet: $('f_objet').value.trim() || null, chantier: $('f_chantier').value.trim() || null, note: $('f_note').value.trim() || null, date: $('f_date').value || today() };
  $('saveBtn').disabled = true;
  busy(async () => {
    try {
      if (newC) cid = (await q(sb.from('clients').insert({ ...newC, entreprise_id: entId }).select('id').single())).id;
      let id = d.id;
      if (d.type === 'devis') {
        const row = { client_id: cid, objet: f.objet, chantier: f.chantier, note: f.note, date_devis: f.date, validite_jours: +$('f_validite').value || 30, acompte_pct: +$('f_acompte').value || 0 };
        if (id) { await q(sb.from('devis').update(row).eq('id', id)); await q(sb.from('lignes').delete().eq('devis_id', id)) }
        else id = (await q(sb.from('devis').insert({ ...row, entreprise_id: entId }).select('id').single())).id;
        await q(sb.from('lignes').insert(lignesToRows(lignes).map(l => ({ ...l, devis_id: id }))));
      } else {
        id = await q(sb.rpc('creer_facture', { p_entreprise: entId, p_client: cid, p_lignes: lignesToRows(lignes), p_objet: f.objet, p_chantier: f.chantier, p_note: f.note, p_date: f.date, p_date_execution: $('f_exec').value || f.date }));
      }
      await refresh(); openDoc(id); toast(d.type === 'devis' ? 'Devis prêt' : 'Facture créée');
    } finally { const b = $('saveBtn'); if (b) b.disabled = false }
  });
}

/* ---------- document imprimable ---------- */
function docHtml(d) {
  const p = P(), c = client(d.clientId), t = totals(d), isF = d.type === 'facture', micro = isMicro();
  const nomPro = esc(p.nom) + (p.statut !== 'societe' ? ' <small>(EI)</small>' : '');
  const tvaCol = !micro;
  const rows = d.lignes.map(l => `<tr><td>${esc(l.d)}</td><td class="n">${String(+l.q || 0).replace('.', ',')} ${esc(l.u)}</td><td class="n">${eur(l.pu)}</td>${tvaCol ? `<td class="n">${String(+l.tva).replace('.', ',')} %</td>` : ''}<td class="n">${eur((+l.q || 0) * (+l.pu || 0))}</td></tr>`).join('');
  const tvaDetail = tvaCol ? [...new Set(d.lignes.map(l => +l.tva))].map(r => { const b = d.lignes.filter(l => +l.tva === r).reduce((s, l) => s + (+l.q || 0) * (+l.pu || 0), 0); return `<div><span>TVA ${String(r).replace('.', ',')} %</span><span>${eur(b * r / 100)}</span></div>` }).join('') : '';
  const legal = [];
  if (micro) legal.push('TVA non applicable, art. 293 B du CGI.');
  if (p.assureur) legal.push(`Assurance professionnelle : ${esc(p.assureur)}${p.assuranceZone ? ' · couverture : ' + esc(p.assuranceZone) : ''}.`);
  if (isF) {
    legal.push(`À régler au plus tard le ${fdate(d.echeance)}. Pas d'escompte pour paiement anticipé.`);
    legal.push('En cas de retard, pénalités au taux de 3 fois le taux d\'intérêt légal' + (c.type === 'pro' ? ', et indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce).' : '.'));
    if (p.iban) legal.push(`Règlement par virement : IBAN ${esc(p.iban)}`);
  } else {
    legal.push(`Devis valable ${d.validite} jours, jusqu'au ${fdate(addDays(d.date, d.validite))}.`);
    if (d.acompte) legal.push(`Acompte de ${d.acompte} % (${eur(t.ttc * d.acompte / 100)}) à la signature.`);
  }
  if (d.devisNum) legal.push(`Facture établie selon le devis ${esc(d.devisNum)}.`);
  return `<div class="doc">
    <div class="dh">
      <div class="who"><b>${nomPro}</b><br>${p.metier ? esc(p.metier) + '<br>' : ''}${esc(p.adresse)}<br>${esc(p.cp)} ${esc(p.ville)}<br>${p.tel ? esc(p.tel) + '<br>' : ''}${p.email ? esc(p.email) + '<br>' : ''}<span class="meta">SIRET ${esc(p.siret)}${p.rm ? ' · ' + esc(p.rm) : ''}${p.tvaIntra && !micro ? '<br>TVA ' + esc(p.tvaIntra) : ''}${p.statut === 'societe' && p.capital ? '<br>' + esc(p.capital) : ''}</span></div>
      <div class="who" style="text-align:right"><h1>${isF ? 'Facture' : 'Devis'}</h1><b class="acc">${esc(d.num)}</b><br><span class="meta">Date : ${fdate(d.date)}${isF ? '<br>Travaux réalisés le : ' + fdate(d.dateExec) : ''}</span><br><br><b>${esc(c.nom)}</b><br>${esc(c.adresse)}<br>${esc(c.cp)} ${esc(c.ville)}${c.type === 'pro' && c.siren ? '<br><span class="meta">SIREN ' + esc(c.siren) + '</span>' : ''}</div>
    </div>
    ${d.objet ? `<p><b>Objet :</b> ${esc(d.objet)}</p>` : ''}${d.chantier ? `<p><b>Lieu des travaux :</b> ${esc(d.chantier)}</p>` : ''}
    <table><thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">PU HT</th>${tvaCol ? '<th class="n">TVA</th>' : ''}<th class="n">Total HT</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div><span>Total HT</span><span>${eur(t.ht)}</span></div>${tvaDetail}<div class="ttc"><span>${micro ? 'Net à payer' : 'Total TTC'}</span><span>${eur(t.ttc)}</span></div></div>
    ${d.note ? `<p style="margin-top:16px">${esc(d.note).replace(/\n/g, '<br>')}</p>` : ''}
    <div class="legal">${legal.map(l => `<p>${l}</p>`).join('')}</div>
    ${isF ? '' : '<div class="sign"><b>Bon pour accord</b><br><small>Devis reçu avant l\'exécution des travaux. Date et signature du client :</small></div>'}
  </div>`;
}

function openDoc(id) {
  const d = db.docs.find(x => x.id === id); if (!d) return;
  const isF = d.type === 'facture';
  const btns = [`<button class="btn dark" onclick="printDoc('${id}')">Imprimer / PDF</button>`, `<button class="btn" onclick="mailDoc('${id}')">Envoyer par e-mail</button>`];
  if (!isF) {
    if (['brouillon', 'envoye', 'refuse', 'accepte'].includes(d.statut)) btns.push(`<button class="btn" onclick="editDoc('${id}')">Modifier</button>`);
    if (d.statut !== 'facture') {
      if (d.statut !== 'accepte') btns.push(`<button class="btn" onclick="setDevis('${id}','accepte')">✓ Accepté</button>`);
      if (isDir()) btns.push(`<button class="btn acc" onclick="toFacture('${id}')">Transformer en facture</button>`);
      if (d.statut === 'envoye') btns.push(`<button class="btn ghost" onclick="setDevis('${id}','refuse')">Refusé</button>`);
    }
    if (d.statut === 'brouillon') btns.push(`<button class="btn ghost" onclick="delDoc('${id}')">Supprimer</button>`);
  } else if (d.statut !== 'payee' && d.statut !== 'annulee') {
    btns.push(`<button class="btn acc" onclick="setFacture('${id}','payee')">✓ Payée</button>`);
    if (daysLate(d.echeance) > 0) btns.push(`<button class="btn" onclick="relance('${id}')">Relancer</button>`);
    btns.push(`<button class="btn ghost" onclick="cancelFact('${id}')">Annuler la facture</button>`);
  }
  const rel = (d.relances || []).length ? `<p class="hint">Relances : ${d.relances.map(fdate).join(', ')}</p>` : '';
  modal(`${isF ? 'Facture' : 'Devis'} ${esc(d.num)} ${statusTag(d)}`, `<div class="actions" style="margin-top:4px">${btns.join('')}</div>${rel}${docHtml(d)}`);
}
function printDoc(id) { const d = db.docs.find(x => x.id === id); const a = $('printArea'); a.innerHTML = docHtml(d); a.hidden = false; const old = document.title; document.title = `${d.type === 'facture' ? 'Facture' : 'Devis'} ${d.num} - ${client(d.clientId).nom}`; window.print(); document.title = old; a.hidden = true }
function mailDoc(id) {
  const d = db.docs.find(x => x.id === id), c = client(d.clientId), t = totals(d), p = P(), isF = d.type === 'facture';
  const sub = `${isF ? 'Facture' : 'Devis'} ${d.num}${d.objet ? ' - ' + d.objet : ''}`;
  const body = isF ? `Bonjour,\n\nVeuillez trouver ci-joint la facture ${d.num} d'un montant de ${eur(t.ttc)}, à régler avant le ${fdate(d.echeance)}.${p.iban ? '\n\nIBAN : ' + p.iban : ''}\n\nMerci pour votre confiance.\n\nCordialement,\n${p.nom}${p.tel ? '\n' + p.tel : ''}`
    : `Bonjour,\n\nSuite à notre échange, veuillez trouver ci-joint le devis ${d.num}${d.objet ? ' pour ' + d.objet.toLowerCase() : ''}, d'un montant de ${eur(t.ttc)}.\n\nIl est valable jusqu'au ${fdate(addDays(d.date, d.validite))}. Pour l'accepter, il suffit de me le retourner signé avec la mention « Bon pour accord ».\n\nJe reste disponible pour toute question.\n\nCordialement,\n${p.nom}${p.tel ? '\n' + p.tel : ''}`;
  if (!isF && d.statut === 'brouillon') sb.from('devis').update({ statut: 'envoye', envoye_le: today() }).eq('id', id).then(({ error }) => { if (!error) refresh() });
  showMail(c.email, sub, body, 'Pensez à joindre le PDF (bouton « Imprimer / PDF » → Enregistrer en PDF).');
}
function showMail(to, sub, body, hint) {
  modal('E-mail prêt', `<label>À</label><input id="m_to" value="${esc(to)}" placeholder="adresse du client"><label>Objet</label><input id="m_sub" value="${esc(sub)}"><label>Message</label><textarea id="m_body" style="min-height:240px">${esc(body)}</textarea>${hint ? `<p class="hint">${hint}</p>` : ''}
  <div class="actions"><button class="btn acc" onclick="openMail()">Ouvrir dans ma messagerie</button><button class="btn" onclick="copyMail()">Copier le texte</button></div>`);
}
function openMail() { location.href = 'mailto:' + encodeURIComponent($('m_to').value) + '?subject=' + encodeURIComponent($('m_sub').value) + '&body=' + encodeURIComponent($('m_body').value) }
function copyMail() { const t = $('m_body'); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast('Texte copié'), () => { t.focus(); t.select(); toast('Texte sélectionné : appuyez sur Copier') }) }

function setDevis(id, s) { busy(async () => { await q(sb.from('devis').update({ statut: s }).eq('id', id)); await refresh(); openDoc(id); toast('Statut mis à jour') }) }
function setFacture(id, s) { busy(async () => { await q(sb.from('factures').update(s === 'payee' ? { statut: 'payee', paye_le: today() } : { statut: s }).eq('id', id)); await refresh(); openDoc(id); toast(s === 'payee' ? 'Paiement enregistré 💶' : 'Facture annulée') }) }
function delDoc(id) { if (!confirm('Supprimer ce brouillon ?')) return; busy(async () => { await q(sb.from('devis').delete().eq('id', id)); closeModal(); await refresh() }) }
function cancelFact(id) { if (!confirm("Annuler cette facture ? Elle reste dans la liste (numérotation continue). Si le client l'a déjà reçue, il faudra lui envoyer un avoir.")) return; setFacture(id, 'annulee') }
function toFacture(id) {
  if (!isDir()) return;
  if (!confirm('Créer la facture à partir de ce devis ? Elle recevra un numéro définitif.')) return;
  busy(async () => { const f = await q(sb.rpc('facturer_devis', { p_devis: id })); await refresh(); openDoc(f); toast('Facture créée depuis le devis') });
}

/* ---------- relances : le ton monte à chaque relance ---------- */
let relanceCtx = null;
function relance(id) {
  const d = db.docs.find(x => x.id === id), c = client(d.clientId), t = totals(d), p = P(), n = (d.relances || []).length, late = daysLate(d.echeance);
  const sign = `\n\nCordialement,\n${p.nom}${p.tel ? '\n' + p.tel : ''}`;
  const pay = p.iban ? `\n\nIBAN : ${p.iban}` : '';
  let sub, body, level;
  if (n === 0) { level = 'Relance amicale'; sub = `Petit rappel - facture ${d.num}`; body = `Bonjour,\n\nSauf erreur de ma part, la facture ${d.num} de ${eur(t.ttc)}, arrivée à échéance le ${fdate(d.echeance)}, n'a pas encore été réglée.\n\nIl s'agit peut-être d'un simple oubli : pourriez-vous procéder au règlement dès que possible ?${pay}\n\nSi le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.${sign}` }
  else if (n === 1) { level = 'Deuxième relance'; sub = `Relance - facture ${d.num} impayée`; body = `Bonjour,\n\nMalgré ma précédente relance, la facture ${d.num} de ${eur(t.ttc)} reste impayée, avec ${late} jours de retard.\n\nJe vous remercie de bien vouloir régler cette somme sous 8 jours.${pay}${c.type === 'pro' ? '\n\nPour rappel, tout retard entraîne des pénalités ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement.' : ''}${sign}` }
  else { level = 'Mise en demeure'; sub = `Mise en demeure de payer - facture ${d.num}`; body = `Madame, Monsieur,\n\nMalgré mes relances, la facture ${d.num} du ${fdate(d.date)}, d'un montant de ${eur(t.ttc)}, échue depuis le ${fdate(d.echeance)}, demeure impayée.\n\nPar la présente, je vous mets en demeure de régler cette somme sous 8 jours à compter de la réception de ce courrier${c.type === 'pro' ? ', majorée des pénalités de retard et de l\'indemnité forfaitaire de 40 €' : ''}.\n\nÀ défaut, je me verrai contraint d'engager une procédure de recouvrement.${pay}${sign}` }
  relanceCtx = { id, niveau: Math.min(n + 1, 3) };
  modal(level + ' · ' + esc(c.nom), `<p class="hint" style="margin-top:0">${esc(d.num)} · ${eur(t.ttc)} · ${late} jours de retard · ${n} relance(s) déjà faite(s)</p>
  <label>À</label><input id="m_to" value="${esc(c.email)}"><label>Objet</label><input id="m_sub" value="${esc(sub)}"><label>Message</label><textarea id="m_body" style="min-height:260px">${esc(body)}</textarea>
  ${n >= 2 ? '<p class="hint">Pour une mise en demeure, l\'envoi en lettre recommandée avec accusé de réception est recommandé : utilisez « Copier le texte ».</p>' : ''}
  <div class="actions"><button class="btn acc" onclick="doRelance('mail')">Ouvrir dans ma messagerie</button><button class="btn" onclick="doRelance('copy')">Copier le texte</button></div>`);
}
function doRelance(how) {
  const { id, niveau } = relanceCtx;
  if (how === 'mail') openMail(); else copyMail();
  sb.from('relances').insert({ facture_id: id, niveau, canal: niveau === 3 && how === 'copy' ? 'courrier' : 'email' })
    .then(({ error }) => { if (error) toast(errMsg(error)); else { refresh(); toast('Relance notée') } });
}

/* ---------- copie des données ---------- */
function exportData() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' })); a.download = `copie-assistant-${today()}.json`; a.click() }
