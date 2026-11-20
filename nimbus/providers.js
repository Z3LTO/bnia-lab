// Connecteurs cloud : 100 % navigateur (OAuth 2 + PKCE), aucun serveur intermédiaire.
// Nimbus n'accède qu'à SON dossier sur chaque cloud : tes fichiers existants restent invisibles pour lui.
import { CONFIG } from './config.js';

export const REDIRECT = location.origin + location.pathname.replace(/index\.html$/, '');
export const INDEX_NAME = 'nimbus-index.json';

export class AuthError extends Error {
  constructor(acc) { super('Session expirée'); this.acc = acc; }
}

let persist = () => {};
export const setPersist = fn => { persist = fn; };

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
const b64url = buf => {
  let s = ''; for (const x of new Uint8Array(buf)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function pkce() {
  const v = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const c = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  return { v, c };
}

async function req(acc, url, opts = {}, auth = true) {
  const headers = { ...(opts.headers || {}) };
  if (auth) headers.Authorization = 'Bearer ' + acc.token;
  const r = await fetch(url, { ...opts, headers });
  if (r.status === 401) throw new AuthError(acc);
  return r;
}
async function ok(r, label) {
  if (!r.ok) throw new Error(`${label} : erreur ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r;
}
async function tokenPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || 'Erreur de jeton ' + r.status);
  return j;
}
function setTokens(acc, j) {
  acc.token = j.access_token;
  if (j.refresh_token) acc.refresh = j.refresh_token;
  acc.expires = Date.now() + ((+j.expires_in || 3600) - 120) * 1000;
}
// Un seul rafraîchissement de jeton à la fois par compte
const locks = new Map();
function once(acc, fn) {
  if (!locks.has(acc.id)) locks.set(acc.id, fn().finally(() => locks.delete(acc.id)));
  return locks.get(acc.id);
}
async function refreshWith(acc, url, body) {
  if (acc.token && Date.now() < acc.expires) return;
  if (!acc.refresh) throw new AuthError(acc);
  await once(acc, async () => {
    try { setTokens(acc, await tokenPost(url, body)); persist(); }
    catch { throw new AuthError(acc); }
  });
}

/* ───────────────────────── Google Drive ───────────────────────── */
const GAPI = 'https://www.googleapis.com';
const google = {
  type: 'google', name: 'Google Drive', color: '#4285f4', letter: 'G',
  freeHint: '15 Go gratuits (partagés avec Gmail et Photos)',
  hasIt: 'Tu as une adresse Gmail ? Tu as déjà un Google Drive.',
  signup: 'https://accounts.google.com/signup',
  configured: () => !!CONFIG.google.clientId,
  authUrl(acc) {
    const p = new URLSearchParams({
      client_id: CONFIG.google.clientId, redirect_uri: REDIRECT, response_type: 'token', state: acc.id,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      include_granted_scopes: 'true',
    });
    if (acc.label) p.set('login_hint', acc.label); else p.set('prompt', 'select_account');
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
  },
  async finish(acc, params) { setTokens(acc, { access_token: params.get('access_token'), expires_in: params.get('expires_in') }); },
  async call(acc, url, opts) {
    if (!acc.token || Date.now() > acc.expires) throw new AuthError(acc); // Google (sans serveur) : jeton d'1 h
    return req(acc, url, opts);
  },
  async info(acc) {
    const j = await (await ok(await this.call(acc, GAPI + '/drive/v3/about?fields=user(emailAddress),storageQuota'), 'Google')).json();
    return { label: j.user.emailAddress, total: +(j.storageQuota.limit || 0), used: +j.storageQuota.usage };
  },
  async folder(acc) {
    if (acc.gFolder) return acc.gFolder;
    const q = `name='${CONFIG.appFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const j = await (await ok(await this.call(acc, GAPI + '/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q)), 'Google')).json();
    if (j.files.length) acc.gFolder = j.files[0].id;
    else {
      const f = await (await ok(await this.call(acc, GAPI + '/drive/v3/files?fields=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: CONFIG.appFolder, mimeType: 'application/vnd.google-apps.folder' }),
      }), 'Google')).json();
      acc.gFolder = f.id;
    }
    persist();
    return acc.gFolder;
  },
  async upload(acc, name, data) {
    const parent = await this.folder(acc);
    const r = await ok(await this.call(acc, GAPI + '/upload/drive/v3/files?uploadType=resumable&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/octet-stream' },
      body: JSON.stringify({ name, parents: [parent] }),
    }), 'Google');
    const loc = r.headers.get('Location');
    if (!loc) throw new Error("Google : session d'envoi refusée");
    const u = await ok(await fetch(loc, { method: 'PUT', body: data }), 'Google');
    return (await u.json()).id;
  },
  async download(acc, id) {
    return (await ok(await this.call(acc, `${GAPI}/drive/v3/files/${id}?alt=media`), 'Google')).arrayBuffer();
  },
  async remove(acc, id) {
    const r = await this.call(acc, `${GAPI}/drive/v3/files/${id}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) await ok(r, 'Google');
  },
  async findIndex(acc) {
    const parent = await this.folder(acc);
    const q = `name='${INDEX_NAME}' and '${parent}' in parents and trashed=false`;
    const j = await (await ok(await this.call(acc, GAPI + '/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q)), 'Google')).json();
    return j.files[0]?.id || null;
  },
  async readIndex(acc) {
    const id = await this.findIndex(acc);
    return id ? new TextDecoder().decode(await this.download(acc, id)) : null;
  },
  async writeIndex(acc, text) {
    const id = await this.findIndex(acc), data = new TextEncoder().encode(text);
    if (id) await ok(await this.call(acc, `${GAPI}/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: data }), 'Google');
    else await this.upload(acc, INDEX_NAME, data);
  },
};

