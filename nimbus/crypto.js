// Chiffrement AES-256-GCM. Chaque coffre a une clé aléatoire de 256 bits, rangée dans le compte principal
// de l'utilisateur ; sur l'appareil, elle est gardée sous forme non exportable.
const te = new TextEncoder();

export function newRawKey() { return crypto.getRandomValues(new Uint8Array(32)); }
export function importKey(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Format : [IV 12 octets][données chiffrées + tag 16 octets]
export async function encrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv); out.set(ct, 12);
  return out;
}

export async function decrypt(key, data) {
  const b = new Uint8Array(data);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) }, key, b.subarray(12));
}

export function toB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(str) {
  const s = atob(str), u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
