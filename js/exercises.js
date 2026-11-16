// Banco de ejercicios. Cada uno genera una variante al azar a partir de una semilla,
// así el set del día es el mismo todo el día y distinto mañana.
import {
  nm, es, en, pc, INTERVALS, SCALES, CHORDS, KEYS, keyName, scaleNotes, TUNINGS, NATURALS, rngFrom, hashStr,
} from './music.js';
import { store } from './store.js';

const uniq = (a) => [...new Set(a)];
const b = (s) => `<b>${s}</b>`;

/** Pregunta de alternativas. */
function mc(rng, q, correct, wrongs, why, extra = {}) {
  const w = uniq(wrongs).filter((x) => x !== correct).slice(0, 3);
  const opts = rng.shuffle([correct, ...w]);
  return { q, opts, a: opts.indexOf(correct), why, ...extra };
}
const triadTxt = (r, f, flat) => `${f.map((s) => es(r + s, flat)).join(' – ')} <small class="cif">${f.map((s) => en(r + s, flat)).join(' – ')}</small>`;
const chordSym = (r, type, flat) => `${nm(r, flat).replace(')', CHORDS[type].sym + ')')}`;
const chordName = (r, type, flat) => `<span class="nw">${es(r, flat)} ${type === 'power' ? '5' : CHORDS[type].n} <small class="cif">${en(r, flat)}${CHORDS[type].sym}</small></span>`;