/* ───────────────────────── OneDrive ───────────────────────── */
const MS = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const onedrive = {
  type: 'onedrive', name: 'OneDrive', color: '#0f6cbd', letter: 'O', pkce: true,
  freeHint: '5 Go gratuits',
  hasIt: 'Tu as une adresse Hotmail, Outlook ou Live ? Tu as déjà un OneDrive.',
  signup: 'https://signup.live.com/',
  scope: 'Files.ReadWrite.AppFolder User.Read offline_access',
  configured: () => !!CONFIG.onedrive.clientId,
  authUrl(acc, challenge) {
    const p = new URLSearchParams({
      client_id: CONFIG.onedrive.clientId, response_type: 'code', redirect_uri: REDIRECT, scope: this.scope,
      code_challenge: challenge, code_challenge_method: 'S256', state: acc.id, response_mode: 'query',
    });
    if (acc.label) p.set('login_hint', acc.label); else p.set('prompt', 'select_account');
    return MS + '/authorize?' + p;
  },
  async finish(acc, params, verifier) {
    setTokens(acc, await tokenPost(MS + '/token', {
      client_id: CONFIG.onedrive.clientId, grant_type: 'authorization_code', code: params.get('code'),
      redirect_uri: REDIRECT, code_verifier: verifier, scope: this.scope,
    }));
  },
  async call(acc, path, opts) {
    await refreshWith(acc, MS + '/token', { client_id: CONFIG.onedrive.clientId, grant_type: 'refresh_token', refresh_token: acc.refresh, scope: this.scope });
    return req(acc, path.startsWith('http') ? path : GRAPH + path, opts);
  },
  async info(acc) {
    const j = await (await ok(await this.call(acc, '/me/drive'), 'OneDrive')).json();
    let label = acc.label;
    if (!label) {
      try { const me = await (await this.call(acc, '/me')).json(); label = me.userPrincipalName || me.mail; } catch {}
      label = label || j.owner?.user?.displayName || 'OneDrive';
    }
    return { label, total: j.quota.total, used: j.quota.used };
  },
  async upload(acc, name, data) {
    const s = await (await ok(await this.call(acc, `/me/drive/special/approot:/${encodeURIComponent(name)}:/createUploadSession`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
    }), 'OneDrive')).json();
    const n = data.byteLength;
    const r = await ok(await fetch(s.uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes 0-${n - 1}/${n}` }, body: data }), 'OneDrive');
    return (await r.json()).id;
  },
  async download(acc, id) {
    const j = await (await ok(await this.call(acc, `/me/drive/items/${id}`), 'OneDrive')).json();
    return (await ok(await fetch(j['@microsoft.graph.downloadUrl']), 'OneDrive')).arrayBuffer();
  },
  async remove(acc, id) {
    const r = await this.call(acc, `/me/drive/items/${id}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) await ok(r, 'OneDrive');
  },
  async readIndex(acc) {
    const r = await this.call(acc, `/me/drive/special/approot:/${INDEX_NAME}`);
    if (r.status === 404) return null;
    const j = await (await ok(r, 'OneDrive')).json();
    return new TextDecoder().decode(await (await ok(await fetch(j['@microsoft.graph.downloadUrl']), 'OneDrive')).arrayBuffer());
  },
  async writeIndex(acc, text) {
    await ok(await this.call(acc, `/me/drive/special/approot:/${INDEX_NAME}:/content`, {
      method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: new TextEncoder().encode(text),
    }), 'OneDrive');
  },
};

