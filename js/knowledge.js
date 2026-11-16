// Fichas de conocimiento del curso, con piezas interactivas.
import { nm, es, en, pc, INTERVALS, SCALES, CHORDS, KEYS, keyName, TUNINGS } from './music.js';
import { ensureAudio, playSeq, playChord, tone, stopTones, Metronome } from './audio.js';
import { store } from './store.js';

export const PHASES = [
  { n: 0, name: 'Diagnóstico', state: 'hecha', goal: 'Ver dónde estás en cada instrumento y en oído.', items: [] },
  { n: 1, name: 'Fundamentos aplicados', state: 'en curso', goal: 'Entregable: un groove de bajo + voz tarareada sobre 2 acordes.',
    items: [
      ['f1-ritmo', 'Ritmo y tempo: tocar con clic, subdivisiones, mantener el groove'],
      ['f1-mastil', 'Mapa del mástil: notas en bajo y guitarra sin pensar; octavas'],
      ['f1-oido', 'Oído: reconocer y cantar grados de la escala como números'],
      ['f1-voz', 'Voz: respiración y afinación contra una nota de referencia'],
      ['f1-nombres', 'Nomenclatura: semitonos, intervalo vs. grado, acordes raíz–3ª–5ª'],
      ['f1-entregable', 'Entregable grabado: groove de bajo + voz sobre 2 acordes'],
    ] },
  { n: 2, name: 'Armonía aplicada al rock alternativo', state: 'después', goal: 'Entregable: una progresión propia con al menos un acorde «raro» justificado.',
    items: [
      ['f2-triadas', 'Tríadas y power chords; vivir entre mayor y menor'],
      ['f2-romper', 'Progresiones diatónicas y cómo romperlas (acordes prestados)'],
      ['f2-disonancia', 'Disonancia controlada: segundas, tensiones'],
      ['f2-modos', 'Modos útiles: dórico, frigio, lidio aplicados a riffs'],
    ] },
  { n: 3, name: 'Composición y letra', state: 'después', goal: 'Entregable: boceto de canción de 16–32 compases con letra de un verso.',
    items: [
      ['f3-riffs', 'Riffs y bases que dejan espacio a la voz'],
      ['f3-pocket', 'Relación bajo–batería: el pocket'],
      ['f3-letra', 'Letras: imágenes concretas, ritmo de las palabras, melodía'],
      ['f3-forma', 'Estructura de canción y cómo el alternativo la deforma'],
    ] },
  { n: 4, name: 'Arreglos, solos y experimentación', state: 'después', goal: 'Entregable: una idea desarrollada en versión demo.',
    items: [
      ['f4-solos', 'Solos y líneas melódicas: frase, tensión, silencio'],
      ['f4-compases', 'Compases irregulares (5/4, 7/8) y texturas'],
      ['f4-capas', 'Capas, dinámica y arreglo de banda completa'],
    ] },
];

export const PENDING = [
  ['p-sesion2', 'Sesión 2: «capa de nomenclatura» en el bajo (acordes raíz–3ª–5ª y mapa de semitonos)'],
  ['p-audio', 'Análisis de audio de los dos temas de la banda con Claude (afinación de voz y timing del bajo)'],
  ['p-refs', 'Decirle a Claude tus bandas o canciones de referencia'],
  ['p-afinacion', 'Confirmar la afinación del bajo y la guitarra (la app asume estándar)'],
  ['p-letras', 'Aclarar quién compone las letras en la banda'],
];

