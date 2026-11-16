// Teoría básica: nombres de notas (español + cifrado), intervalos, escalas, acordes.

export const ES = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
export const EN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const ES_B = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
export const EN_B = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const NATURALS = [0, 2, 4, 5, 7, 9, 11];

export const pc = (n) => ((Math.round(n) % 12) + 12) % 12;

/** "Do (C)" */
export function nm(p, flat = false) {
  p = pc(p);
  return flat ? `${ES_B[p]} (${EN_B[p]})` : `${ES[p]} (${EN[p]})`;
}
/** Solo español: "Do" */
export function es(p, flat = false) { return (flat ? ES_B : ES)[pc(p)]; }
/** Solo cifrado: "C" */
export function en(p, flat = false) { return (flat ? EN_B : EN)[pc(p)]; }
/** HTML con el cifrado pequeño */
export function nmHtml(p, flat = false) {
  return `${es(p, flat)}<small class="cif">${en(p, flat)}</small>`;
}

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const ftom = (f) => 69 + 12 * Math.log2(f / 440);

/** Diferencia en cents entre una frecuencia y una clase de nota (cualquier octava). Rango -600..600 */
export function centsToPc(freq, targetPc) {
  const m = ftom(freq);
  let d = (m - targetPc) % 12;
  if (d < 0) d += 12;
  if (d > 6) d -= 12;
  return d * 100;
}
/** Nota más cercana a una frecuencia */
export function nearest(freq) {
  const m = ftom(freq);
  const r = Math.round(m);
  return { midi: r, pc: pc(r), octave: Math.floor(r / 12) - 1, cents: (m - r) * 100 };
}

export const INTERVALS = [
  { s: 0, n: 'unísono', d: '1' },
  { s: 1, n: '2ª menor', d: '♭2' },
  { s: 2, n: '2ª mayor', d: '2' },
  { s: 3, n: '3ª menor', d: '♭3' },
  { s: 4, n: '3ª mayor', d: '3' },
  { s: 5, n: '4ª justa', d: '4' },
  { s: 6, n: 'tritono', d: '♭5' },
  { s: 7, n: '5ª justa', d: '5' },
  { s: 8, n: '6ª menor', d: '♭6' },
  { s: 9, n: '6ª mayor', d: '6' },
  { s: 10, n: '7ª menor', d: '♭7' },
  { s: 11, n: '7ª mayor', d: '7' },
  { s: 12, n: 'octava', d: '8' },
];

export const SCALES = {
  mayor: { n: 'mayor', f: [0, 2, 4, 5, 7, 9, 11], d: ['1', '2', '3', '4', '5', '6', '7'] },
  menor: { n: 'menor natural', f: [0, 2, 3, 5, 7, 8, 10], d: ['1', '2', '♭3', '4', '5', '♭6', '♭7'] },
  pentaMenor: { n: 'pentatónica menor', f: [0, 3, 5, 7, 10], d: ['1', '♭3', '4', '5', '♭7'] },
  pentaMayor: { n: 'pentatónica mayor', f: [0, 2, 4, 7, 9], d: ['1', '2', '3', '5', '6'] },
  dorico: { n: 'dórico', f: [0, 2, 3, 5, 7, 9, 10], d: ['1', '2', '♭3', '4', '5', '6', '♭7'] },
  frigio: { n: 'frigio', f: [0, 1, 3, 5, 7, 8, 10], d: ['1', '♭2', '♭3', '4', '5', '♭6', '♭7'] },
  lidio: { n: 'lidio', f: [0, 2, 4, 6, 7, 9, 11], d: ['1', '2', '3', '♯4', '5', '6', '7'] },
};

export const CHORDS = {
  mayor: { n: 'mayor', sym: '', f: [0, 4, 7], d: ['1', '3', '5'] },
  menor: { n: 'menor', sym: 'm', f: [0, 3, 7], d: ['1', '♭3', '5'] },
  power: { n: 'power chord', sym: '5', f: [0, 7], d: ['1', '5'] },
  dim: { n: 'disminuido', sym: 'dim', f: [0, 3, 6], d: ['1', '♭3', '♭5'] },
  sus2: { n: 'sus2', sym: 'sus2', f: [0, 2, 7], d: ['1', '2', '5'] },
  sus4: { n: 'sus4', sym: 'sus4', f: [0, 5, 7], d: ['1', '4', '5'] },
};

/** Tonalidades habituales en rock, con la ortografía correcta (sostenidos o bemoles). */
export const KEYS = [
  { root: 4, mode: 'menor', flat: false },   // Mi menor
  { root: 9, mode: 'menor', flat: false },   // La menor
  { root: 11, mode: 'menor', flat: false },  // Si menor
  { root: 2, mode: 'menor', flat: true },    // Re menor
  { root: 6, mode: 'menor', flat: false },   // Fa♯ menor
  { root: 0, mode: 'mayor', flat: false },   // Do mayor
  { root: 7, mode: 'mayor', flat: false },   // Sol mayor
  { root: 2, mode: 'mayor', flat: false },   // Re mayor
  { root: 9, mode: 'mayor', flat: false },   // La mayor
  { root: 4, mode: 'mayor', flat: false },   // Mi mayor
];
export function keyName(k) { return `${nm(k.root, k.flat)} ${k.mode}`; }
export function scaleNotes(k) { return SCALES[k.mode].f.map((s) => pc(k.root + s)); }

/** Afinación estándar (por confirmar con Rodrigo). MIDI de cada cuerda, de grave a aguda. */
export const TUNINGS = {
  bajo: { n: 'Bajo', strings: [28, 33, 38, 43] },
  guitarra: { n: 'Guitarra', strings: [40, 45, 50, 55, 59, 64] },
};

// ---- Azar reproducible (mismo set durante todo el día) ----
export function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}
export function rngFrom(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.shuffle = (arr) => {
    const a2 = arr.slice();
    for (let i = a2.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a2[i], a2[j]] = [a2[j], a2[i]];
    }
    return a2;
  };
  return r;
}