/* ───────────────────────── Dropbox ───────────────────────── */
const DBX_TOKEN = 'https://api.dropboxapi.com/oauth2/token';
const dropbox = {
  type: 'dropbox', name: 'Dropbox', color: '#0061fe', letter: 'D', pkce: true,
  freeHint: '2 Go gratuits',
  hasIt: 'Tu as déjà utilisé Dropbox ? Connecte simplement ton compte.',
  signup: 'https://www.dropbox.com/register',
  configured: () => !!CONFIG.dropbox.clientId,
  authUrl(acc, challenge) {
    const p = new URLSearchParams({
      client_id: CONFIG.dropbox.clientId, response_type: 'code', redirect_uri: REDIRECT,
      code_challenge: challenge, code_challenge_method: 'S256', token_access_type: 'offline', state: acc.id,
    });
    if (!acc.label) p.set('force_reapprove', 'true');
    return 'https://www.dropbox.com/oauth2/authorize?' + p;
  },
  async finish(acc, params, verifier) {
    setTokens(acc, await tokenPost(DBX_TOKEN, {
      client_id: CONFIG.dropbox.clientId, grant_type: 'authorization_code', code: params.get('code'),
      redirect_uri: REDIRECT, code_verifier: verifier,
    }));
  },
  async ensure(acc) {
    await refreshWith(acc, DBX_TOKEN, { client_id: CONFIG.dropbox.clientId, grant_type: 'refresh_token', refresh_token: acc.refresh });
  },
  async rpc(acc, ep, arg) {
    await this.ensure(acc);
    return req(acc, 'https://api.dropboxapi.com/2/' + ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(arg ?? null) });
  },
  async content(acc, ep, arg, body) {
    await this.ensure(acc);
    const headers = { 'Dropbox-API-Arg': JSON.stringify(arg) };
    if (body) headers['Content-Type'] = 'application/octet-stream';
    return req(acc, 'https://content.dropboxapi.com/2/' + ep, { method: 'POST', headers, body });
  },
  async info(acc) {
    const u = await (await ok(await this.rpc(acc, 'users/get_space_usage'), 'Dropbox')).json();
    let label = acc.label;
    if (!label) label = (await (await ok(await this.rpc(acc, 'users/get_current_account'), 'Dropbox')).json()).email;
    return { label, total: u.allocation?.allocated ?? 0, used: u.used };
  },
  async upload(acc, name, data) {
    const j = await (await ok(await this.content(acc, 'files/upload', { path: '/' + name, mode: 'add', autorename: true, mute: true }, data), 'Dropbox')).json();
    return j.id;
  },
  async download(acc, id) {
    return (await ok(await this.content(acc, 'files/download', { path: id }), 'Dropbox')).arrayBuffer();
  },
  async remove(acc, id) {
    const r = await this.rpc(acc, 'files/delete_v2', { path: id });
    if (!r.ok && r.status !== 409) await ok(r, 'Dropbox');
  },
  async readIndex(acc) {
    const r = await this.content(acc, 'files/download', { path: '/' + INDEX_NAME });
    if (r.status === 409) return null;
    return new TextDecoder().decode(await (await ok(r, 'Dropbox')).arrayBuffer());
  },
  async writeIndex(acc, text) {
    await ok(await this.content(acc, 'files/upload', { path: '/' + INDEX_NAME, mode: 'overwrite', mute: true }, new TextEncoder().encode(text)), 'Dropbox');
  },
};