// ---------- Generadores de preguntas ----------
const Q = {
  semitonos(rng) {
    const kind = rng.int(0, 9);
    if (kind < 4) {
      const pairs = [[0, 2], [2, 4], [4, 5], [5, 7], [7, 9], [9, 11], [11, 0], [4, 5], [11, 0], [4, 5], [11, 0]];
      const [x, y] = rng.pick(pairs);
      const semi = pc(y - x) === 1;
      const why = semi
        ? `${es(x)}–${es(y)} es uno de los dos únicos pares de notas naturales pegadas (el otro es ${x === 4 ? 'Si–Do' : 'Mi–Fa'}): un solo traste de distancia.`
        : `Entre ${es(x)} y ${es(y)} hay una nota en medio (${es(x + 1)}): son dos trastes, un tono.`;
      return { q: `De ${b(nm(x))} a ${b(nm(y))} hay…`, opts: ['Un semitono (1 traste)', 'Un tono (2 trastes)'], a: semi ? 0 : 1, why };
    }
    if (kind < 7) {
      const x = rng.pick(NATURALS);
      const s = rng.int(1, 7);
      const path = Array.from({ length: s + 1 }, (_, i) => es(x + i)).join(' → ');
      return mc(rng, `¿Cuántos trastes (semitonos) subes para ir de ${b(nm(x))} a ${b(nm(x + s))}?`, `${s}`,
        [`${s + 1}`, `${Math.max(1, s - 1) === s ? s + 2 : Math.max(1, s - 1)}`, `${s + 2}`, `${s + 3}`], `Cuenta traste a traste: ${path}.`);
    }
    const x = rng.pick(NATURALS);
    return mc(rng, `Sube ${b('un tono')} desde ${b(nm(x))}. ¿A qué nota llegas?`, nm(x + 2), [nm(x + 1), nm(x + 3), nm(x + 4)],
      `Un tono son dos trastes: ${es(x)} → ${es(x + 1)} → ${es(x + 2)}.${x === 4 || x === 11 ? ' Ojo: desde Mi o Si, un tono te deja en una nota con sostenido.' : ''}`);
  },

  triadas(rng) {
    const kind = rng.int(0, 9);
    const r = rng.pick(NATURALS);
    const type = rng.pick(['mayor', 'menor']);
    const flat = type === 'menor';
    const f = CHORDS[type].f;
    if (kind < 3) {
      const which = rng.pick([1, 2]);
      const label = which === 1 ? '3ª' : '5ª';
      return mc(rng, `Acorde de ${b(chordName(r, type, flat))}: ¿cuál es su ${b(label)}?`, nm(r + f[which], flat),
        [nm(r + (type === 'mayor' ? 3 : 4), flat), nm(r + 7, flat), nm(r + 5, flat), nm(r + 2, flat)],
        `${es(r, flat)} ${type} = raíz, ${type === 'mayor' ? '3ª mayor (4 trastes)' : '3ª menor (3 trastes)'} y 5ª justa (7 trastes): ${triadTxt(r, f, flat)}.`);
    }
    if (kind < 6) {
      const other = type === 'mayor' ? CHORDS.menor.f : CHORDS.mayor.f;
      return mc(rng, `¿Qué notas forman ${b(chordName(r, type, flat))}?`, triadTxt(r, f, flat),
        [triadTxt(r, other, flat), triadTxt(r, [0, 5, 7], flat), triadTxt(r, [0, 4, 8], flat)],
        `Raíz + ${type === 'mayor' ? '3ª mayor (4 trastes)' : '3ª menor (3 trastes)'} + 5ª justa (7 trastes). Cuenta desde la raíz, no memorices la forma.`);
    }
    if (kind < 8) {
      const item = rng.pick([['3ª menor', 3, [2, 4, 5]], ['3ª mayor', 4, [3, 5, 2]], ['5ª justa', 7, [5, 6, 8]]]);
      return mc(rng, `La ${b(item[0])} está a ___ semitonos (trastes) de la raíz.`, `${item[1]}`, item[2].map(String),
        'Las tres medidas que arman casi todo el rock: 3ª menor = 3, 3ª mayor = 4, 5ª justa = 7.');
    }
    return mc(rng, `${b(triadTxt(r, f, flat))}: ¿qué acorde es?`, chordName(r, type, flat),
      [chordName(r, type === 'mayor' ? 'menor' : 'mayor', flat), chordName(r, 'power', flat), chordName(r, 'sus4', flat)],
      `De ${es(r, flat)} a ${es(r + f[1], flat)} hay ${f[1]} trastes: eso es una 3ª ${type}, y la 3ª decide si el acorde es mayor o menor.`);
  },

  intervalos(rng) {
    const x = rng.pick(NATURALS);
    const set = [1, 2, 3, 4, 5, 7, 12];
    const s = rng.pick(set);
    const flat = [1, 3, 8, 10].includes(s);
    const names = set.map((i) => INTERVALS[i].n);
    return mc(rng, `De ${b(nm(x))} subiendo a ${b(nm(x + s, flat))} hay una…`, INTERVALS[s].n, rng.shuffle(names.filter((n) => n !== INTERVALS[s].n)),
      `Son ${s} trastes de distancia, y ${s} trastes = ${INTERVALS[s].n}. Un intervalo es una distancia: vale lo mismo en cualquier tonalidad.`);
  },

  grados(rng) {
    const kind = rng.int(0, 9);
    if (kind < 3) {
      return rng.pick([
        mc(rng, '«Una 3ª menor» y «el 3er grado» ¿son lo mismo?',
          'No. La 3ª es una distancia entre dos notas; el grado es un puesto dentro de una escala',
          ['Sí, son dos nombres para lo mismo', 'No. El grado se mide en trastes y la 3ª en tonos', 'Solo coinciden en tonalidades mayores'],
          'Intervalo = distancia entre dos notas cualesquiera. Grado = el número de una nota dentro de una escala concreta.'),
        mc(rng, `De ${b('Mi (E)')} a ${b('Sol (G)')} hay una 3ª menor. ¿Cambia eso según la tonalidad en que estés?`,
          'No: el intervalo es la distancia y siempre mide lo mismo',
          ['Sí: en Do mayor sería una 3ª mayor', 'Sí: depende de cuál sea la tónica', 'Solo cambia en tonalidades menores'],
          'Mi–Sol son 3 trastes aquí y en cualquier canción. Lo que cambia con la tonalidad es el grado que ocupa cada nota.'),
        mc(rng, `${b('Sol (G)')} es el 5º grado de Do mayor. ¿Qué grado es Sol en ${b('Mi menor')}?`, '3er grado',
          ['5º grado', '2º grado', '6º grado'],
          'Mi menor: Mi(1) Fa♯(2) Sol(3) La(4) Si(5) Do(6) Re(7). La misma nota cambia de puesto según la escala.'),
      ]);
    }
    const k = rng.pick(KEYS);
    const notes = scaleNotes(k);
    const list = notes.map((n, i) => `${es(n, k.flat)}(${i + 1})`).join(' ');
    const i = rng.int(1, 6);
    const ord = ['1er', '2º', '3er', '4º', '5º', '6º', '7º'];
    if (kind < 7) {
      const wrong = rng.shuffle([0, 1, 2, 3, 4, 5, 6].filter((j) => j !== i)).slice(0, 3).map((j) => `${ord[j]} grado`);
      return mc(rng, `En ${b(keyName(k))}, ¿qué grado es ${b(nm(notes[i], k.flat))}?`, `${ord[i]} grado`, wrong, `${keyName(k)}: ${list}.`);
    }
    const wrong = rng.shuffle(notes.filter((_, j) => j !== i)).slice(0, 3).map((n) => nm(n, k.flat));
    return mc(rng, `¿Cuál es el ${b(ord[i] + ' grado')} de ${b(keyName(k))}?`, nm(notes[i], k.flat), wrong, `${keyName(k)}: ${list}.`);
  },

  penta(rng) {
    const kind = rng.int(0, 9);
    if (kind < 5) {
      const r = rng.pick([4, 9, 2, 11, 7]);
      const flat = r === 2 || r === 7;
      const inside = SCALES.pentaMenor.f.map((s) => pc(r + s));
      const out = pc(r + rng.pick([2, 8]));
      return mc(rng, `Pentatónica menor de ${b(nm(r, flat))}: ¿qué nota ${b('no')} pertenece?`, nm(out, flat),
        rng.shuffle(inside.slice(1)).map((n) => nm(n, flat)),
        `${es(r, flat)} penta menor: ${inside.map((n) => es(n, flat)).join(' – ')}. Se quedan fuera el 2º y el ♭6º grado de la escala menor.`);
    }
    return rng.pick([
      mc(rng, '¿Cuál es la fórmula de la pentatónica menor?', '1 – ♭3 – 4 – 5 – ♭7',
        ['1 – 2 – 3 – 5 – 6', '1 – ♭3 – 4 – ♭5 – ♭7', '1 – 2 – ♭3 – 5 – ♭7'],
        'Raíz, 3ª menor, 4ª, 5ª y 7ª menor. La otra opción «1 – 2 – 3 – 5 – 6» es la pentatónica mayor.'),
      mc(rng, 'La pentatónica menor es la escala menor natural sin dos grados. ¿Cuáles?', '2 y ♭6',
        ['4 y ♭7', '♭3 y 5', '2 y 4'],
        'Son justo los dos grados que forman semitonos con sus vecinos. Sin ellos no hay roces: por eso la penta «nunca falla».'),
      mc(rng, 'Subiendo por la pentatónica menor desde la raíz, los saltos en trastes son…', '3 – 2 – 2 – 3 – 2',
        ['2 – 2 – 1 – 2 – 2', '3 – 2 – 1 – 1 – 3', '2 – 3 – 2 – 2 – 3'],
        '1 →(3)→ ♭3 →(2)→ 4 →(2)→ 5 →(3)→ ♭7 →(2)→ octava. Solo saltos de 2 y 3 trastes: ningún semitono.'),
    ]);
  },

  power(rng) {
    const kind = rng.int(0, 9);
    if (kind < 4) {
      const r = rng.pick(NATURALS);
      const pair = (x, y) => `${es(x)} y ${es(y)} <small class="cif">${en(x)}–${en(y)}</small>`;
      return mc(rng, `¿Qué notas forman ${b(`${es(r)}5`)} <small class="cif">${en(r)}5</small>?`, pair(r, r + 7),
        [pair(r, r + 4), pair(r, r + 5), pair(r, r + 3)],
        `Power chord = raíz + 5ª justa (7 trastes), muchas veces con la octava encima. ${es(r)} + 7 trastes = ${es(r + 7)}.`);
    }
    return rng.pick([
      mc(rng, '¿Por qué un power chord no es ni mayor ni menor?', 'Porque no tiene 3ª, la nota que decide mayor o menor',
        ['Porque se toca con distorsión', 'Porque solo usa cuerdas graves', 'Porque la 5ª es una nota neutra que anula la 3ª'],
        'Mayor o menor lo decide la 3ª. Sin 3ª el acorde queda abierto, y la voz o el bajo pueden «pintarlo» como quieran.'),
      mc(rng, '¿A cuántos trastes de la raíz está la 5ª de un power chord?', '7', ['5', '4', '6'],
        '5ª justa = 7 semitonos. En el mástil: una cuerda más aguda, dos trastes adelante.'),
      mc(rng, 'Con distorsión, ¿por qué un power chord suena más definido que una tríada completa?',
        'La 3ª genera armónicos que chocan entre sí; raíz y 5ª se refuerzan',
        ['Porque tiene menos volumen', 'Porque la distorsión elimina las notas agudas', 'Porque se toca más rápido'],
        'La distorsión multiplica armónicos. Con raíz y 5ª encajan; con la 3ª se embarra. Por eso el rock pesado vive de power chords.'),
      mc(rng, `La guitarra toca ${b('Mi5 (E5)')} y la voz canta ${b('Sol (G)')}. ¿Cómo suena el conjunto?`,
        'Menor: la voz está poniendo la 3ª menor', ['Mayor: Sol es la 3ª mayor de Mi', 'Ni mayor ni menor: es un power chord', 'Disonante: Sol no cabe sobre Mi5'],
        'Mi → Sol son 3 trastes: 3ª menor. El power chord deja el hueco y tu voz decide el color. Esto es composición pura.'),
    ]);
  },

  mastil(rng, inst = 'bajo') {
    const kind = rng.int(0, 9);
    const strings = TUNINGS[inst].strings;
    if (kind < 7) {
      const si = rng.int(0, strings.length - 1);
      const fret = rng.int(1, 12);
      const note = strings[si] + fret;
      return mc(rng, `${TUNINGS[inst].n}, cuerda ${b(nm(strings[si]))}, traste ${b(fret)}: ¿qué nota suena?`, nm(note),
        [nm(note + 1), nm(note - 1), nm(note + 2), nm(note - 2)],
        `Cuenta desde la cuerda al aire: ${Array.from({ length: Math.min(fret, 12) + 1 }, (_, i) => es(strings[si] + i)).join(' → ')}.`);
    }
    return rng.pick([
      mc(rng, 'Quieres la octava aguda de una nota que estás tocando en la cuerda Mi (E). ¿Dónde está?',
        'Dos cuerdas más aguda, dos trastes adelante', ['Una cuerda más aguda, dos trastes adelante', 'Dos cuerdas más aguda, mismo traste', 'Misma cuerda, 7 trastes adelante'],
        'La forma de octava: salta una cuerda y avanza dos trastes. «Una cuerda arriba, dos trastes» es la 5ª.'),
      mc(rng, 'El traste 5 de la cuerda Mi (E) suena igual que…', 'La cuerda La (A) al aire',
        ['La cuerda Re (D) al aire', 'El traste 7 de la cuerda La (A)', 'El traste 12 de la cuerda Mi (E)'],
        'Cada cuerda está 5 trastes (una 4ª justa) por encima de la anterior. Así se afinaba antes de los afinadores.'),
      mc(rng, 'El traste 12 de cualquier cuerda da…', 'La misma nota que al aire, una octava más aguda',
        ['Una 5ª sobre la cuerda al aire', 'La nota de la cuerda siguiente', 'Un tritono sobre la cuerda al aire'],
        '12 trastes = 12 semitonos = una octava. Después del 12 el mástil se repite.'),
    ]);
  },

  ritmo(rng) {
    return rng.pick([
      mc(rng, '¿Qué es una síncopa?', 'Acentuar un tiempo débil o un «y», dejando que ese sonido pise el tiempo fuerte que sigue',
        ['Tocar todas las notas justo en el pulso', 'Cambiar de compás a mitad de canción', 'Tocar tres notas en el espacio de dos'],
        'La síncopa mueve el acento a donde el oído no lo espera. Es lo que hace que un riff «empuje» en vez de marchar.'),
      mc(rng, 'Contando «1 y 2 y 3 y 4 y», ¿cuántas corcheas caben en un compás de 4/4?', '8', ['4', '6', '16'],
        'Cada negra se divide en dos corcheas: el número y el «y». 4 negras × 2 = 8.'),
      mc(rng, `A ${b('60 BPM')}, ¿cuánto dura una negra?`, '1 segundo', ['Medio segundo', '2 segundos', 'Un cuarto de segundo'],
        '60 pulsos por minuto = un pulso por segundo. A 120 BPM dura la mitad.'),
      mc(rng, 'Tocas en el «y» del 2 y dejas sonar la nota por encima del 3. Eso es…', 'Una síncopa',
        ['Un tresillo', 'Un compás irregular', 'Un silencio de negra'],
        'El 3 es un tiempo fuerte y lo «pisaste» con una nota que empezó antes, en un tiempo débil.'),
      mc(rng, 'En un rock en 4/4, ¿dónde suele caer la caja de la batería?', 'En el 2 y el 4', ['En el 1 y el 3', 'En los cuatro tiempos', 'Solo en el 1'],
        'Bombo en 1 y 3, caja en 2 y 4: el «backbeat». Tu bajo se amarra al bombo; eso es el pocket.'),
      mc(rng, `A ${b('120 BPM')}, ¿cuántas negras suenan en un segundo?`, '2', ['1', '4', '3'],
        '120 por minuto = 2 por segundo. Cada negra dura medio segundo.'),
    ]);
  },

  oidoIntervalo(rng) {
    const root = rng.int(48, 58);
    const set = [1, 2, 3, 4, 5, 6, 7, 12];
    const s = rng.pick(set);
    const hint = {
      1: 'la más tensa: dos trastes vecinos chocando',
      2: 'como empezar a subir una escala: Do–Re',
      3: 'el color triste; así empieza el riff de «Smoke on the Water»',
      4: 'el color alegre de un acorde mayor',
      5: 'abierta y firme, como un toque de llamada',
      6: 'inestable, ni 4ª ni 5ª: el intervalo «prohibido» que usa el metal',
      7: 'el salto del power chord: sólido y vacío',
      12: 'la misma nota, más aguda',
    };
    return mc(rng, 'Escucha las dos notas. ¿Qué intervalo es?', INTERVALS[s].n,
      rng.shuffle(set.filter((x) => x !== s)).map((x) => INTERVALS[x].n),
      `${INTERVALS[s].n} (${s} trastes): ${hint[s]}.`, { play: { seq: [root, root + s] } });
  },

  oidoAcorde(rng) {
    const root = rng.int(48, 55);
    const type = rng.pick(['mayor', 'menor', 'power']);
    const label = { mayor: 'Mayor', menor: 'Menor', power: 'Power chord (sin 3ª)' };
    const midis = type === 'power' ? [root, root + 7, root + 12] : CHORDS[type].f.map((s) => root + s);
    return {
      q: 'Escucha el acorde. ¿Qué color tiene?',
      opts: [label.mayor, label.menor, label.power],
      a: ['mayor', 'menor', 'power'].indexOf(type),
      why: type === 'power' ? 'Sin 3ª: suena abierto, ni alegre ni triste.' : `La 3ª ${type} es la que da el color ${type === 'mayor' ? 'luminoso' : 'oscuro'}. Intenta cantar esa nota del medio.`,
      play: { chord: midis },
    };
  },
};