export const CARDS = [
  { id: 'curso', group: 'Tu curso', title: 'Cómo funciona el curso', lead: 'La teoría llega después de tocar, no antes.',
    body: `<p><b>Meta central:</b> cerrar la brecha entre tener la idea y bajarla a los instrumentos. Estilo objetivo: rock alternativo con toques progresivos y experimentales, y uso de disonancia.</p>
      <p>El curso no tiene final fijo. Avanza por fases y las tres áreas (voz, bajo, guitarra) se trabajan juntas. Las semanas son orientativas: avanzas según lo que muestren tus grabaciones.</p>
      <h3>Cada sesión larga (2 por semana, unos 30 min)</h3>
      <ol><li><b>Oído y teoría aplicada:</b> algo que entiendas tocándolo.</li><li><b>Técnica</b> del instrumento del día: rotan bajo, guitarra y voz.</li><li><b>Creación:</b> algo grabable, sea un riff, una línea o una frase de letra.</li></ol>
      <h3>Esta app (10 min diarios)</h3>
      <p>Es la versión de bolsillo de lo mismo: un bloque de cada tipo, elegido al azar según la fase. Mantiene el contacto diario entre sesiones largas.</p>
      <h3>Feedback</h3>
      <p>Al final de cada semana, la revisión del sábado junta tus números y tus tomas. Copia el resumen y pégalo en tu conversación con Claude: sin grabación o nota no hay evaluación de verdad.</p>
      <p class="quote">Tu modo creativo es una ventaja, no un problema. Estudiamos para nombrar y repetir lo que ya intuyes.</p>` },
  { id: 'diagnostico', group: 'Tu curso', title: 'Tu diagnóstico', lead: 'Intermedio-intuitivo: el oído va por delante de los nombres.',
    body: `<p>En el test inicial tu oído y tus conceptos (menor = triste, resolución, función de los acordes) quedaron por encima de tu capacidad de nombrar y construir desde cero. Sacas la raíz y las relaciones de oído, pero no nombras la escala completa.</p>
      <h3>Lo que ya sabes</h3>
      <ul><li>Escala de Do mayor.</li><li>La es la tónica de La menor.</li><li>Las notas de Mi menor, vía la forma de guitarra.</li><li>El compás de 4/4.</li><li>Que la resolución depende del modo.</li></ul>
      <h3>Lo que trabajamos en la Fase 1</h3>
      <ul><li>Mapa de tonos y semitonos (Mi–Fa y Si–Do).</li><li>Distinguir intervalo de grado.</li><li>Construir acordes como raíz–3ª–5ª en vez de formas memorizadas.</li><li>Los intervalos de la pentatónica.</li><li>El porqué del power chord.</li><li>La síncopa.</li></ul>
      <h3>Lo que más quieres medir</h3>
      <ul><li>Si tu voz grave afina.</li><li>Si tu bajo va a tiempo y mantiene el pulso.</li></ul>
      <h3>Tus notas privadas</h3>
      <p>Anota aquí lo que quieras tener a mano: los temas de la banda, tu equipo, acuerdos con el grupo. Se guarda solo en este teléfono.</p>`,
    widget: 'notes' },
  { id: 'semitonos', group: 'Fase 1 · Fundamentos', title: 'Tonos y semitonos', lead: 'Un semitono es un traste. Un tono, dos.', topic: 'semitonos', widget: 'strip',
    body: `<p>Hay doce notas y entre cada una y la siguiente hay un <b>semitono</b>: un traste. Dos trastes son un <b>tono</b>.</p>
      <p>Entre casi todas las notas naturales hay un tono, con una nota en medio. Las dos excepciones son <b>Mi–Fa</b> y <b>Si–Do</b>: están pegadas, sin nada en medio.</p>
      <p>De ahí sale la escala mayor: tono, tono, <b>semitono</b>, tono, tono, tono, <b>semitono</b>. En Do mayor los semitonos caen justo en Mi–Fa y Si–Do, por eso no lleva sostenidos.</p>`,
    after: '<p class="hint">Toca dos notas seguidas y te digo qué distancia hay entre ellas.</p>' },
  { id: 'intervalos', group: 'Fase 1 · Fundamentos', title: 'Intervalos', lead: 'El nombre de una distancia entre dos notas.', topic: 'intervalos', widget: 'intervals',
    body: `<p>Un intervalo es la <b>distancia</b> entre dos notas, medida en trastes. Mide lo mismo en cualquier tonalidad: de Mi a Sol siempre hay una 3ª menor.</p>
      <p>Para el rock, apréndete primero cuatro: <b>3ª menor = 3</b>, <b>3ª mayor = 4</b>, <b>5ª justa = 7</b> y <b>octava = 12</b>. Con esos construyes cualquier acorde básico.</p>`,
    after: '<p class="hint">Las más tensas (2ª menor, tritono, 7ª mayor) son tu materia prima para la disonancia de la Fase 2.</p>' },
  { id: 'grados', group: 'Fase 1 · Fundamentos', title: 'Grados de la escala', lead: 'El puesto de cada nota dentro de una tonalidad.', topic: 'grados', widget: 'degrees',
    body: `<p>Un <b>grado</b> es el número que ocupa una nota dentro de una escala concreta: la tónica es el 1, la siguiente el 2, y así hasta el 7.</p>
      <p><b>Intervalo no es lo mismo que grado.</b> El intervalo es una distancia entre dos notas cualesquiera. El grado es un puesto, y depende de la tonalidad: Sol es el 5º grado en Do mayor y el 3º en Mi menor.</p>
      <p>Pensar en números es lo que te deja llevar una idea a cualquier tono: «1, ♭3, 4» suena igual de reconocible en Mi que en La.</p>`,
    after: '<p class="hint">El 1 es casa. El 5 pide volver a casa. El 3 decide si la casa es alegre o triste.</p>' },
  { id: 'triadas', group: 'Fase 1 · Fundamentos', title: 'Acordes: raíz, 3ª y 5ª', lead: 'Construir el acorde en vez de recordar la forma.', topic: 'triadas', widget: 'chord',
    body: `<p>Un acorde básico (tríada) son tres notas apiladas desde la raíz:</p>
      <ul><li><b>Mayor:</b> raíz + 3ª mayor (4 trastes) + 5ª justa (7 trastes).</li><li><b>Menor:</b> raíz + 3ª menor (3 trastes) + 5ª justa (7 trastes).</li></ul>
      <p>La única diferencia entre mayor y menor es <b>un traste en la 3ª</b>. La raíz y la 5ª son las mismas.</p>
      <p>En el bajo esto es oro: sobre cualquier acorde tienes tres notas seguras (raíz, 3ª, 5ª) y sabes qué hace cada una. La raíz afirma, la 5ª refuerza, la 3ª da el color.</p>` },
  { id: 'power', group: 'Fase 1 · Fundamentos', title: 'El power chord', lead: 'Raíz y 5ª. Sin 3ª, sin color fijo.', topic: 'power', widget: 'power',
    body: `<p>El power chord (Mi5, La5…) es <b>raíz + 5ª</b>, casi siempre con la octava encima. No tiene 3ª, así que no es mayor ni menor.</p>
      <p><b>Por qué funciona con distorsión:</b> la distorsión multiplica los armónicos de cada nota. Los de la raíz y la 5ª encajan entre sí; los de la 3ª chocan y embarran el sonido.</p>
      <p><b>Por qué te importa como cantante:</b> el hueco de la 3ª queda libre. Si sobre Mi5 cantas Sol, el conjunto suena menor; si cantas Sol♯, suena mayor. La voz o el bajo deciden el color.</p>`,
    after: '<p class="hint">Compara los tres. La raíz y la 5ª no cambian: solo aparece, o no, la nota del medio.</p>' },
  { id: 'penta', group: 'Fase 1 · Fundamentos', title: 'La pentatónica', lead: 'Cinco notas sin ningún semitono entre ellas.', topic: 'penta', widget: 'penta',
    body: `<p><b>Pentatónica menor:</b> 1 – ♭3 – 4 – 5 – ♭7. Es la escala menor natural sin el 2º y el ♭6º grado, que son justo los que forman semitonos. Sin semitonos no hay roces: por eso «nunca suena mal».</p>
      <p>Subiendo desde la raíz, los saltos son de <b>3 – 2 – 2 – 3 – 2</b> trastes.</p>
      <p><b>Pentatónica mayor:</b> 1 – 2 – 3 – 5 – 6. Son las mismas cinco notas que la menor de su relativa: La menor penta = Do mayor penta.</p>
      <p>Lo alternativo empieza cuando agregas a propósito las notas que la penta evita: la 2, la ♭6, o la ♭5 de paso.</p>` },
  { id: 'mastil', group: 'Fase 1 · Fundamentos', title: 'Mapa del mástil', lead: 'Saber qué nota hay bajo cada dedo.', topic: 'mastil', widget: 'fret',
    body: `<p>Tres reglas que ordenan todo el mástil (en afinación estándar):</p>
      <ul><li><b>Cada cuerda está 5 trastes sobre la anterior.</b> El traste 5 de la cuerda Mi es La, igual que la cuerda siguiente al aire.</li><li><b>Octava:</b> dos cuerdas más aguda, dos trastes adelante.</li><li><b>Traste 12 = cuerda al aire</b>, una octava arriba. Después se repite todo.</li></ul>
      <p>Apréndete primero las notas naturales de las dos cuerdas graves (Mi y La). Con la forma de octava, esas te dan todas las demás. Las cuatro cuerdas graves de la guitarra son las mismas del bajo, una octava arriba.</p>`,
    after: '<p class="hint">Elige «Una nota» para ver todos los lugares donde vive. Fíjate en la forma de octava que se repite.</p>' },
  { id: 'pulso', group: 'Fase 1 · Fundamentos', title: 'Pulso, subdivisión y pocket', lead: 'El bajo es el metrónomo de la banda.', topic: 'pulso',
    body: `<p>El <b>pulso</b> es el latido de la canción (las negras). Las <b>subdivisiones</b> lo parten: en corcheas contamos «1 y 2 y 3 y 4 y».</p>
      <p>Tocar a tiempo no es acertar una nota: es que <b>todas caigan a la misma distancia del clic</b>. Por eso la app te da dos números distintos:</p>
      <ul><li><b>Consistencia (± ms):</b> qué tan parejo tocas. Bajo ±15 ms es muy sólido; sobre ±40 ms el groove se siente suelto.</li><li><b>Adelantado o atrasado:</b> hacia dónde te inclinas. Necesita calibrar el teléfono una vez.</li></ul>
      <p>El <b>pocket</b> es cuando el bajo y el bombo suenan como un solo instrumento. Se construye con consistencia, no con velocidad.</p>
      <h3>Con uñeta</h3>
      <ul><li>Negras: todos los ataques hacia abajo, mismo recorrido de mano.</li><li>Corcheas: abajo en el número, arriba en el «y». La mano no deja de moverse aunque haya silencio.</li><li>Si el «y» suena más débil que el número, el groove cojea: grábate y escucha.</li></ul>` },
  { id: 'sincopa', group: 'Fase 1 · Fundamentos', title: 'La síncopa', lead: 'Acentuar donde el oído no lo espera.', topic: 'ritmo', widget: 'sync',
    body: `<p>En 4/4 los tiempos fuertes son el 1 y el 3. Una <b>síncopa</b> es acentuar un tiempo débil o un «y», y dejar que ese sonido <b>pise el tiempo fuerte que viene</b>, que se queda sin ataque.</p>
      <p>El efecto es de empuje: la música parece adelantarse a sí misma. Es la diferencia entre un riff que marcha y uno que se balancea.</p>
      <p>Para tocarla, la mano sigue marcando todas las corcheas en el aire y solo «conecta» en los golpes del patrón. Cuenta siempre en voz alta.</p>`,
    after: '<p class="hint">Mismo tempo, mismas cuatro negras de clic. Cambia solo dónde caen los golpes.</p>' },
  { id: 'voz', group: 'Fase 1 · Fundamentos', title: 'Voz grave: aire y afinación', lead: 'Las notas graves se caen cuando falta apoyo.', topic: 'voz',
    body: `<h3>Aire</h3>
      <ul><li>Inhala por la nariz moviendo el abdomen, no los hombros.</li><li>Las graves necesitan <b>menos aire y más constante</b>, no más fuerza. Si empujas, la nota sube o se rompe.</li><li>Ejercicio base: soltar el aire en «sss» durante 8 tiempos, parejo.</li></ul>
      <h3>Afinación</h3>
      <ul><li>Escucha la referencia, <b>piensa la nota antes de cantarla</b>, y entra directo. Entrar «desde abajo» arrastrando es el vicio típico de las voces graves.</li><li>Si quedas bajo: más apoyo de aire y piensa la nota «desde arriba».</li><li>Si quedas alto: relaja garganta y mandíbula, baja el volumen.</li><li>Canta a volumen medio. Susurrar o gritar desafina a cualquiera.</li></ul>
      <h3>Cómo leer el medidor</h3>
      <p>100 cents son un semitono. Dentro de <b>±15 cents</b> suena afinado para cualquier oído. Entre 15 y 40 se nota al sostener la nota. La <b>estabilidad</b> (cuánto tiembla el trazo) importa tanto como el centro.</p>
      <p>En la banda eres la voz grave: tu trabajo armónico suele ser la raíz o la 5ª bajo la otra voz. Si tú afinas, el otro vocalista tiene piso.</p>` },
  { id: 'modos', group: 'Fase 2 · Adelanto', title: 'Modos: una nota de diferencia', lead: 'Dórico, frigio y lidio como colores.', widget: 'modes',
    body: `<p>Un modo es una escala mayor o menor con <b>una sola nota cambiada</b>. Esa nota es todo su carácter:</p>
      <ul><li><b>Dórico</b> = menor con la 6ª mayor. Menor pero no triste: suena a groove.</li><li><b>Frigio</b> = menor con la ♭2. Oscuro, tenso. La ♭2 a un traste de la raíz es disonancia lista para usar.</li><li><b>Lidio</b> = mayor con la ♯4. Flotante, extraño, muy usado en lo progresivo.</li></ul>
      <p>Esto es de la Fase 2. Por ahora escúchalos y fíjate cuál se parece a lo que quieres que suene tu banda.</p>` },
  { id: 'disonancia', group: 'Fase 2 · Adelanto', title: 'Disonancia controlada', lead: 'Notas «equivocadas» que funcionan.', widget: 'dissonance',
    body: `<p>Una disonancia es una tensión que el oído quiere resolver. Controlarla es decidir <b>cuánto dura y hacia dónde resuelve</b>.</p>
      <ul><li><b>Segundas:</b> dos notas a uno o dos trastes sonando juntas. Ásperas, modernas.</li><li><b>Tritono:</b> 6 trastes. Inestable por definición.</li><li><b>Acorde prestado:</b> un acorde de la tonalidad paralela (por ejemplo, un ♭VI en una canción mayor). Es el acorde «raro» que pedirá el entregable de la Fase 2.</li></ul>
      <p>Regla práctica: una disonancia corta en tiempo débil es color; una larga en tiempo fuerte es una declaración. Las dos sirven si las eliges tú.</p>` },
];