/* ───────────────────────── pCloud ───────────────────────── */
// Requêtes « simples » (GET / POST formulaire) : pas de pré-vol CORS, jeton sans expiration.
const pcloud = {
  type: 'pcloud', name: 'pCloud', color: '#17bed0', letter: 'P',
  freeHint: "jusqu'à 10 Go gratuits",
  hasIt: 'Tu as déjà un compte pCloud ? Connecte-le.',
  signup: 'https://my.pcloud.com/#page=register',
  configured: () => !!CONFIG.pcloud.clientId,
  authUrl(acc) {
    return 'https://my.pcloud.com/oauth2/authorize?' + new URLSearchParams({
      client_id: CONFIG.pcloud.clientId, response_type: 'token', redirect_uri: REDIRECT, state: acc.id,
    });
  },
  async finish(acc, params) {
    acc.token = params.get('access_token');
    acc.host = params.get('hostname') || 'api.pcloud.com'; // eapi.pcloud.com pour les comptes européens
  },
  async call(acc, method, params = {}, opts = {}) {
    if (!acc.token) throw new AuthError(acc);
    const r = await fetch(`https://${acc.host || 'api.pcloud.com'}/${method}?` + new URLSearchParams({ ...params, access_token: acc.token }), opts);
    const j = await r.json();
    if ([1000, 2000, 2094, 2095].includes(j.result)) throw new AuthError(acc);
    if (j.result !== 0) { const e = new Error('pCloud : ' + (j.error || 'erreur ' + j.result)); e.code = j.result; throw e; }
    return j;
  },
  async info(acc) {
    const j = await this.call(acc, 'userinfo');
    return { label: j.email, total: j.quota, used: j.usedquota };
  },
  async folder(acc) {
    if (acc.pFolder) return acc.pFolder;
    const j = await this.call(acc, 'createfolderifnotexists', { path: '/' + CONFIG.appFolder });
    acc.pFolder = j.metadata.folderid; persist();
    return acc.pFolder;
  },
  async put(acc, name, data) {
    const fd = new FormData();
    fd.append('file', new Blob([data]), name);
    const j = await this.call(acc, 'uploadfile', { folderid: await this.folder(acc), filename: name, nopartial: 1 }, { method: 'POST', body: fd });
    return j.metadata[0].fileid;
  },
  upload(acc, name, data) { return this.put(acc, name, data); },
  async fetchLink(acc, params) {
    const j = await this.call(acc, 'getfilelink', params);
    return (await ok(await fetch(`https://${j.hosts[0]}${j.path}`), 'pCloud')).arrayBuffer();
  },
  download(acc, id) { return this.fetchLink(acc, { fileid: id }); },
  async remove(acc, id) {
    try { await this.call(acc, 'deletefile', { fileid: id }); } catch (e) { if (e.code !== 2009) throw e; }
  },
  async readIndex(acc) {
    try { return new TextDecoder().decode(await this.fetchLink(acc, { path: `/${CONFIG.appFolder}/${INDEX_NAME}` })); }
    catch (e) { if (e.code === 2009 || e.code === 2002 || e.code === 2005) return null; throw e; }
  },
  writeIndex(acc, text) { return this.put(acc, INDEX_NAME, new TextEncoder().encode(text)); }, // écrase l'ancien
};

