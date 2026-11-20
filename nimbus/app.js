import { CONFIG } from './config.js';
import { idb } from './db.js';
import * as C from './crypto.js';
import { PROVIDERS, GUIDE, AuthError, handleRedirect, startAuth, setPersist, KEY_NAME } from './providers.js';

/* ───────── utilitaires ───────── */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
const now = () => Date.now();
const te = new TextEncoder(), td = new TextDecoder();
const fmt = n => {
  if (!isFinite(n) || n < 0) return '—';
  const u = ['o', 'Ko', 'Mo', 'Go', 'To']; let i = 0;
  while (n >= 1024 && i < 4) { n /= 1024; i++; }
  return n.toFixed(i > 1 ? 1 : 0).replace('.', ',') + ' ' + u[i];
};
const free = a => Math.max(0, (a.total || 0) - (a.used || 0));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf' };
const guessType = n => TYPES[(n.split('.').pop() || '').toLowerCase()] || '';
const icon = t => !t ? '📦' : t.startsWith('image/') ? '🖼️' : t.startsWith('video/') ? '🎬' : t.startsWith('audio/') ? '🎵' : t.includes('pdf') ? '📄' : '📦';

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), type === 'err' ? 7000 : 3500);
}

/* ───────── état ───────── */
const S = {
  accounts: [], vault: null, key: null, foundOn: null,
  catalog: { folders: {}, files: {} }, cwd: 'root', view: 'files',
  queue: [], busy: false, up: null,
};
const saveAccounts = () => idb.set('kv', 'accounts', S.accounts.map(a => ({ ...a })));
setPersist(() => saveAccounts());

/* ───────── comptes cloud ───────── */
async function refreshAccount(a) {
  try { Object.assign(a, await PROVIDERS[a.provider].info(a), { status: 'ok', error: '' }); }
  catch (e) { a.status = e instanceof AuthError ? 'expired' : 'error'; a.error = e.message; }
}
// Même compte connecté deux fois → on garde le premier (ses fichiers y pointent) avec les nouveaux jetons
function dedupe() {
  const seen = new Map(); let merged = null;
  S.accounts = S.accounts.filter(a => {
    if (!a.label) return true;
    const k = a.provider + '|' + a.label.toLowerCase();
    const keep = seen.get(k);
    if (!keep) { seen.set(k, a); return true; }
    if (a.status === 'ok') Object.assign(keep, { token: a.token, refresh: a.refresh || keep.refresh, expires: a.expires, status: 'ok', total: a.total, used: a.used });
    merged = keep;
    return false;
  });
  return merged;
}
async function refreshQuotas() {
  await Promise.all(S.accounts.map(refreshAccount));
  const merged = dedupe();
  if (merged) toast(`${merged.label} était déjà connecté : connexion mise à jour.`);
  await saveAccounts();
  renderSpace();
  if (S.view === 'clouds' && S.key) renderClouds();
}
function pickAccount(size, exclude) {
  let best = null;
  for (const a of S.accounts) {
    if (a.status !== 'ok' || exclude.has(a.id)) continue;
    const f = free(a) - CONFIG.safetyMargin;
    if (f >= size && (!best || f > free(best) - CONFIG.safetyMargin)) best = a;
  }
  return best;
}
async function connect(type, acc) {
  const P = PROVIDERS[type];
  if (!P.configured()) { $('#sheet').classList.add('hidden'); return toast(`La connexion ${P.name} arrive très bientôt. En attendant, commence avec MEGA (20 Go gratuits).`, 'err'); }
  if (P.credentials) return credForm(type, acc);
  await startAuth(type, acc);
}

// Connexion par e-mail + mot de passe (MEGA)
function credForm(type, existing, mfa = false) {
  const P = PROVIDERS[type], sh = $('#sheet');
  sh.innerHTML = `<form class="sheet-panel cred" id="credForm" autocomplete="on">
    <div class="sheet-title">Connecter ${P.name}</div>
    <input type="email" id="cEmail" placeholder="E-mail ${P.name}" autocomplete="username" required value="${esc(existing?.label || '')}">
    <input type="password" id="cPass" placeholder="Mot de passe ${P.name}" autocomplete="current-password" required>
    <input type="text" id="cCode" placeholder="Code de double authentification (si activée)" inputmode="numeric" autocomplete="one-time-code" class="${mfa ? '' : 'hidden'}">
    <p class="hint">🔐 Ton mot de passe sert uniquement à ouvrir la session, directement avec ${P.name}. Nimbus ne l'enregistre pas.</p>
    <p class="err" id="cErr"></p>
    <button class="btn primary" type="submit">Connecter</button>
    <button class="sheet-btn cancel" type="button" id="cCancel">Annuler</button>
  </form>`;
  sh.classList.remove('hidden');
  sh.onclick = e => { if (e.target === sh) sh.classList.add('hidden'); };
  $('#cCancel').onclick = () => sh.classList.add('hidden');
  $('#cEmail').value ? $('#cPass').focus() : $('#cEmail').focus();
  $('#credForm').onsubmit = async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]'), err = $('#cErr');
    btn.disabled = true; btn.textContent = 'Connexion…'; err.textContent = '';
    const acc = existing ? { ...existing } : { id: rid(), provider: type };
    try {
      await P.login(acc, { email: $('#cEmail').value, password: $('#cPass').value, code: $('#cCode').value });
      acc.status = 'ok';
      const i = S.accounts.findIndex(a => a.id === acc.id);
      if (i >= 0) S.accounts[i] = acc; else S.accounts.push(acc);
      sh.classList.add('hidden');
      await saveAccounts();
      await refreshQuotas();
      toast(`✓ ${P.name} connecté : ${acc.label}`);
      if (S.key) { sync(); render(); } else { showLock({ busy: 'Ouverture de ton espace…' }); await findVault(acc); }
    } catch (x) {
      if (x.mfa) $('#cCode').classList.remove('hidden');
      err.textContent = x.message; btn.disabled = false; btn.textContent = 'Connecter';
    }
  };
}