const many = (gen, n) => (rng) => ({ questions: Array.from({ length: n }, () => gen(rng)) });
const mixed = (gens, n) => (rng) => ({ questions: Array.from({ length: n }, () => rng.pick(gens)(rng)) });

// ---------- Ayudas para ejercicios con micrófono ----------
function stringScale(rng) {
  const opts = [
    { inst: 'bajo', si: 1, fret: 3, key: { root: 0, mode: 'mayor', flat: false } },
    { inst: 'bajo', si: 0, fret: 3, key: { root: 7, mode: 'mayor', flat: false } },
    { inst: 'bajo', si: 0, fret: 0, key: { root: 4, mode: 'menor', flat: false } },
    { inst: 'bajo', si: 1, fret: 0, key: { root: 9, mode: 'menor', flat: false } },
    { inst: 'bajo', si: 2, fret: 0, key: { root: 2, mode: 'mayor', flat: false } },
  ];
  const o = rng.pick(opts);
  const f = SCALES[o.key.mode].f;
  const up = [...f, 12];
  const order = [...up, ...up.slice(0, -1).reverse()];
  const open = TUNINGS[o.inst].strings[o.si];
  return {
    mode: 'scale',
    targets: order.map((s) => ({ pc: pc(o.key.root + s), label: es(o.key.root + s, o.key.flat), cif: en(o.key.root + s, o.key.flat), sub: `tr. ${o.fret + s}` })),
    how: `Escala de ${b(keyName(o.key))} en ${b('una sola cuerda')}: cuerda ${nm(open)} desde el traste ${o.fret}. Sube y baja, lento y parejo. La app avanza cuando oye cada nota afinada.`,
  };
}