export const cardById = (id) => CARDS.find((c) => c.id === id);

// ---------- Piezas interactivas ----------
const ROOT_OPTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => `<option value="${p}">${nm(p)}</option>`).join('');

function strip(host) {
  let prev = null;
  const keys = Array.from({ length: 13 }, (_, i) => i);
  host.innerHTML = `<div class="strip">${keys.map((i) => `<button class="key${[1, 3, 6, 8, 10].includes(i % 12) ? ' sharp' : ''}" data-i="${i}">${es(i)}<small>${en(i)}</small></button>`).join('')}</div>
    <p class="strip-info" aria-live="polite">Do → Do: doce trastes, una octava.</p>`;
  host.onclick = (e) => {
    const t = e.target.closest('.key');
    if (!t) return;
    const i = +t.dataset.i;
    playSeq([48 + i], { dur: 0.7 });
    host.querySelectorAll('.key').forEach((k) => k.classList.toggle('sel', k === t));
    if (prev != null && prev !== i) {
      const d = Math.abs(i - prev);
      const [lo, hi] = prev < i ? [prev, i] : [i, prev];
      host.querySelector('.strip-info').innerHTML = `De <b>${es(lo)}</b> a <b>${es(hi)}</b>: ${d} semitono${d > 1 ? 's' : ''} = <b>${INTERVALS[d].n}</b>${d === 1 ? ' (un traste)' : d === 2 ? ' (un tono)' : ''}.`;
    }
    prev = i;
  };
}