/* ───────────────────────── MEGA ───────────────────────── */
// Pas d'OAuth chez MEGA : connexion e-mail + mot de passe, faite UNE fois.
// Le mot de passe n'est jamais enregistré : on garde seulement la session MEGA sur l'appareil.
const megaSessions = new Map();
let megaLib = null;
const megaErr = e => /ESID|-15\b|EBLOCKED|-16\b/.test(String(e?.message || e));
const mega = {
  type: 'mega', name: 'MEGA', color: '#d9272e', letter: 'M', credentials: true,
  freeHint: '20 Go gratuits',
  hasIt: 'Tu as déjà un compte MEGA ? Connecte-le avec ton e-mail.',
  signup: 'https://mega.io/fr/register',
  configured: () => true,
  lib: () => (megaLib ||= import('./vendor/megajs.mjs')),
  async login(acc, { email, password, code }) {
    const { Storage } = await this.lib();
    const opts = { email: email.trim(), password, keepalive: false, autoload: false };
    if (code) opts.secondFactorCode = code.trim();
    let s;
    try { s = await new Storage(opts).ready; }
    catch (e) {
      const m = String(e.message || e);
      if (/-26|EMFAREQUIRED/.test(m)) { const x = new Error('Code de double authentification requis.'); x.mfa = true; throw x; }
      if (/ENOENT|-9\b|EKEY|-14\b/.test(m)) throw new Error('E-mail ou mot de passe incorrect.');
      if (/-18|ETEMPUNAVAIL/.test(m)) throw new Error("Compte pas encore confirmé : clique d'abord sur le lien reçu par e-mail.");
      throw new Error('MEGA : ' + m);
    }
    const j = s.toJSON();
    acc.session = { key: j.key, sid: j.sid, name: j.name, user: j.user };
    acc.label = s.email;
    megaSessions.delete(acc.id);
  },
  storage(acc) {
    if (!megaSessions.has(acc.id)) {
      const p = (async () => {
        if (!acc.session) throw new AuthError(acc);
        const { Storage } = await this.lib();
        const s = Storage.fromJSON({ ...acc.session, options: { email: acc.label, keepalive: false } });
        try { await s.reload(true); } catch (e) { if (megaErr(e)) throw new AuthError(acc); throw e; }
        return s;
      })();
      megaSessions.set(acc.id, p);
      p.catch(() => megaSessions.delete(acc.id));
    }
    return megaSessions.get(acc.id);
  },
  async wrap(acc, fn) {
    try { return await fn(await this.storage(acc)); }
    catch (e) { if (e instanceof AuthError || megaErr(e)) { megaSessions.delete(acc.id); throw new AuthError(acc); } throw e; }
  },
  async folder(s) {
    return s.root.children?.find(f => f.directory && f.name === CONFIG.appFolder) || s.mkdir(CONFIG.appFolder);
  },
  info(acc) {
    return this.wrap(acc, async s => {
      const i = await s.getAccountInfo();
      return { label: acc.label, total: i.spaceTotal, used: i.spaceUsed };
    });
  },
  upload(acc, name, data) {
    return this.wrap(acc, async s => {
      const dir = await this.folder(s);
      const f = await dir.upload({ name, size: data.byteLength }, data).complete;
      return f.nodeId;
    });
  },
  download(acc, id) {
    return this.wrap(acc, async s => {
      const f = s.files[id];
      if (!f) throw new Error('MEGA : morceau introuvable');
      return f.downloadBuffer({});
    });
  },
  remove(acc, id) {
    return this.wrap(acc, async s => { const f = s.files[id]; if (f) await f.delete(true); });
  },
  findIndex(s, dir) { return dir.children?.filter(f => f.name === INDEX_NAME) || []; },
  readIndex(acc) {
    return this.wrap(acc, async s => {
      await s.reload(true); // l'index a pu changer depuis un autre appareil
      const [f] = this.findIndex(s, await this.folder(s)).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return f ? new TextDecoder().decode(await f.downloadBuffer({})) : null;
    });
  },
  writeIndex(acc, text) {
    return this.wrap(acc, async s => {
      const dir = await this.folder(s), old = this.findIndex(s, dir), data = new TextEncoder().encode(text);
      await dir.upload({ name: INDEX_NAME, size: data.byteLength }, data).complete;
      for (const f of old) await f.delete(true).catch(() => {});
    });
  },
};