function arpeggios(rng) {
  const k = rng.pick(KEYS.filter((x) => x.mode === 'menor').concat(KEYS.filter((x) => x.root === 0 || x.root === 7)));
  const notes = scaleNotes(k);
  const degs = k.mode === 'menor' ? [0, 2, 5, 6, 3] : [0, 3, 4, 5, 1];
  const chosen = [0, ...rng.shuffle(degs.slice(1)).slice(0, 3)];
  const targets = [];
  const names = [];
  for (const d of chosen) {
    const r = notes[d];
    const third = notes[(d + 2) % 7];
    const fifth = notes[(d + 4) % 7];
    const minor = pc(third - r) === 3;
    names.push(`${es(r, k.flat)}${minor ? 'm' : ''}`);
    [[r, 'raíz'], [third, minor ? '3ª menor' : '3ª mayor'], [fifth, '5ª'], [r, 'raíz']].forEach(([n, sub]) => {
      targets.push({ pc: n, label: es(n, k.flat), cif: en(n, k.flat), sub });
    });
  }
  return {
    mode: 'scale',
    targets,
    how: `Arpegia cada acorde nota por nota: ${b('raíz → 3ª → 5ª → raíz')}. Progresión en ${keyName(k)}: ${b(names.join(' → '))}. Antes de tocar cada nota, di su función en voz alta («raíz», «tercera», «quinta»).`,
  };
}

function findNotes(inst) {
  return (rng) => {
    const pool = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).slice(0, 8);
    return {
      mode: 'find',
      targets: pool.map((p) => ({ pc: p, label: es(p), cif: en(p), sub: '' })),
      how: `Aparece una nota: ${b('encuéntrala y tócala')} en el ${inst}, en cualquier cuerda y octava. Son 8 notas contra el reloj. No cuentes desde la cuerda al aire si puedes evitarlo: usa octavas y notas que ya conoces como anclas.`,
    };
  };
}