function intervals(host) {
  const feel = ['', 'roce áspero', 'paso de escala', 'oscuro, triste', 'luminoso', 'abierto, firme', 'inestable', 'sólido, vacío', 'melancólico', 'dulce', 'rock, blues', 'tenso, casi llega', 'la misma nota'];
  host.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th></th><th>Trastes</th><th>Intervalo</th><th>Grado</th><th>Carácter</th></tr></thead><tbody>
    ${INTERVALS.slice(1).map((iv) => `<tr><td><button class="play" data-s="${iv.s}" aria-label="Escuchar ${iv.n}">▶</button></td><td>${iv.s}</td><td>${iv.n}</td><td>${iv.d}</td><td>${feel[iv.s]}</td></tr>`).join('')}
    </tbody></table></div>`;
  host.onclick = (e) => {
    const t = e.target.closest('.play');
    if (t) playSeq([48, 48 + +t.dataset.s], { dur: 0.6 });
  };
}

function degrees(host) {
  host.innerHTML = `<label class="field" for="deg-key">Tonalidad</label>
    <select id="deg-key">${KEYS.map((k, i) => `<option value="${i}">${keyName(k)}</option>`).join('')}</select>
    <div class="deg-out"></div><button class="btn soft" data-act="play">▶ Escuchar la escala</button>`;
  const sel = host.querySelector('select');
  const paint = () => {
    const k = KEYS[+sel.value];
    const sc = SCALES[k.mode];
    host.querySelector('.deg-out').innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Grado</th><th>Nota</th><th>Desde la tónica</th></tr></thead><tbody>
      ${sc.f.map((s, i) => `<tr><td><b>${sc.d[i]}</b></td><td>${nm(k.root + s, k.flat)}</td><td>${INTERVALS[s].n} · ${s} trastes</td></tr>`).join('')}</tbody></table></div>`;
  };
  sel.onchange = paint;
  host.onclick = (e) => {
    if (!e.target.closest('[data-act="play"]')) return;
    const k = KEYS[+sel.value];
    playSeq([...SCALES[k.mode].f, 12].map((s) => 45 + pc(k.root - 9) + s), { dur: 0.38 });
  };
  paint();
}

