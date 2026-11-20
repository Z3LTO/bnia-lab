// Petit wrapper IndexedDB (stockage local de l'appareil)
const DB_NAME = 'nimbus';
const STORES = ['kv', 'thumbs', 'inbox'];
let dbp = null;

function open() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export const idb = {
  get: (s, k) => run(s, 'readonly', st => st.get(k)),
  set: (s, k, v) => run(s, 'readwrite', st => st.put(v, k)),
  del: (s, k) => run(s, 'readwrite', st => st.delete(k)),
  all: s => run(s, 'readonly', st => st.getAll()),
  clear: s => run(s, 'readwrite', st => st.clear()),
};