function singScale(rng) {
  const tonic = store.data.settings.tonic;
  const mode = rng.pick(['mayor', 'menor']);
  const f = SCALES[mode].f;
  const path = [0, 1, 2, 3, 4, 3, 2, 1, 0];
  const flat = mode === 'menor';
  return {
    mode: 'scale',
    voice: true,
    refs: path.map((i) => tonic + f[i]),
    targets: path.map((i) => ({ pc: pc(tonic + f[i]), label: `${i + 1}`, cif: en(tonic + f[i], flat), sub: es(tonic + f[i], flat) })),
    how: `Canta los grados ${b('1 – 2 – 3 – 4 – 5 – 4 – 3 – 2 – 1')} de ${b(nm(tonic, flat) + ' ' + mode)}, diciendo el número de cada grado. Escucha primero la referencia. La app avanza cuando afinas cada grado.`,
  };
}

const TAP_PATTERNS = [
  { name: 'Síncopa en el «y» del 2', p: [1, 0, 1, 1, 0, 0, 1, 0] },
  { name: 'Todo al «y» después del 1', p: [1, 0, 0, 1, 0, 1, 0, 1] },
  { name: 'Empujando el 3', p: [1, 0, 1, 0, 0, 1, 1, 0] },
  { name: 'Anticipando el 1', p: [1, 0, 0, 1, 0, 0, 1, 1] },
  { name: 'Tres contra el pulso', p: [1, 0, 0, 1, 0, 0, 1, 0] },
];

const CHORD_PAIRS = [
  ['Mi menor (Em)', 'Sol (G)'], ['La menor (Am)', 'Do (C)'], ['Mi menor (Em)', 'Do (C)'], ['Re (D)', 'Sol (G)'],
  ['La menor (Am)', 'Mi menor (Em)'], ['Mi5 (E5)', 'Sol5 (G5)'], ['La5 (A5)', 'Do5 (C5)'], ['Re menor (Dm)', 'La menor (Am)'],
];

function createPrompt(rng) {
  const k = rng.pick(KEYS);
  const kn = keyName(k);
  const notes = scaleNotes(k);
  const minor = k.mode === 'menor';
  const ch = (d) => {
    const r = notes[d];
    const m = pc(notes[(d + 2) % 7] - r) === 3;
    return `${es(r, k.flat)}${m ? 'm' : ''} <small class="cif">${en(r, k.flat)}${m ? 'm' : ''}</small>`;
  };
  const second = minor ? rng.pick([5, 6, 2]) : rng.pick([3, 4, 5]);
  const bpm = rng.pick([72, 80, 88, 96, 104]);
  const flat2 = nm(k.root + 1, true);
  const list = [
    { inst: 'bajo', text: `Riff de bajo de ${b('2 compases')} en ${b(kn)} usando solo los grados ${b(minor ? '1, ♭3, 4 y 5' : '1, 3, 5 y 6')}. Grábalo dos vueltas seguidas.`, tip: 'Menos notas, más ritmo. Decide dónde van los silencios antes de tocar.' },
    { inst: 'bajo', text: `Línea de bajo sobre ${b(ch(0))} → ${b(ch(second))}, dos compases cada acorde. Empieza cada acorde en su raíz y llega al siguiente con ${b('una nota de paso')}.`, tip: 'La nota de paso suele estar a un traste o dos de la raíz a la que vas.' },
    { inst: 'voz', text: `Tararea una melodía de ${b('4 compases')} sobre ${b(ch(0))} → ${b(ch(second))}. Sin letra. Empieza en la ${b('3ª o la 5ª')} del primer acorde, no en la raíz.`, tip: 'Toca primero la raíz en el bajo para ubicarte y canta encima. Esto apunta directo al entregable de la Fase 1.' },
    { inst: 'bajo', text: `Riff con ${b('síncopa')} en ${b(kn)}: acentúa el «y» del 2 y deja esa nota sonando por encima del 3.`, tip: 'Cuenta en voz alta «1 y 2 Y (3) y 4 y». Si te pierdes, toca solo la raíz.' },
    { inst: 'guitarra', text: `${b('Disonancia controlada')}: arma un riff en ${b(es(k.root, k.flat) + ' menor')} que pase por la ${b('♭2')} (${flat2}) camino a la raíz.`, tip: 'La ♭2 está a un traste de la raíz. Úsala corta y resuelve: tensión, y luego casa.' },
    { inst: 'bajo', text: `${b('Una sola nota')}: haz interesantes 2 compases usando solo ${b(nm(k.root, k.flat))}. Valen silencios, acentos y saltos de octava.`, tip: 'Si con una nota suena a música, con cinco suena a canción.' },
    { inst: 'voz', text: `Escribe ${b('una línea de letra')} con una imagen concreta (algo que se pueda ver o tocar) y cántala sobre una sola nota grave y cómoda.`, tip: 'Primero dila hablando y marca con palmas dónde caen los acentos. Después ponle la nota.' },
    { inst: 'guitarra', text: `Progresión de ${b('4 power chords')} en ${b(es(k.root, k.flat) + '5')}: tres de la tonalidad y ${b('uno que no pertenezca')}. Decide de antemano cuál es el «raro».`, tip: 'Prueba el acorde un traste arriba de la raíz (♭II) o tres trastes arriba de la 5ª (♭VII).' },
    { inst: 'bajo', text: `${b('Pregunta y respuesta')}: un compás de riff en ${b(kn)} que «pregunte» (termina fuera de la raíz) y otro que «responda» (termina en la raíz).`, tip: 'Terminar en la 5ª o la ♭7 deja la frase abierta.' },
    { inst: 'voz', text: `Bajo + voz: toca la raíz de ${b(ch(0))} en negras y ${b('tararea encima')} tres notas distintas. ¿Cuál de las tres te gusta más contra el bajo?`, tip: 'Después identifica qué grado era la que elegiste. Así se entrena bajar la idea al instrumento.' },
  ];
  const pr = rng.pick(list);
  return { prompt: pr.text, tip: pr.tip, bpm, inst: pr.inst };
}