function chord(host) {
  let type = 'mayor';
  host.innerHTML = `<label class="field" for="ch-root">Raíz</label><select id="ch-root">${ROOT_OPTS}</select>
    <div class="seg" role="group" aria-label="Tipo de acorde">${Object.keys(CHORDS).map((t) => `<button data-type="${t}" aria-pressed="${t === type}">${CHORDS[t].n}</button>`).join('')}</div>
    <div class="chord-out"></div><button class="btn soft" data-act="play">▶ Escuchar</button>`;
  const sel = host.querySelector('select');
  const paint = () => {
    const r = +sel.value;
    const c = CHORDS[type];
    const flat = type === 'menor' || type === 'dim';
    host.querySelector('.chord-out').innerHTML = `<div class="chord-name">${es(r, flat)}${c.sym}<small class="cif">${en(r, flat)}${c.sym}</small></div>
      <div class="chord-notes">${c.f.map((s, i) => `<div><b>${es(r + s, flat)}</b><small class="cif">${en(r + s, flat)}</small><span>${c.d[i] === '1' ? 'raíz' : c.d[i]}</span><em>${s} tr.</em></div>`).join('')}</div>`;
    host.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.type === type));
  };
  sel.onchange = paint;
  host.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.type) { type = t.dataset.type; paint(); }
    if (t.dataset.act === 'play' || t.dataset.type) playChord(CHORDS[type].f.map((s) => 48 + +sel.value + s), { arp: true });
  };
  paint();
}