// Ordre d'affichage = ordre conseillé d'inscription (le plus de Go pour le moins d'effort)
export const PROVIDERS = { google, mega, pcloud, onedrive, dropbox };

// Guide d'inscription affiché dans l'appli
export const GUIDE = {
  google: {
    gb: 15, time: '0 min si tu as Gmail · 3 min sinon',
    need: 'Un numéro de téléphone peut être demandé.',
    steps: ['Ouvre l’inscription Google', 'Prénom, nom, date de naissance', 'Choisis ton adresse @gmail.com et un mot de passe', 'Reviens ici → « J’ai déjà un compte »'],
  },
  mega: {
    gb: 20, time: '≈ 2 min',
    need: 'Juste un e-mail (ta Gmail convient).',
    steps: ['Ouvre l’inscription MEGA', 'Prénom, e-mail, mot de passe', 'Clique sur le lien reçu par e-mail', 'Choisis l’offre « Gratuit »', 'Reviens ici → « J’ai déjà un compte » (e-mail + mot de passe)'],
  },
  pcloud: {
    gb: 10, time: '≈ 1 min',
    need: 'Utilise « Continuer avec Google » si c’est proposé : pas de mot de passe à créer.',
    steps: ['Ouvre l’inscription pCloud', '« Continuer avec Google » (ou e-mail + mot de passe)', 'Les 10 Go se débloquent en faisant les petites actions proposées (confirmer l’e-mail, installer l’appli…)', 'Reviens ici → « J’ai déjà un compte »'],
  },
  onedrive: {
    gb: 5, time: '0 min si tu as Hotmail/Outlook · 3 min sinon',
    need: 'Tu peux créer le compte avec ton adresse Gmail existante.',
    steps: ['Ouvre l’inscription Microsoft', 'Entre ton e-mail (Gmail possible) et un mot de passe', 'Recopie le code reçu par e-mail', 'Reviens ici → « J’ai déjà un compte »'],
  },
  dropbox: {
    gb: 2, time: '≈ 1 min',
    need: 'Utilise « Continuer avec Google » : c’est le plus rapide.',
    steps: ['Ouvre l’inscription Dropbox', '« Continuer avec Google »', 'Choisis l’offre « Basic » (gratuite) si on te propose un essai', 'Reviens ici → « J’ai déjà un compte »'],
  },
};

/* ───────────────────────── Flux OAuth ───────────────────────── */
const PENDING = 'nimbus:pending:';

export async function startAuth(type, existing) {
  const P = PROVIDERS[type];
  const acc = existing ? { ...existing } : { id: rid(), provider: type };
  let verifier = null, challenge = null;
  if (P.pkce) ({ v: verifier, c: challenge } = await pkce());
  localStorage.setItem(PENDING + acc.id, JSON.stringify({ acc, verifier, t: Date.now() }));
  location.href = P.authUrl(acc, challenge);
}

// À appeler au chargement : termine une connexion si on revient d'un fournisseur
export async function handleRedirect() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const q = new URLSearchParams(location.search);
  const params = (hash.get('access_token') || hash.get('error')) ? hash : (q.get('code') || q.get('error')) ? q : null;
  if (!params) return null;
  history.replaceState(null, '', REDIRECT);
  const state = params.get('state') || '';
  const raw = localStorage.getItem(PENDING + state);
  localStorage.removeItem(PENDING + state);
  if (params.get('error')) throw new Error('Connexion annulée : ' + (params.get('error_description') || params.get('error')));
  if (!raw) throw new Error('Session de connexion introuvable, réessaie.');
  const { acc, verifier } = JSON.parse(raw);
  await PROVIDERS[acc.provider].finish(acc, params, verifier);
  return acc;
}