// Choix affiché quand on touche un cloud : déjà un compte → connexion ; sinon → inscription guidée
function pickSheet(type) {
  const P = PROVIDERS[type], g = GUIDE[type], sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-panel pick" style="--pc:${P.color}">
    <div class="pick-head"><span class="plogo">${P.letter}</span><div><b>${P.name}</b><div class="hint">${P.freeHint}</div></div></div>
    <div class="pick-block">
      <h3>Déjà un compte ${P.brand} ?</h3>
      <p class="hint">${P.hasIt} Connecte-toi directement, en un clic.</p>
      <button class="btn primary" data-connect="${type}">Me connecter</button>
    </div>
    <div class="pick-or"><span>ou</span></div>
    <div class="pick-block">
      <h3>Pas encore de compte ?</h3>
      <p class="hint">⏱ ${g.time}. 💡 ${g.need}</p>
      <button class="btn" data-signup="${type}">Créer mon compte gratuit</button>
      <details class="howto"><summary>Voir les étapes</summary><ol>${g.steps.map(x => `<li>${x}</li>`).join('')}</ol></details>
    </div>
    <button class="sheet-btn cancel" data-close>Annuler</button>
  </div>`;
  sh.classList.remove('hidden');
  sh.onclick = e => { if (e.target === sh || e.target.closest('[data-close]')) sh.classList.add('hidden'); };
}

/* ───────── coffre (chiffrement) ───────── */
// Aucun mot de passe à retenir : une clé aléatoire (AES-256) est créée pour l'espace de l'utilisateur
// et rangée dans son compte principal (le premier cloud connecté). Sur l'appareil, elle est gardée non exportable.
const isHome = a => S.vault?.home && a.provider === S.vault.home.provider && (a.label || '').toLowerCase() === (S.vault.home.label || '').toLowerCase();
async function createVaultOn(acc) {
  const raw = C.newRawKey(), id = rid();
  await PROVIDERS[acc.provider].writeIndex(acc, JSON.stringify({ app: 'nimbus', v: 2, vault: id, key: C.toB64(raw) }), KEY_NAME);
  S.vault = { id, home: { provider: acc.provider, label: acc.label } };
  await idb.set('kv', 'vault', S.vault);
  await idb.set('kv', 'onboarded', false);
  await unlocked(await C.importKey(raw));
  toast(`✓ Ton espace Nimbus est prêt (compte principal : ${acc.label})`);
}
async function openVaultFrom(acc, text) {
  const k = JSON.parse(text);
  if (k.app !== 'nimbus' || !k.key || !k.vault) throw new Error('Clé de ton espace illisible.');
  S.vault = { id: k.vault, home: { provider: acc.provider, label: acc.label } };
  await idb.set('kv', 'vault', S.vault);
  await unlocked(await C.importKey(C.fromB64(k.key)));
}
// Retrouve l'espace sur les clouds connectés, sinon en crée un sur le compte qu'on vient de connecter
async function findVault(prefer) {
  const list = S.accounts.filter(a => a.status === 'ok');
  if (prefer) {
    const p = list.find(a => a.id === prefer.id) || list.find(a => a.provider === prefer.provider && a.label === prefer.label);
    if (p) { list.splice(list.indexOf(p), 1); list.unshift(p); prefer = p; } else prefer = null;
  }
  for (const a of list) {
    let t = null;
    try { t = await PROVIDERS[a.provider].readIndex(a, KEY_NAME); } catch (e) { console.warn(e); }
    if (t) return await openVaultFrom(a, t);
  }
  for (const a of list) {
    try {
      const t = await PROVIDERS[a.provider].readIndex(a), w = t && JSON.parse(t);
      if (w?.app === 'nimbus' && w.home) return showLock({ needHome: w.home });
    } catch {}
  }
  const target = prefer || list[0];
  if (target) return await createVaultOn(target);
  showLock();
}
async function unlocked(key) {
  S.key = key;
  await idb.set('kv', 'key', key);
  const local = await idb.get('kv', 'catalog');
  if (local) { try { const c = await openCatalog(local); if (c && !c.foreign) S.catalog = c; } catch {} }
  S.catalog.folders ||= {}; S.catalog.files ||= {};
  $('#lock').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const onboarded = await idb.get('kv', 'onboarded');
  setView(onboarded === false || S.accounts.length < 2 ? 'clouds' : 'files');
  sync();
  takeShared();
}
async function sealCatalog() {
  const data = await C.encrypt(S.key, te.encode(JSON.stringify(S.catalog)));
  return JSON.stringify({ app: 'nimbus', v: 2, vault: S.vault.id, home: S.vault.home, data: C.toB64(data) });
}
async function openCatalog(text) {
  const w = JSON.parse(text);
  if (w.app !== 'nimbus') return null;
  if (w.vault !== S.vault.id) return { foreign: true };
  return JSON.parse(td.decode(await C.decrypt(S.key, C.fromB64(w.data))));
}

/* ───────── synchronisation de l'index (PC ⇄ téléphone) ───────── */
function merge(dst, src) {
  let ch = false;
  for (const k of ['folders', 'files'])
    for (const [id, v] of Object.entries(src[k] || {}))
      if (!dst[k][id] || (v.updatedAt || 0) > (dst[k][id].updatedAt || 0)) { dst[k][id] = v; ch = true; }
  return ch;
}
function upToDate(local, remote) {
  for (const k of ['folders', 'files'])
    for (const [id, v] of Object.entries(local[k]))
      if ((remote[k]?.[id]?.updatedAt ?? -1) !== v.updatedAt) return false;
  return true;
}
const persistLocal = async () => idb.set('kv', 'catalog', await sealCatalog());
let pushTimer, localTimer;
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(() => pushIndex(), 2000); }
async function commit() { clearTimeout(localTimer); await persistLocal(); render(); schedulePush(); }
function commitSoon() { clearTimeout(localTimer); localTimer = setTimeout(commit, 1500); }
async function pushIndex(list) {
  const text = await sealCatalog();
  list ||= S.accounts.filter(a => a.status === 'ok' && !a.foreign);
  await Promise.all(list.map(async a => {
    try { await PROVIDERS[a.provider].writeIndex(a, text); }
    catch (e) { if (e instanceof AuthError) a.status = 'expired'; console.warn(e); }
  }));
}
let syncing = false;
async function sync() {
  if (syncing || !S.key) return;
  syncing = true; $('#btnSync').classList.add('spin');
  try {
    await refreshQuotas();
    const live = S.accounts.filter(a => a.status === 'ok');
    const remotes = await Promise.all(live.map(async a => {
      try {
        const t = await PROVIDERS[a.provider].readIndex(a);
        const c = t ? await openCatalog(t) : null;
        a.foreign = !!c?.foreign;
        return { a, c: c?.foreign ? null : c, read: !c?.foreign };
      } catch { return { a, c: null, read: false }; }
    }));
    for (const r of remotes) if (r.a.foreign) toast(`${r.a.label} contient un autre coffre Nimbus : il ne sera pas modifié.`, 'err');
    let changed = false;
    for (const r of remotes) if (r.c) changed = merge(S.catalog, r.c) || changed;
    if (changed) { await persistLocal(); render(); }
    const stale = remotes.filter(r => r.read && (!r.c || !upToDate(S.catalog, r.c)));
    if (stale.length) await pushIndex(stale.map(r => r.a));
  } finally { syncing = false; $('#btnSync').classList.remove('spin'); }
}

/* ───────── catalogue ───────── */
const liveFolders = () => Object.values(S.catalog.folders).filter(f => !f.deleted);
const liveFiles = () => Object.values(S.catalog.files).filter(f => !f.deleted);
function folderPath(id) {
  const p = []; let cur = S.catalog.folders[id], guard = 0;
  while (cur && !cur.deleted && guard++ < 64) { p.unshift(cur); cur = S.catalog.folders[cur.parent]; }
  return p;
}
function newFolder(name, parent) {
  const f = { id: rid(), name, parent, updatedAt: now() };
  S.catalog.folders[f.id] = f;
  return f;
}
function ensurePath(parent, parts) {
  let cur = parent;
  for (const name of parts) {
    if (!name) continue;
    const f = liveFolders().find(x => x.parent === cur && x.name === name) || newFolder(name, cur);
    cur = f.id;
  }
  return cur;
}
async function removeBlob(c) {
  const a = S.accounts.find(x => x.id === c.a);
  if (!a) return;
  await PROVIDERS[a.provider].remove(a, c.r);
  a.used = Math.max(0, (a.used || 0) - c.s);
}
async function deleteFile(f) {
  for (const c of [...(f.chunks || []), ...(f.thumb ? [f.thumb] : [])]) await removeBlob(c).catch(e => console.warn(e));
  Object.assign(f, { deleted: true, chunks: [], thumb: null, updatedAt: now() });
  idb.del('thumbs', f.id).catch(() => {});
}
async function deleteFolder(id) {
  const ids = new Set([id]); let grew = true;
  while (grew) { grew = false; for (const f of liveFolders()) if (ids.has(f.parent) && !ids.has(f.id)) { ids.add(f.id); grew = true; } }
  for (const f of liveFiles()) if (ids.has(f.folder)) await deleteFile(f);
  for (const fid of ids) Object.assign(S.catalog.folders[fid], { deleted: true, updatedAt: now() });
}

/* ───────── envoi (chiffrement + répartition sur les clouds) ───────── */
async function putBlob(bytes, exclude, prefer) {
  const fails = new Map();
  for (;;) {
    let acc = prefer && S.accounts.find(a => a.id === prefer && a.status === 'ok' && !exclude.has(a.id) && free(a) - CONFIG.safetyMargin >= bytes.byteLength);
    prefer = null;
    acc ||= pickAccount(bytes.byteLength, exclude);
    if (!acc) {
      const e = new Error('Aucun cloud disponible : espace plein, connexion expirée ou réseau coupé.');
      e.fatal = true; throw e;
    }
    try {
      const r = await PROVIDERS[acc.provider].upload(acc, rid() + '.bin', bytes);
      acc.used = (acc.used || 0) + bytes.byteLength;
      return { a: acc.id, r, s: bytes.byteLength };
    } catch (e) {
      if (e instanceof AuthError) {
        acc.status = 'expired'; exclude.add(acc.id); saveAccounts(); renderSpace();
        toast(`${PROVIDERS[acc.provider].name} (${acc.label}) : session expirée, je continue sur les autres clouds.`);
        continue;
      }
      const k = (fails.get(acc.id) || 0) + 1; fails.set(acc.id, k);
      if (k >= 3) exclude.add(acc.id);
      await sleep(1000 * k);
    }
  }
}
async function makeThumb(file) {
  const type = file.type || guessType(file.name);
  if (!type.startsWith('image/') && !type.startsWith('video/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const src = await new Promise((res, rej) => {
      setTimeout(() => rej(new Error('timeout')), 10000);
      if (type.startsWith('image/')) {
        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
      } else {
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
        v.onseeked = () => res(v); v.onerror = rej; v.src = url;
      }
    });
    const w = src.naturalWidth || src.videoWidth, h = src.naturalHeight || src.videoHeight;
    if (!w || !h) return null;
    const k = Math.min(1, 360 / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    return await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.75));
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}
async function uploadFile(file, folder, exclude) {
  const id = rid(), chunks = [];
  const n = Math.max(1, Math.ceil(file.size / CONFIG.chunkSize));
  try {
    for (let i = 0; i < n; i++) {
      const part = await file.slice(i * CONFIG.chunkSize, Math.min(file.size, (i + 1) * CONFIG.chunkSize)).arrayBuffer();
      chunks.push(await putBlob(await C.encrypt(S.key, part), exclude));
      S.up.frac = (i + 1) / n; showProgress();
    }
    let thumb = null;
    const tb = await makeThumb(file);
    if (tb) {
      try { thumb = await putBlob(await C.encrypt(S.key, await tb.arrayBuffer()), exclude, chunks[0].a); await idb.set('thumbs', id, tb); }
      catch { thumb = null; }
    }
    const t = now();
    S.catalog.files[id] = { id, name: file.name, folder, size: file.size, type: file.type || guessType(file.name), mtime: file.lastModified || t, addedAt: t, updatedAt: t, chunks, thumb };
  } catch (e) {
    for (const c of chunks) removeBlob(c).catch(() => {});
    throw e;
  }
}
function enqueue(files, folderId) {
  files = [...files];
  if (!files.length) return;
  if (!S.accounts.some(a => a.status === 'ok')) { toast("Connecte d'abord au moins un cloud.", 'err'); setView('clouds'); return; }
  for (const file of files) {
    let folder = folderId;
    const rel = file.webkitRelativePath;
    if (rel && rel.includes('/')) folder = ensurePath(folderId, rel.split('/').slice(0, -1));
    S.queue.push({ file, folder });
  }
  runQueue();
}
async function runQueue() {
  if (S.busy) { showProgress(); return; }
  S.busy = true;
  S.up = { done: 0, sent: 0, skipped: 0, failed: 0, current: '', frac: 0, active: false };
  let wake = null;
  try { wake = await navigator.wakeLock?.request('screen'); } catch {}
  // déjà présent = même nom, même taille, même date → ignoré (on peut renvoyer toute la galerie sans doublons)
  const known = new Set(liveFiles().map(f => `${f.name}|${f.size}|${f.mtime}`));
  const exclude = new Set();
  while (S.queue.length) {
    const { file, folder } = S.queue.shift();
    const sig = `${file.name}|${file.size}|${file.lastModified}`;
    if (known.has(sig)) { S.up.skipped++; S.up.done++; showProgress(); continue; }
    Object.assign(S.up, { current: file.name, frac: 0, active: true }); showProgress();
    try { await uploadFile(file, folder, exclude); known.add(sig); S.up.sent++; }
    catch (e) {
      S.up.failed++; toast(`${file.name} : ${e.message}`, 'err');
      if (e.fatal) { S.up.failed += S.queue.length; S.up.done += S.queue.length; S.queue = []; }
    }
    S.up.done++; S.up.active = false; showProgress(); commitSoon();
  }
  S.busy = false;
  try { await wake?.release(); } catch {}
  await commit();
  showProgress(true);
  await saveAccounts(); renderSpace();
}
function showProgress(finished = false) {
  const p = $('#progress'), u = S.up;
  if (!u) return;
  p.classList.remove('hidden');
  const total = u.done + S.queue.length + (u.active ? 1 : 0);
  if (finished) {
    $('#ptext').textContent = `✓ Terminé : ${u.sent} envoyé(s)` + (u.skipped ? `, ${u.skipped} déjà présent(s)` : '') + (u.failed ? `, ${u.failed} erreur(s)` : '');
    $('#pbar').style.width = '100%';
    setTimeout(() => { if (!S.busy) p.classList.add('hidden'); }, 6000);
    return;
  }
  $('#ptext').textContent = `🔐 Envoi ${Math.min(total, u.done + 1)}/${total} · ${u.current}`;
  $('#pbar').style.width = (total ? ((u.done + (u.active ? u.frac : 0)) / total) * 100 : 0) + '%';
}
async function takeShared() {
  const files = await idb.all('inbox').catch(() => []);
  if (!files.length) return;
  await idb.clear('inbox');
  toast(`${files.length} fichier(s) reçu(s) depuis le partage`);
  enqueue(files, S.cwd);
}

/* ───────── téléchargement ───────── */
async function fetchFile(f) {
  const parts = [];
  for (const c of f.chunks) {
    const a = S.accounts.find(x => x.id === c.a);
    if (!a) throw new Error("Le cloud qui contient ce fichier n'est plus connecté.");
    if (a.status === 'expired') throw new Error(`Reconnecte ${a.label} pour ouvrir ce fichier.`);
    parts.push(await C.decrypt(S.key, await PROVIDERS[a.provider].download(a, c.r)));
  }
  return new Blob(parts, { type: f.type || 'application/octet-stream' });
}

/* ───────── miniatures ───────── */
const thumbURLs = new Map(); const thumbWait = []; let thumbActive = 0, io = null;
function observeThumbs() {
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); loadThumb(e.target); } }), { rootMargin: '300px' });
  document.querySelectorAll('.thumb[data-thumb]').forEach(el => io.observe(el));
}
async function loadThumb(el) {
  const f = S.catalog.files[el.dataset.thumb];
  if (!f?.thumb) return;
  let url = thumbURLs.get(f.id);
  if (!url) {
    let blob = await idb.get('thumbs', f.id);
    if (!blob) {
      if (thumbActive >= 4) { thumbWait.push(el); return; }
      thumbActive++;
      try {
        const a = S.accounts.find(x => x.id === f.thumb.a);
        if (!a || a.status !== 'ok') return;
        blob = new Blob([await C.decrypt(S.key, await PROVIDERS[a.provider].download(a, f.thumb.r))], { type: 'image/jpeg' });
        await idb.set('thumbs', f.id, blob);
      } catch { return; }
      finally { thumbActive--; const next = thumbWait.shift(); if (next) loadThumb(next); }
    }
    url = URL.createObjectURL(blob); thumbURLs.set(f.id, url);
  }
  if (!el.isConnected) return;
  const img = new Image(); img.alt = ''; img.src = url;
  el.querySelector('.ico')?.remove();
  el.prepend(img);
}

/* ───────── rendu ───────── */
function render() { renderSpace(); if (S.view === 'files') renderFiles(); else renderClouds(); }
function renderSpace() {
  const ok = S.accounts.filter(a => a.status === 'ok');
  const tot = ok.reduce((s, a) => s + (a.total || 0), 0), fr = ok.reduce((s, a) => s + free(a), 0);
  const warn = S.accounts.some(a => a.status !== 'ok');
  $('#spaceSummary').innerHTML = S.accounts.length
    ? `<b>${fmt(fr)}</b> libres / ${fmt(tot)}${warn ? ' <span class="dot-warn" title="Un cloud demande une reconnexion">●</span>' : ''}`
    : 'Aucun cloud';
}
function setView(v) {
  S.view = v;
  $('#viewFiles').classList.toggle('hidden', v !== 'files');
  $('#viewClouds').classList.toggle('hidden', v !== 'clouds');
  $('#fab').classList.toggle('hidden', v !== 'files');
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  render();
}
function renderFiles() {
  if (S.cwd !== 'root' && (!S.catalog.folders[S.cwd] || S.catalog.folders[S.cwd].deleted)) S.cwd = 'root';
  const crumbs = [{ id: 'root', name: 'Mon coffre' }, ...folderPath(S.cwd)];
  $('#crumbs').innerHTML = crumbs.map((c, i) => `<button data-folder="${c.id}" class="${i === crumbs.length - 1 ? 'cur' : ''}">${esc(c.name)}</button>`).join('<span class="sep">›</span>');
  const folders = liveFolders().filter(f => f.parent === S.cwd).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const files = liveFiles().filter(f => f.folder === S.cwd).sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  $('#grid').innerHTML =
    folders.map(f => `<div class="tile folder" data-folder="${f.id}"><div class="thumb"><span class="ico">📁</span></div><div class="name">${esc(f.name)}</div><button class="more" data-fmenu="${f.id}" aria-label="Options">⋯</button></div>`).join('') +
    files.map(f => `<div class="tile" data-file="${f.id}"><div class="thumb"${f.thumb ? ` data-thumb="${f.id}"` : ''}><span class="ico">${icon(f.type)}</span>${f.type?.startsWith('video/') ? '<span class="badge">▶</span>' : ''}</div><div class="name">${esc(f.name)}</div><div class="meta">${fmt(f.size)}</div></div>`).join('');
  $('#empty').classList.toggle('hidden', folders.length + files.length > 0);
  observeThumbs();
}
function providerCards(withSignup) {
  return Object.values(PROVIDERS).map((P, n) => {
    const mine = S.accounts.filter(a => a.provider === P.type), g = GUIDE[P.type];
    const off = '';
    return `<div class="pcard${mine.length ? ' done' : ''}" style="--pc:${P.color}">
      <div class="plogo">${mine.length ? '✓' : P.letter}</div>
      <div class="pbody">
        <div class="pname"><span class="step">${n + 1}</span>${P.name} <span class="pfree">${P.freeHint}</span></div>
        <div class="phint">${mine.length ? `✓ ${mine.length} compte(s) connecté(s). Tu peux en ajouter un autre pour plus d'espace.` : P.hasIt}</div>
        ${withSignup && !mine.length ? `<details class="howto"><summary>⏱ ${g.time} · Comment s'inscrire ?</summary>
          <p class="hint">💡 ${g.need}</p><ol>${g.steps.map(x => `<li>${x}</li>`).join('')}</ol></details>` : ''}
        <div class="pbtns">
          <button class="btn primary sm" data-connect="${P.type}"${off}>${mine.length ? '+ Ajouter un compte' : "J'ai déjà un compte"}</button>
          ${withSignup && !mine.length ? `<button class="btn sm" data-signup="${P.type}"${off}>Créer un compte gratuit</button>` : ''}
        </div>
      </div></div>`;
  }).join('');
}
function expressGuide() {
  const possible = Object.values(GUIDE).reduce((t, g) => t + g.gb, 0);
  const have = new Set(S.accounts.map(a => a.provider));
  const got = Object.entries(GUIDE).filter(([k]) => have.has(k)).reduce((t, [, g]) => t + g.gb, 0);
  return `<div class="card welcome">
    <h2>Étape 2/2 : branche tes clouds</h2>
    <p><b>≈ ${possible} Go gratuits en ≈ 7 minutes.</b> Pas besoin de tout faire d'un coup : Google + MEGA donnent déjà 35 Go.</p>
    <div class="bar"><i style="width:${Math.min(100, (got / possible) * 100)}%"></i></div>
    <p class="hint">${got} Go branchés sur ${possible} Go possibles</p>
    <ul class="hint list">
      <li><b>Tu as déjà le compte ?</b> → « J'ai déjà un compte ». Nimbus prend seulement l'espace libre, dans son propre dossier, sans toucher à tes fichiers.</li>
      <li><b>Pas encore ?</b> → « Créer un compte gratuit » ouvre l'inscription dans un nouvel onglet. Reviens ici ensuite.</li>
      <li><b>Va plus vite :</b> utilise la même adresse e-mail partout, « Continuer avec Google » quand c'est proposé, et laisse ton navigateur enregistrer les mots de passe.</li>
      <li>Plusieurs comptes d'un même service = encore plus d'espace.</li>
    </ul>
    <button class="btn primary" id="doneOnboarding"${S.accounts.length ? '' : ' disabled'}>C'est bon, j'envoie mes photos →</button>
  </div>`;
}
function accountCard(a, mine) {
  const P = PROVIDERS[a.provider], pct = a.total ? Math.min(100, (a.used / a.total) * 100) : 0;
  const st = a.status === 'ok' ? '' : a.status === 'expired' ? '<span class="chip warn">Reconnexion requise</span>' : `<span class="chip err" title="${esc(a.error)}">Erreur</span>`;
  return `<div class="acard" style="--pc:${P.color}">
    <div class="plogo">${P.letter}</div>
    <div class="pbody">
      <div class="pname">${P.name} ${isHome(a) ? '<span class="chip home">⭐ Compte principal</span>' : ''} ${st}</div>
      <div class="phint">${esc(a.label || '…')}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="phint">${fmt(free(a))} libres sur ${fmt(a.total)} · Nimbus y occupe ${fmt(mine)}</div>
      <div class="pbtns">
        ${a.status !== 'ok' ? `<button class="btn primary sm" data-reconnect="${a.id}">Reconnecter</button>` : ''}
        ${isHome(a) ? '' : `<button class="btn sm ghost" data-remove="${a.id}">Retirer</button>`}
      </div>
    </div></div>`;
}
async function renderClouds() {
  const usage = {};
  for (const f of liveFiles()) for (const c of [...f.chunks, ...(f.thumb ? [f.thumb] : [])]) usage[c.a] = (usage[c.a] || 0) + c.s;
  const ok = S.accounts.filter(a => a.status === 'ok');
  const tot = ok.reduce((s, a) => s + (a.total || 0), 0), used = ok.reduce((s, a) => s + (a.used || 0), 0);
  const onboarding = (await idb.get('kv', 'onboarded')) === false;
  $('#viewClouds').innerHTML = `
    ${onboarding ? expressGuide() : ''}
    <div class="card total">
      <div class="big">${fmt(tot - used)}</div>
      <div class="hint">libres au total · ${fmt(tot)} cumulés sur ${S.accounts.length} cloud(s)</div>
      <div class="bar"><i style="width:${tot ? (used / tot) * 100 : 0}%"></i></div>
      <div class="hint">${liveFiles().length} fichier(s) dans ton coffre</div>
    </div>
    ${S.accounts.length ? `<h3>Tes clouds connectés</h3>${S.accounts.map(a => accountCard(a, usage[a.id] || 0)).join('')}` : ''}
    <h3>${S.accounts.length ? 'Ajouter des clouds' : 'Connecte tes clouds'}</h3>
    ${providerCards(true)}
    <p class="hint soon">Bientôt : kDrive, Koofr, Box, Filen, Icedrive… (avec un petit serveur).</p>
    <div class="card">
      <h3>🔐 Sécurité</h3>
      <ul class="hint list">
        <li>Chaque fichier est chiffré (AES-256) sur ton appareil <b>avant</b> l'envoi. Les clouds ne stockent que des morceaux illisibles aux noms aléatoires.</li>
        <li>La clé de chiffrement est rangée dans ton <b>compte principal</b>${S.vault?.home ? ` (${esc(S.vault.home.label)})` : ''}. Protège-le avec la double authentification, et ne supprime pas le fichier <i>nimbus-cle.json</i> du dossier Nimbus.</li>
        <li>Nimbus n'a accès qu'à son propre dossier sur chaque cloud, jamais à tes autres fichiers.</li>
        <li>Aucun serveur Nimbus : les connexions vont directement de ton appareil vers chaque cloud.</li>
      </ul>
    </div>`;
}
function showLock({ needHome = null, busy = '' } = {}) {
  const el = $('#lock');
  el.classList.remove('hidden'); $('#app').classList.add('hidden');
  const H = needHome && PROVIDERS[needHome.provider];
  el.innerHTML = `<div class="lockbox">
    <div class="logo">☁</div><h1>Nimbus</h1>
    <p class="sub">Tous tes clouds gratuits réunis dans un seul espace sécurisé.</p>
    ${busy ? `<div class="card center"><div class="spinner"></div><p>${esc(busy)}</p></div>`
    : H ? `<div class="card">
        <h2>Reconnecte ton compte principal</h2>
        <p class="hint">Ton espace Nimbus est rattaché à <b>${esc(needHome.label)}</b> (${H.name}). Connecte ce compte pour l'ouvrir sur cet appareil.</p>
        <button class="btn login" style="--pc:${H.color}" data-connect="${H.type}"><span class="plogo">${H.letter}</span>Continuer avec ${H.brand}</button>
      </div>`
    : `<div class="card">
        <h2>Connecte-toi</h2>
        <p class="hint">Pas de compte à créer ni de mot de passe à inventer : utilise un compte que tu as déjà. Ce sera ton <b>compte principal</b>.</p>
        <div class="login-btns">${Object.values(PROVIDERS).map(P => `<button class="btn login" style="--pc:${P.color}" data-pick="${P.type}"><span class="plogo">${P.letter}</span>Continuer avec ${P.brand}</button>`).join('')}</div>
        <p class="hint center">Tu as une adresse Gmail ? Choisis Google.</p>
      </div>
      <div class="card">
        <h3>Comment ça marche ?</h3>
        <ol class="hint list">
          <li><b>Connecte-toi</b> avec ton compte principal.</li>
          <li><b>Ajoute tes autres clouds gratuits</b> : on te guide pas à pas (≈ 52 Go en 7 min).</li>
          <li><b>Envoie tes photos</b> : Nimbus les répartit et les protège tout seul.</li>
        </ol>
        <p class="hint">🔐 Tes fichiers sont chiffrés avant de quitter ton appareil : les clouds ne voient que des morceaux illisibles.</p>
      </div>`}
  </div>`;
}

/* ───────── feuilles d'actions & visionneuse ───────── */
function actionSheet(title, actions) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-panel"><div class="sheet-title">${esc(title)}</div>
    ${actions.map((a, i) => `<button class="sheet-btn${a.danger ? ' danger' : ''}" data-i="${i}">${a.label}</button>`).join('')}
    <button class="sheet-btn cancel" data-i="-1">Annuler</button></div>`;
  sh.classList.remove('hidden');
  sh.onclick = e => {
    const b = e.target.closest('[data-i]');
    if (!b && e.target !== sh) return;
    sh.classList.add('hidden');
    const i = b ? +b.dataset.i : -1;
    if (i >= 0) actions[i].run();
  };
}
function folderMenu(id) {
  const f = S.catalog.folders[id];
  actionSheet(f.name, [
    { label: '✎ Renommer', run: async () => { const n = prompt('Nouveau nom', f.name); if (n?.trim()) { f.name = n.trim(); f.updatedAt = now(); await commit(); } } },
    { label: '🗑 Supprimer le dossier et son contenu', danger: true, run: async () => { if (confirm(`Supprimer « ${f.name} » et tout son contenu de tes clouds ?`)) { await deleteFolder(id); await commit(); toast('Dossier supprimé'); } } },
  ]);
}
function moveDialog(f, done) {
  const opts = [{ id: 'root', label: 'Mon coffre' }, ...liveFolders().map(x => ({ id: x.id, label: ['Mon coffre', ...folderPath(x.id).map(p => p.name)].join(' / ') }))]
    .filter(o => o.id !== f.folder).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  actionSheet('Déplacer vers…', opts.map(o => ({ label: '📁 ' + esc(o.label), run: async () => { f.folder = o.id; f.updatedAt = now(); await commit(); done(); toast('Déplacé'); } })));
}
async function openViewer(id) {
  const f = S.catalog.files[id], v = $('#viewer'), token = {};
  const where = [...new Set(f.chunks.map(c => S.accounts.find(a => a.id === c.a)?.label || 'cloud retiré'))].join(', ');
  v.innerHTML = `<div class="modal-panel">
    <header><div class="vname">${esc(f.name)}</div><button class="icon" data-act="close" aria-label="Fermer">✕</button></header>
    <div class="vbody" id="vbody"><div class="loader">🔓 Déchiffrement…</div></div>
    <div class="vinfo">${fmt(f.size)} · ${new Date(f.mtime || f.addedAt).toLocaleString('fr-FR')} · stocké sur ${esc(where)}</div>
    <div class="vactions">
      <button class="btn" data-act="dl" disabled>⬇ Télécharger</button>
      ${navigator.canShare ? '<button class="btn" data-act="share" disabled>↗ Partager</button>' : ''}
      <button class="btn" data-act="rename">✎ Renommer</button>
      <button class="btn" data-act="move">➜ Déplacer</button>
      <button class="btn danger" data-act="del">🗑 Supprimer</button>
    </div></div>`;
  v.classList.remove('hidden');
  S.viewerToken = token;
  let url = null, blob = null;
  const close = () => { v.classList.add('hidden'); v.innerHTML = ''; S.viewerToken = null; if (url) URL.revokeObjectURL(url); };
  v.onclick = async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (e.target === v || act === 'close') close();
    else if (act === 'dl') { const a = document.createElement('a'); a.href = url; a.download = f.name; a.click(); }
    else if (act === 'share') { try { await navigator.share({ files: [new File([blob], f.name, { type: f.type })] }); } catch {} }
    else if (act === 'rename') { const n = prompt('Nouveau nom', f.name); if (n?.trim()) { f.name = n.trim(); f.updatedAt = now(); await commit(); v.querySelector('.vname').textContent = f.name; } }
    else if (act === 'move') moveDialog(f, close);
    else if (act === 'del' && confirm(`Supprimer « ${f.name} » de tes clouds ?`)) { close(); await deleteFile(f); await commit(); toast('Supprimé'); }
  };
  try {
    blob = await fetchFile(f);
    if (S.viewerToken !== token) return;
    url = URL.createObjectURL(blob);
    const body = $('#vbody');
    if (f.type?.startsWith('image/')) body.innerHTML = `<img src="${url}" alt="">`;
    else if (f.type?.startsWith('video/')) body.innerHTML = `<video src="${url}" controls playsinline autoplay></video>`;
    else body.innerHTML = `<div class="bigicon">${icon(f.type)}</div>`;
    v.querySelectorAll('[data-act=dl],[data-act=share]').forEach(b => { b.disabled = false; });
  } catch (e) {
    if (S.viewerToken === token) $('#vbody').innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
}