function power(host) {
  host.innerHTML = `<div class="row wrap"><button class="btn soft" data-f="0,7,12">▶ Mi5 <small class="cif">E5</small></button>
    <button class="btn soft" data-f="0,4,7">▶ Mi mayor <small class="cif">E</small></button>
    <button class="btn soft" data-f="0,3,7">▶ Mi menor <small class="cif">Em</small></button></div>`;
  host.onclick = (e) => {
    const t = e.target.closest('button');
    if (t) playChord(t.dataset.f.split(',').map((s) => 52 + +s), { arp: true });
  };
}

/** Diapasón interactivo. show(pcNote) decide qué celdas se destacan; root = clase de nota raíz o null. */
function board(host, inst, show, root) {
  const strings = TUNINGS[inst].strings.slice().reverse();
  const frets = Array.from({ length: 13 }, (_, i) => i);
  host.innerHTML = `<div class="fb-wrap"><div class="fb" style="--frets:13">
    ${strings.map((open) => frets.map((f) => {
      const n = open + f;
      const on = show(pc(n));
      return `<button class="fb-cell${f === 0 ? ' open' : ''}${on ? ' on' : ''}${root != null && pc(n) === root ? ' root' : ''}" data-midi="${n}" data-fret="${f}" data-open="${open}" aria-label="${nm(n)}">${on ? `<span>${es(n)}</span>` : ''}</button>`;
    }).join('')).join('')}
    ${frets.map((f) => `<span class="fb-num${[3, 5, 7, 9, 12].includes(f) ? ' dot' : ''}">${f}</span>`).join('')}
  </div></div><p class="fb-info" aria-live="polite">Toca cualquier traste para oírlo.</p>`;
}
function boardClick(host, e) {
  const t = e.target.closest('.fb-cell');
  if (!t) return false;
  const midi = +t.dataset.midi;
  playSeq([midi], { dur: 0.8 });
  const info = host.querySelector('.fb-info');
  if (info) info.innerHTML = `Cuerda ${nm(+t.dataset.open)}, traste ${t.dataset.fret}: <b>${nm(midi)}</b>`;
  return true;
}

