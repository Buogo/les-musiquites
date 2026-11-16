// Estado guardado en el teléfono: ajustes, días, registro de práctica y tomas grabadas.
const KEY = 'lm.v1';

const defaults = () => ({
  v: 1,
  settings: { latencyMs: null, tonic: 45 },
  days: {},      // 'YYYY-MM-DD' -> { blocks: [{id, seed, reroll, done, result}], done }
  log: [],       // { t, ex, cat, topic, widget, summary, metrics, extra }
  cards: {},     // id de ficha -> fecha del último repaso
  course: { checks: {} },
  reviews: {},   // 'YYYY-MM-DD' (sábado) -> { answers: [], done }
  notes: '',     // notas privadas de la ficha «Tu diagnóstico»
});

function merge(base, extra) {
  if (!extra || typeof extra !== 'object') return base;
  for (const k of Object.keys(extra)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k])) {
      merge(base[k], extra[k]);
    } else {
      base[k] = extra[k];
    }
  }
  return base;
}

export const store = {
  data: defaults(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(defaults(), JSON.parse(raw));
    } catch (e) { this.data = defaults(); }
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* sin espacio o modo privado */ }
  },
  log(entry) {
    this.data.log.push({ t: Date.now(), ...entry });
    if (this.data.log.length > 2000) this.data.log.splice(0, this.data.log.length - 2000);
    this.save();
  },
  replace(obj) {
    this.data = merge(defaults(), obj);
    this.save();
  },
};

export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Días seguidos con el set completo (hoy cuenta si ya está hecho). */
export function streak() {
  let n = 0;
  let d = new Date();
  if (!(store.data.days[dayKey(d)] || {}).done) d = addDays(d, -1);
  while ((store.data.days[dayKey(d)] || {}).done) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
/** Registro de los últimos n días. */
export function recentLog(days = 7) {
  const from = Date.now() - days * 86400000;
  return store.data.log.filter((e) => e.t >= from);
}

// ---- Tomas grabadas (IndexedDB) ----
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('lm', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('takes', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('takes', mode);
    const r = fn(t.objectStore('takes'));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
  }));
}
export const takes = {
  add(take) { return tx('readwrite', (s) => s.add({ t: Date.now(), ...take })); },
  all() { return tx('readonly', (s) => s.getAll()).then((a) => (a || []).sort((x, y) => y.t - x.t)).catch(() => []); },
  del(id) { return tx('readwrite', (s) => s.delete(id)); },
};