/* ───────── événements ───────── */
function bind() {
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#btnSync').onclick = () => sync().then(() => toast('Synchronisé'));
  $('#btnLock').onclick = async () => {
    if (!confirm("Se déconnecter de Nimbus sur cet appareil ?\n\nTes fichiers restent sur tes clouds : tu les retrouveras en te reconnectant avec ton compte principal.")) return;
    for (const k of ['key', 'vault', 'catalog', 'accounts', 'onboarded']) await idb.del('kv', k);
    await idb.clear('thumbs');
    location.reload();
  };
  $('#crumbs').onclick = e => { const b = e.target.closest('[data-folder]'); if (b) { S.cwd = b.dataset.folder; renderFiles(); } };
  $('#grid').onclick = e => {
    const m = e.target.closest('[data-fmenu]'); if (m) { e.stopPropagation(); return folderMenu(m.dataset.fmenu); }
    const fo = e.target.closest('[data-folder]'); if (fo) { S.cwd = fo.dataset.folder; return renderFiles(); }
    const fi = e.target.closest('[data-file]'); if (fi) openViewer(fi.dataset.file);
  };
  const dirSupported = 'webkitdirectory' in document.createElement('input') && !/Android|iPhone|iPad/i.test(navigator.userAgent);
  $('#fab').onclick = () => actionSheet('Ajouter', [
    { label: '🖼️ Photos & vidéos', run: () => $('#inMedia').click() },
    { label: '📄 Fichiers', run: () => $('#inFiles').click() },
    ...(dirSupported ? [{ label: '🗂️ Un dossier entier (avec sous-dossiers)', run: () => $('#inDir').click() }] : []),
    { label: '📁 Nouveau dossier', run: async () => { const n = prompt('Nom du dossier'); if (n?.trim()) { newFolder(n.trim(), S.cwd); await commit(); } } },
  ]);
  for (const id of ['inMedia', 'inFiles', 'inDir']) $('#' + id).onchange = e => { enqueue(e.target.files, S.cwd); e.target.value = ''; };

  // clics « connecter / créer / retirer » (écran de verrouillage et vue Clouds)
  document.body.addEventListener('click', async e => {
    const t = e.target.closest('[data-pick],[data-connect],[data-signup],[data-reconnect],[data-remove],#doneOnboarding');
    if (!t || t.disabled) return;
    if (t.id === 'doneOnboarding') { await idb.set('kv', 'onboarded', true); setView('files'); $('#fab').click(); return; }
    if (t.dataset.pick) return pickSheet(t.dataset.pick);
    if (t.dataset.connect) return connect(t.dataset.connect);
    if (t.dataset.signup) {
      const P = PROVIDERS[t.dataset.signup];
      window.open(P.signup, '_blank', 'noopener');
      t.textContent = "C'est fait ? Me connecter →";
      t.classList.add('primary');
      t.removeAttribute('data-signup'); t.dataset.connect = P.type;
      return;
    }
    if (t.dataset.reconnect) { const a = S.accounts.find(x => x.id === t.dataset.reconnect); return connect(a.provider, a); }
    if (t.dataset.remove) {
      const a = S.accounts.find(x => x.id === t.dataset.remove);
      if (isHome(a)) return toast("C'est ton compte principal : il garde la clé de ton espace, il ne peut pas être retiré.", 'err');
      const n = liveFiles().filter(f => f.chunks.some(c => c.a === a.id)).length;
      if (!confirm(`Retirer ${a.label} de Nimbus ?${n ? `\n\n⚠️ ${n} fichier(s) y sont stockés et deviendront inaccessibles tant que tu ne le reconnectes pas.` : ''}`)) return;
      S.accounts = S.accounts.filter(x => x !== a);
      await saveAccounts(); render();
    }
  });

  // glisser-déposer (PC)
  let dragN = 0;
  addEventListener('dragenter', e => { if (S.key && e.dataTransfer?.types?.includes('Files')) { dragN++; $('#drop').classList.remove('hidden'); } });
  addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; $('#drop').classList.add('hidden'); } });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); dragN = 0; $('#drop').classList.add('hidden'); if (S.key) enqueue(e.dataTransfer.files, S.cwd); });
  addEventListener('beforeunload', e => { if (S.busy) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.key && !S.busy) sync(); });
}

/* ───────── démarrage ───────── */
async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  bind();
  S.accounts = (await idb.get('kv', 'accounts')) || [];
  S.vault = (await idb.get('kv', 'vault')) || null;
  let err = null, added = null;
  try {
    added = await handleRedirect();
    if (added) {
      added.status = 'ok';
      const i = S.accounts.findIndex(a => a.id === added.id);
      if (i >= 0) S.accounts[i] = added; else S.accounts.push(added);
      await saveAccounts();
    }
  } catch (e) { err = e; }
  if (location.search.includes('shared=1')) history.replaceState(null, '', location.pathname);
  await refreshQuotas();
  if (added) { const a = S.accounts.find(x => x.id === added.id) || added; toast(`✓ ${PROVIDERS[a.provider].name} connecté${a.label ? ' : ' + a.label : ''}`); }
  const key = await idb.get('kv', 'key');
  if (key && S.vault) await unlocked(key);
  else if (S.accounts.some(a => a.status === 'ok')) {
    showLock({ busy: 'Ouverture de ton espace…' });
    try { await findVault(added); }
    catch (e) { showLock(); toast(e.message, 'err'); }
  } else showLock();
  if (err) toast(err.message, 'err');
}
boot();