function fret(host) {
  let inst = 'bajo';
  let mode = 'nat';
  let note = 9;
  host.innerHTML = `<div class="seg" role="group" aria-label="Instrumento"><button data-inst="bajo">Bajo</button><button data-inst="guitarra">Guitarra</button></div>
    <div class="seg" role="group" aria-label="Qué mostrar"><button data-mode="nat">Naturales</button><button data-mode="all">Todas</button><button data-mode="one">Una nota</button></div>
    <div class="one-pick" hidden><label class="field" for="fb-note">Nota</label><select id="fb-note">${ROOT_OPTS}</select></div>
    <div class="fb-host"></div>`;
  const sel = host.querySelector('select');
  sel.value = '9';
  const paint = () => {
    host.querySelectorAll('[data-inst]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.inst === inst));
    host.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.mode === mode));
    host.querySelector('.one-pick').hidden = mode !== 'one';
    const show = mode === 'all' ? () => true : mode === 'nat' ? (p) => [0, 2, 4, 5, 7, 9, 11].includes(p) : (p) => p === note;
    board(host.querySelector('.fb-host'), inst, show, mode === 'one' ? note : null);
  };
  sel.onchange = () => { note = +sel.value; paint(); };
  host.onclick = (e) => {
    if (boardClick(host, e)) return;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.inst) inst = t.dataset.inst;
    if (t.dataset.mode) mode = t.dataset.mode;
    paint();
  };
  paint();
}

function penta(host) {
  let inst = 'bajo';
  let kind = 'pentaMenor';
  let root = 4;
  host.innerHTML = `<label class="field" for="pt-root">Raíz</label><select id="pt-root">${ROOT_OPTS}</select>
    <div class="seg" role="group" aria-label="Tipo"><button data-kind="pentaMenor">Menor</button><button data-kind="pentaMayor">Mayor</button></div>
    <div class="seg" role="group" aria-label="Instrumento"><button data-inst="bajo">Bajo</button><button data-inst="guitarra">Guitarra</button></div>
    <p class="penta-notes"></p><div class="fb-host"></div><button class="btn soft" data-act="play">▶ Escuchar</button>`;
  const sel = host.querySelector('select');
  sel.value = '4';
  const paint = () => {
    const sc = SCALES[kind];
    const set = sc.f.map((s) => pc(root + s));
    const flat = kind === 'pentaMenor' && [2, 7, 0, 5, 10, 3].includes(root);
    host.querySelectorAll('[data-inst]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.inst === inst));
    host.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.kind === kind));
    host.querySelector('.penta-notes').innerHTML = sc.f.map((s, i) => `<span><b>${es(root + s, flat)}</b> ${sc.d[i]}</span>`).join(' · ');
    board(host.querySelector('.fb-host'), inst, (p) => set.includes(p), root);
  };
  sel.onchange = () => { root = +sel.value; paint(); };
  host.onclick = (e) => {
    if (boardClick(host, e)) return;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.inst) inst = t.dataset.inst;
    if (t.dataset.kind) kind = t.dataset.kind;
    if (t.dataset.act === 'play') { playSeq([...SCALES[kind].f, 12].map((s) => 40 + pc(root - 4) + s), { dur: 0.36 }); return; }
    paint();
  };
  paint();
}