// ---------- Banco ----------
const TOPIC = {
  semitonos: 'Tonos y semitonos', triadas: 'Acordes raíz–3ª–5ª', intervalos: 'Intervalos', grados: 'Grados de la escala',
  penta: 'Pentatónica', power: 'Power chord', mastil: 'Mapa del mástil', ritmo: 'Ritmo y síncopa', oido: 'Oído',
  pulso: 'Pulso', voz: 'Afinación de voz', crear: 'Creación', mix: 'Repaso mezclado',
};
export const topicName = (t) => TOPIC[t] || t;
export const CAT = { oido: 'Oído y teoría', tecnica: 'Técnica', creacion: 'Creación' };

export const EX = {
  // --- Bloque 1: oído / teoría aplicada ---
  q_semitonos: { cat: 'oido', inst: 'cabeza', topic: 'semitonos', widget: 'quiz', mins: 3, title: 'Tonos y semitonos', card: 'semitonos',
    how: 'Cinco preguntas rápidas. Piensa en trastes: un semitono es un traste, un tono son dos.',
    why: 'Era uno de tus vacíos del diagnóstico. Todo lo demás (acordes, escalas, intervalos) se mide con esta regla.', make: many(Q.semitonos, 5) },
  q_triadas: { cat: 'oido', inst: 'cabeza', topic: 'triadas', widget: 'quiz', mins: 3, title: 'Acordes desde la raíz', card: 'triadas',
    how: 'Cinco preguntas. Construye cada acorde contando trastes desde la raíz: 3ª menor = 3, 3ª mayor = 4, 5ª = 7.',
    why: 'Hoy conoces los acordes como formas en la guitarra. Si los entiendes como raíz–3ª–5ª puedes llevarlos al bajo y a la voz.', make: many(Q.triadas, 5) },
  q_intervalos: { cat: 'oido', inst: 'cabeza', topic: 'intervalos', widget: 'quiz', mins: 3, title: 'Nombrar intervalos', card: 'intervalos',
    how: 'Cinco preguntas. Cuenta los trastes entre las dos notas y ponle nombre a esa distancia.',
    why: 'Tu oído ya reconoce relaciones entre notas. Ponerles nombre es lo que permite repetirlas y comunicarlas a la banda.', make: many(Q.intervalos, 5) },
  q_grados: { cat: 'oido', inst: 'cabeza', topic: 'grados', widget: 'quiz', mins: 3, title: 'Intervalo vs. grado', card: 'grados',
    how: 'Cinco preguntas sobre el puesto que ocupa cada nota dentro de una tonalidad.',
    why: 'Confundir intervalo con grado era otro vacío del diagnóstico. El grado te dice qué papel juega la nota en la canción.', make: many(Q.grados, 5) },
  q_penta: { cat: 'oido', inst: 'cabeza', topic: 'penta', widget: 'quiz', mins: 3, title: 'Pentatónica por dentro', card: 'penta',
    how: 'Cinco preguntas sobre las cinco notas de la pentatónica y los intervalos entre ellas.',
    why: 'Usas la pentatónica de memoria. Saber qué grados tiene te deja salirte de ella a propósito, que es donde vive lo alternativo.', make: many(Q.penta, 5) },
  q_power: { cat: 'oido', inst: 'cabeza', topic: 'power', widget: 'quiz', mins: 3, title: 'El porqué del power chord', card: 'power',
    how: 'Cinco preguntas sobre raíz, 5ª y la 3ª que falta.',
    why: 'El power chord deja un hueco donde iría la 3ª. Ese hueco es espacio para tu voz grave.', make: many(Q.power, 5) },
  q_mastil: { cat: 'oido', inst: 'bajo', topic: 'mastil', widget: 'quiz', mins: 3, title: 'Notas del mástil (bajo)', card: 'mastil',
    how: 'Cinco preguntas. Si tienes el bajo a mano, compruébalas tocando.',
    why: 'Meta de la Fase 1: saber qué nota hay bajo cada dedo sin pensar.', make: many((r) => Q.mastil(r, 'bajo'), 5) },
  q_ritmo: { cat: 'oido', inst: 'cabeza', topic: 'ritmo', widget: 'quiz', mins: 3, title: 'Ritmo en palabras', card: 'sincopa',
    how: 'Cinco preguntas sobre pulso, subdivisión y síncopa.',
    why: 'La síncopa era nueva para ti en el diagnóstico, y es la base rítmica del rock alternativo.', make: many(Q.ritmo, 5) },
  q_mix: { cat: 'oido', inst: 'cabeza', topic: 'mix', widget: 'quiz', mins: 3, title: 'Repaso mezclado', card: 'triadas',
    how: 'Seis preguntas de temas distintos, sin aviso. Así se comprueba qué quedó de verdad.',
    why: 'Mezclar temas cuesta más que repetir uno solo, y por eso fija mejor.',
    make: mixed([Q.semitonos, Q.triadas, Q.intervalos, Q.grados, Q.penta, Q.power, Q.ritmo, (r) => Q.mastil(r, 'bajo')], 6) },
  o_intervalos: { cat: 'oido', inst: 'oído', topic: 'oido', widget: 'quiz', mins: 3, title: 'Intervalos de oído', card: 'intervalos',
    how: 'Escucha dos notas y nombra la distancia. Puedes repetir el audio las veces que quieras. Tararearlas ayuda.',
    why: 'Es el puente directo entre la idea que oyes en la cabeza y el traste donde está.', make: many(Q.oidoIntervalo, 6) },
  o_acordes: { cat: 'oido', inst: 'oído', topic: 'oido', widget: 'quiz', mins: 3, title: 'Mayor, menor o power', card: 'power',
    how: 'Escucha el acorde y decide su color. Busca la nota del medio: esa es la 3ª.',
    why: 'Ya sientes «menor = triste». Ahora se trata de ubicar cuál nota produce esa sensación.', make: many(Q.oidoAcorde, 6) },
  o_canta_grado: { cat: 'oido', inst: 'voz', topic: 'voz', widget: 'sing', mins: 3, title: 'Canta el grado', card: 'grados', mic: true,
    how: 'Oyes la tónica (el grado 1). Te pido un grado y lo cantas. El medidor te muestra qué tan cerca estás.',
    why: 'Cantar grados como números es la meta de oído de la Fase 1, y entrena la afinación de tu voz grave.',
    make: (rng) => {
      const tonic = store.data.settings.tonic;
      return { rounds: Array.from({ length: 4 }, () => {
        const mode = rng.pick(['mayor', 'menor']);
        const deg = rng.pick([1, 2, 2, 3, 4, 4]);
        return { tonic, mode, deg, target: tonic + SCALES[mode].f[deg] };
      }) };
    } },
  o_sincopa: { cat: 'oido', inst: 'manos', topic: 'ritmo', widget: 'tap', mins: 3, title: 'Síncopa con los dedos', card: 'sincopa',
    how: 'Mira el patrón, escúchalo, y luego tócalo en la pantalla sobre el clic durante 4 compases. Cuenta «1 y 2 y 3 y 4 y» en voz alta.',
    why: 'Antes de llevar una síncopa al bajo hay que sentirla en el cuerpo. Aquí no hay notas que distraigan.',
    make: (rng) => { const pt = rng.pick(TAP_PATTERNS); return { bpm: rng.pick([66, 72, 80]), pattern: pt.p, name: pt.name, bars: 4 }; } },
  o_palmas: { cat: 'oido', inst: 'manos', topic: 'pulso', widget: 'pulse', mins: 3, title: 'Palmas con clic que desaparece', card: 'pulso', mic: true,
    how: 'Da palmas en cada pulso. El clic suena dos compases y se calla dos: sigue igual en el silencio. Al volver sabrás si corriste o te frenaste.',
    why: 'El tempo tiene que vivir dentro de ti, no en el metrónomo. Este es el mejor ejercicio que existe para eso.',
    make: (rng) => ({ bpm: rng.pick([72, 80, 88]), sub: 1, bars: 8, mute: [2, 2], what: 'palmas' }) },

  // --- Bloque 2: técnica ---
  t_pulso_negras: { cat: 'tecnica', inst: 'bajo', topic: 'pulso', widget: 'pulse', mins: 4, title: 'Una nota, en negras', card: 'pulso', mic: true,
    how: 'Una sola nota (Mi o La al aire sirve) en negras, exactamente con el clic. Con uñeta, todos los ataques hacia abajo. Deja el teléfono cerca del ampli.',
    why: 'Me pediste saber si tu bajo va a tiempo. Aquí lo medimos en milisegundos, nota por nota.',
    make: (rng) => ({ bpm: rng.pick([60, 66, 72, 80, 88, 96]), sub: 1, bars: 8, what: 'notas' }) },
  t_pulso_corcheas: { cat: 'tecnica', inst: 'bajo', topic: 'pulso', widget: 'pulse', mins: 4, title: 'Corcheas parejas', card: 'pulso', mic: true,
    how: 'Una sola nota en corcheas: dos por cada clic («1 y 2 y…»). Uñeta alternada abajo–arriba. Que el «y» suene igual de fuerte que el número.',
    why: 'Las corcheas con púa son el motor del rock alternativo. Si el «y» llega tarde o débil, el groove cojea.',
    make: (rng) => ({ bpm: rng.pick([60, 66, 72, 80]), sub: 2, bars: 6, what: 'notas' }) },
  t_pulso_mudo: { cat: 'tecnica', inst: 'bajo', topic: 'pulso', widget: 'pulse', mins: 4, title: 'Sostener el tempo sin clic', card: 'pulso', mic: true,
    how: 'Negras en una sola nota. El clic suena dos compases y desaparece dos. No aceleres en el silencio.',
    why: 'En el ensayo no hay metrónomo: el bajo es el metrónomo. Esto entrena justo eso.',
    make: (rng) => ({ bpm: rng.pick([66, 72, 80, 88]), sub: 1, bars: 8, mute: [2, 2], what: 'notas' }) },
  t_escala_cuerda: { cat: 'tecnica', inst: 'bajo', topic: 'mastil', widget: 'follow', mins: 4, title: 'Escala en una sola cuerda', card: 'semitonos', mic: true,
    how: '', why: 'En una sola cuerda ves los tonos y semitonos como distancias reales: dos trastes, dos trastes, uno… Es el mapa de semitonos hecho mano.',
    make: stringScale },
  t_arpegios: { cat: 'tecnica', inst: 'bajo', topic: 'triadas', widget: 'follow', mins: 4, title: 'Raíz, 3ª y 5ª en el bajo', card: 'triadas', mic: true,
    how: '', why: 'Esta es la «capa de nomenclatura» que teníamos pendiente para la Sesión 2: los acordes como raíz–3ª–5ª bajo tus dedos, no como formas de guitarra.',
    make: arpeggios },
  t_encuentra_bajo: { cat: 'tecnica', inst: 'bajo', topic: 'mastil', widget: 'follow', mins: 4, title: 'Encuentra la nota (bajo)', card: 'mastil', mic: true,
    how: '', why: 'Cuanto menos tardes en encontrar una nota, más corta es la distancia entre la idea y el instrumento. Esa es la meta central del curso.',
    make: findNotes('bajo') },
  t_encuentra_guitarra: { cat: 'tecnica', inst: 'guitarra', topic: 'mastil', widget: 'follow', mins: 4, title: 'Encuentra la nota (guitarra)', card: 'mastil', mic: true,
    how: '', why: 'Las cuatro cuerdas graves de la guitarra son las mismas del bajo, una octava arriba. Lo que aprendas aquí vale para los dos.',
    make: findNotes('la guitarra') },
  t_cambio_acordes: { cat: 'tecnica', inst: 'guitarra', topic: 'pulso', widget: 'guided', mins: 4, title: 'Cambio de acordes a tiempo', card: 'triadas',
    how: '', why: 'El cambio tiene que llegar al pulso aunque quede sucio. Limpio y tarde no sirve en una banda; a tiempo y sucio se arregla.',
    make: (rng) => {
      const [x, y] = rng.pick(CHORD_PAIRS);
      const bpm = rng.pick([60, 66, 72]);
      return { bpm, secs: 150, how: `Alterna ${b(x)} ↔ ${b(y)} con el clic a ${bpm} BPM.`,
        steps: [`Un rasgueo por acorde, cambiando cada ${b('4 pulsos')}. Ocho cambios.`, `Ahora cambiando cada ${b('2 pulsos')}. Ocho cambios.`,
          'Mueve la mano izquierda durante el último pulso, no después. Si no alcanzas, suelta el acorde antes.', 'En el último minuto nombra en voz alta la raíz de cada acorde al caer.'],
        ask: '¿Qué tan a tiempo llegaron los cambios?' };
    } },
  t_nota_larga: { cat: 'tecnica', inst: 'voz', topic: 'voz', widget: 'sustain', mins: 4, title: 'Nota larga y estable', card: 'voz', mic: true,
    how: 'Escucha la nota de referencia y sosténla 5 segundos con «aaa» o «mmm», a volumen medio. Tres notas. El gráfico muestra si te vas hacia arriba o hacia abajo.',
    why: 'Pediste revisar la afinación de tu voz grave. Sin micrófono en casa, el teléfono hace de oído externo.',
    make: (rng) => {
      const tonic = store.data.settings.tonic;
      const offs = rng.shuffle([-3, -2, 0, 2, 3, 5]).slice(0, 3).sort((x, y) => x - y);
      return { notes: offs.map((o) => tonic + o), secs: 5 };
    } },
  t_canta_escala: { cat: 'tecnica', inst: 'voz', topic: 'voz', widget: 'follow', mins: 4, title: 'Cinco grados cantados', card: 'grados', mic: true,
    how: '', why: 'Subir y bajar cinco grados nombrándolos une tres cosas a la vez: afinación, oído y nomenclatura.', make: singScale },
  t_respira: { cat: 'tecnica', inst: 'voz', topic: 'voz', widget: 'guided', mins: 4, title: 'Aire para la voz grave', card: 'voz',
    how: '', why: 'Las notas graves se caen de afinación cuando falta apoyo de aire. Esto se entrena sin cantar una sola nota.',
    make: () => ({ secs: 180, how: 'De pie, hombros sueltos, una mano en el abdomen.',
      steps: [`${b('Inhala 4 tiempos')} por la nariz: se mueve el abdomen, no los hombros.`, `${b('Suelta el aire en «sss» durante 8 tiempos')}, parejo, como una llanta pinchada. Cinco veces.`,
        `Lo mismo con ${b('«zzz»')} (con voz) durante 8 tiempos. Cinco veces.`, `Termina con tres ${b('sirenas')} lentas: de tu nota más grave cómoda a una media, y de vuelta, en «mmm».`],
      ask: '¿Qué tan parejo salió el aire?' }) },

  // --- Bloque 3: creación ---
  c_idea: { cat: 'creacion', inst: 'libre', topic: 'crear', widget: 'create', mins: 3, title: 'Idea del día', card: 'curso', mic: true,
    how: 'Tres minutos. Canta o tararea la idea antes de tocarla, y luego búscala en el instrumento. Graba una toma aunque no quede perfecta.',
    why: 'La brecha entre tener la idea y bajarla al instrumento solo se cierra cruzándola todos los días, en pequeño.', make: createPrompt },
};