function sync(host) {
  let met = null;
  const labels = ['1', 'y', '2', 'y', '3', 'y', '4', 'y'];
  const pats = [
    { n: 'A tiempo', p: [1, 0, 1, 0, 1, 0, 1, 0] },
    { n: 'Con síncopa', p: [1, 0, 1, 1, 0, 0, 1, 0] },
    { n: 'Más sincopado', p: [1, 0, 0, 1, 0, 1, 0, 1] },
  ];
  host.innerHTML = pats.map((pt, i) => `<div class="sync-row"><button class="play" data-i="${i}" aria-label="Escuchar ${pt.n}">▶</button><div><div class="sync-name">${pt.n}</div>
    <div class="grid8 small" data-g="${i}">${pt.p.map((v, j) => `<span class="cell${v ? ' hit' : ''}${j % 2 === 0 ? ' beat' : ''}"><i></i><small>${labels[j]}</small></span>`).join('')}</div></div></div>`).join('');
  host.onclick = async (e) => {
    const t = e.target.closest('.play');
    if (!t) return;
    const i = +t.dataset.i;
    await ensureAudio();
    if (met) met.stop();
    stopTones();
    host.querySelectorAll('.cell').forEach((c) => c.classList.remove('now'));
    const cells = host.querySelectorAll(`[data-g="${i}"] .cell`);
    met = new Metronome({ bpm: 84, sub: 2, total: 16,
      onTick: ({ step }) => cells.forEach((c, j) => c.classList.toggle('now', j === step)),
      onEnd: () => cells.forEach((c) => c.classList.remove('now')) });
    const s = met.start(0.25);
    for (let k = 0; k < 16; k++) if (pats[i].p[k % 8]) tone(45, s + k * met.g, 0.14, { vol: 0.28 });
  };
  return () => { if (met) met.stop(); };
}

function modes(host) {
  const list = [['menor', 'Menor natural', 'la referencia'], ['dorico', 'Dórico', '6ª mayor'], ['frigio', 'Frigio', '♭2'], ['mayor', 'Mayor', 'la referencia'], ['lidio', 'Lidio', '♯4']];
  host.innerHTML = `<div class="mode-list">${list.map(([k, n, d]) => `<button class="btn soft" data-k="${k}">▶ ${n}<small class="cif">${d}</small></button>`).join('')}</div>
    <p class="hint">Todos empiezan en La (A). Escucha cuál nota cambia respecto a su referencia.</p>`;
  host.onclick = (e) => {
    const t = e.target.closest('button');
    if (t) playSeq([...SCALES[t.dataset.k].f, 12].map((s) => 45 + s), { dur: 0.36 });
  };
}

function dissonance(host) {
  const list = [['2ª menor junta', [52, 53]], ['2ª mayor junta', [52, 54]], ['Tritono', [52, 58]], ['5ª justa (para comparar)', [52, 59]]];
  host.innerHTML = `<div class="mode-list">${list.map(([n, m], i) => `<button class="btn soft" data-i="${i}">▶ ${n}</button>`).join('')}</div>`;
  host.onclick = (e) => {
    const t = e.target.closest('button');
    if (t) playChord(list[+t.dataset.i][1], { dur: 1.6 });
  };
}

/** Notas privadas: viven en el almacenamiento del teléfono, nunca en el código. */
function notes(host) {
  host.innerHTML = '<label class="field" for="my-notes">Mis notas</label><textarea id="my-notes" rows="6"></textarea><p class="hint" aria-live="polite"></p>';
  const ta = host.querySelector('textarea');
  ta.value = store.data.notes || '';
  ta.oninput = () => {
    store.data.notes = ta.value;
    store.save();
    host.querySelector('.hint').textContent = 'Guardado en este teléfono.';
  };
}

const MOUNT = { strip, intervals, degrees, chord, power, fret, penta, sync, modes, dissonance, notes };

/** Monta la pieza interactiva de una ficha. Devuelve una función de limpieza. */
export function mountCardWidget(kind, host) {
  if (!MOUNT[kind]) return () => {};
  const extra = MOUNT[kind](host);
  return () => { stopTones(); host.onclick = null; if (typeof extra === 'function') extra(); };
}