const TECH_ROTATION = ['bajo', 'voz', 'bajo', 'guitarra', 'bajo', 'voz', 'bajo'];

/** Elige un ejercicio de una categoría. exclude = ids que no se deben repetir. */
export function pickExercise(cat, seedStr, exclude = [], dayNum = 0) {
  const rng = rngFrom(hashStr(seedStr));
  let pool = Object.keys(EX).filter((id) => EX[id].cat === cat && !exclude.includes(id));
  if (cat === 'tecnica') {
    const inst = TECH_ROTATION[((dayNum % 7) + 7) % 7];
    const byInst = pool.filter((id) => EX[id].inst === inst);
    if (byInst.length) pool = byInst;
  }
  if (!pool.length) pool = Object.keys(EX).filter((id) => EX[id].cat === cat);
  const id = rng.pick(pool);
  return { id, seed: hashStr(seedStr + '|' + id) };
}

/** Reconstruye los parámetros de un ejercicio a partir de su semilla. */
export function buildExercise(id, seed) {
  const def = EX[id];
  const params = def.make(rngFrom(seed));
  return { def, params };
}

/** Set de 10 minutos: oído/teoría + técnica + creación. */
export function makeSet(seedStr, dayNum, avoid = []) {
  return ['oido', 'tecnica', 'creacion'].map((cat) => {
    const pick = pickExercise(cat, `${seedStr}|${cat}`, avoid, dayNum);
    return { ...pick, cat, done: false, result: null, reroll: 0 };
  });
}
