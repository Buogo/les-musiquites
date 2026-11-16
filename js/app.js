// Les Musiquites: pantallas, set diario, revisión del sábado y progreso.
import { store, dayKey, addDays, streak, recentLog, takes } from './store.js';
import { EX, CAT, makeSet, pickExercise, buildExercise, topicName } from './exercises.js';
import { WIDGETS } from './widgets.js';
import { CARDS, PHASES, PENDING, cardById, mountCardWidget } from './knowledge.js';
import { stopTones, playSeq } from './audio.js';
import { nm } from './music.js';

store.load();

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const sheet = $('#sheet');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
const fmtLong = (d) => new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
const fmtShort = (d) => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(d);
const INST = { cabeza: 'sin instrumento', oído: 'oído', manos: 'manos', bajo: 'bajo', guitarra: 'guitarra', voz: 'voz', libre: 'libre' };

let tab = 'hoy';
let extra = null;
let sheetCleanup = null;
let clockTimer = null;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- Día de hoy ----------
function today() {
  const key = dayKey();
  let day = store.data.days[key];
  if (!day) {
    const prev = store.data.days[dayKey(addDays(new Date(), -1))];
    const avoid = prev ? prev.blocks.map((b) => b.id) : [];
    day = { blocks: makeSet(key, dayNum(), avoid), done: false };
    store.data.days[key] = day;
    store.save();
  }
  return day;
}
function lastSaturday() {
  let d = new Date();
  while (d.getDay() !== 6) d = addDays(d, -1);
  return d;
}
function reviewState() {
  const key = dayKey(lastSaturday());
  return { key, review: store.data.reviews[key] || null, isSaturday: new Date().getDay() === 6 };
}

// ---------- Hoja (pantalla completa sobre la app) ----------
function openSheet({ eyebrow, title, mins = 0, body }) {
  closeSheet();
  sheet.innerHTML = `<div class="sheet-in"><header class="sheet-head">
      <button class="icon-btn" data-close aria-label="Cerrar">✕</button>
      <div class="sheet-title"><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>
      ${mins ? `<div class="clock"><b>0:00</b><small>meta ${mins}:00</small></div>` : ''}
    </header><div class="sheet-body">${body}</div></div>`;
  sheet.hidden = false;
  document.body.classList.add('locked');
  sheet.scrollTop = 0;
  if (mins) {
    const t0 = Date.now();
    const clock = $('.clock', sheet);
    clockTimer = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      $('b', clock).textContent = mmss(s);
      clock.classList.toggle('over', s >= mins * 60);
    }, 500);
  }
}
function closeSheet() {
  clearInterval(clockTimer);
  if (sheetCleanup) { try { sheetCleanup(); } catch (e) { /* nada */ } sheetCleanup = null; }
  stopTones();
  sheet.hidden = true;
  sheet.innerHTML = '';
  document.body.classList.remove('locked');
}
sheet.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { closeSheet(); render(); }
});

function openExercise(def, params, onFinish, opts = {}) {
  openSheet({
    eyebrow: `${opts.eyebrow || CAT[def.cat] || 'Herramienta'}${def.inst ? ' · ' + (INST[def.inst] || def.inst) : ''}`,
    title: def.title,
    mins: def.mins || 0,
    body: `<section class="brief"><p>${params.how || def.how || ''}</p>
        ${def.why ? `<details><summary>Para qué sirve</summary><p>${def.why}</p></details>` : ''}</section>
      <div class="widget"></div><div class="result" hidden></div>`,
  });
  const host = $('.widget', sheet);
  const resultEl = $('.result', sheet);
  const api = {
    done(result) {
      clearInterval(clockTimer);
      host.hidden = true;
      $('.brief', sheet).hidden = true;
      const card = def.card && cardById(def.card);
      resultEl.hidden = false;
      resultEl.innerHTML = `<p class="eyebrow">Resultado</p><p class="res-big">${esc(result.summary)}</p>
        <button class="btn primary wide" data-fin="1">Listo</button>
        ${card && result.score != null && result.score < 0.7 ? `<button class="btn soft wide" data-fin="card">Repasar la ficha: ${card.title}</button>` : ''}`;
      resultEl.onclick = (e) => {
        const b = e.target.closest('[data-fin]');
        if (!b) return;
        closeSheet();
        if (onFinish) onFinish(result);
        render();
        if (b.dataset.fin === 'card') openCard(def.card);
      };
    },
    saved() { toast('Guardado en este teléfono'); },
  };
  sheetCleanup = WIDGETS[def.widget](host, params, api);
}

function logResult(def, id, result, isExtra) {
  store.log({ ex: id, cat: def.cat, topic: def.topic, widget: def.widget, summary: result.summary, score: result.score, metrics: result.metrics || {}, extra: !!isExtra });
}

// ---------- Hoy ----------
function blockCard(b, i, scope) {
  const def = EX[b.id];
  return `<li class="block${b.done ? ' done' : ''}" data-scope="${scope}" data-i="${i}">
    <span class="block-n" aria-hidden="true">0${i + 1}</span>
    <div class="block-main"><p class="eyebrow">${CAT[def.cat]} · ${def.mins} min · ${INST[def.inst] || def.inst}</p>
      <h3>${def.title}</h3>${b.done && b.result ? `<p class="block-res">${esc(b.result.summary)}</p>` : ''}</div>
    <div class="block-act">${b.done
    ? '<span class="check">Hecho</span><button class="link" data-act="open">Repetir</button>'
    : '<button class="btn primary" data-act="open">Empezar</button><button class="link" data-act="reroll">Cambiar</button>'}</div></li>`;
}

function renderHoy() {
  const day = today();
  const n = streak();
  const rv = reviewState();
  const doneCount = day.blocks.filter((b) => b.done).length;
  const nextPending = PENDING.find(([id]) => !store.data.course.checks[id]);
  view.innerHTML = `<header class="top"><div><p class="eyebrow">${fmtLong(new Date())}</p><h1>Hoy</h1></div>
      <div class="streak" title="Días seguidos con el set completo"><b>${n}</b><span>${n === 1 ? 'día seguido' : 'días seguidos'}</span></div></header>
    ${rv.isSaturday && !(rv.review && rv.review.done) ? `<button class="banner" data-act="review"><b>Es sábado: toca revisión semanal.</b><span>Mira tus números, escucha tus tomas y prepara el resumen para Claude.</span></button>` : ''}
    <section><div class="sec-head"><h2>Tu set de 10 minutos</h2><span class="pill">${doneCount} de 3</span></div>
      <ol class="blocks">${day.blocks.map((b, i) => blockCard(b, i, 'day')).join('')}</ol>
      ${day.done ? '<p class="alldone">Set completo. Lo que hiciste hoy ya cuenta para la revisión del sábado.</p>' : ''}
    </section>
    <section><div class="sec-head"><h2>Práctica extra</h2></div>
      ${extra ? `<ol class="blocks">${extra.map((b, i) => blockCard(b, i, 'extra')).join('')}</ol>` : '<p class="muted">¿Te quedaron ganas? Genera otro set al azar. No afecta tu racha.</p>'}
      <button class="btn soft wide" data-act="extra">${extra ? 'Otro set distinto' : 'Generar otro set'}</button>
    </section>
    <section><button class="phase-mini" data-act="curso"><p class="eyebrow">Fase 1 de 4 · en curso</p><h3>Fundamentos aplicados</h3>
      <p>${nextPending ? 'Siguiente pendiente: ' + nextPending[1] : 'Sin pendientes anotados.'}</p></button></section>`;
}

function onHoyClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  if (act === 'review') { openReview(); return; }
  if (act === 'curso') { go('progreso'); return; }
  if (act === 'extra') {
    extra = makeSet(`extra|${Date.now()}`, Math.floor(Math.random() * 7), extra ? extra.map((b) => b.id) : today().blocks.map((b) => b.id));
    renderHoy();
    return;
  }
  const li = t.closest('.block');
  if (!li) return;
  const scope = li.dataset.scope;
  const list = scope === 'day' ? today().blocks : extra;
  const b = list[+li.dataset.i];
  if (act === 'reroll') {
    b.reroll = (b.reroll || 0) + 1;
    const pick = pickExercise(b.cat, `${dayKey()}|${b.cat}|r${b.reroll}|${scope}`, [b.id], dayNum());
    b.id = pick.id;
    b.seed = pick.seed;
    if (scope === 'day') store.save();
    renderHoy();
    return;
  }
  if (act === 'open') {
    const { def, params } = buildExercise(b.id, b.seed);
    openExercise(def, params, (result) => {
      const wasDone = today().done;
      b.done = true;
      b.result = { summary: result.summary, score: result.score };
      logResult(def, b.id, result, scope !== 'day');
      if (scope === 'day') {
        const day = today();
        day.done = day.blocks.every((x) => x.done);
        store.save();
        if (day.done && !wasDone) toast(`Set completo. Racha: ${streak()} ${streak() === 1 ? 'día' : 'días'}.`);
      }
    });
  }
}

// ---------- Escuchar ----------
const free = { bpm: 80, sub: 1, mute: false };
function renderEscuchar() {
  const ms = store.data.settings.latencyMs;
  const tonic = store.data.settings.tonic;
  view.innerHTML = `<header class="top"><div><p class="eyebrow">Herramientas con micrófono</p><h1>Escuchar</h1></div></header>
    <div class="tools">
      <article class="tool"><div><h3>Afinador</h3><p>Para el bajo, la guitarra o tu voz. Muestra la nota y cuántos cents te desvías.</p></div>
        <button class="btn primary" data-tool="tuner">Abrir</button></article>
      <article class="tool col"><div><h3>Pulso con clic</h3><p>Toca con el metrónomo y mide, nota por nota, qué tan parejo vas.</p></div>
        <div class="tool-cfg"><div class="stepper"><button data-bpm="-4" aria-label="Bajar tempo">−</button><b id="free-bpm">${free.bpm}</b><span>BPM</span><button data-bpm="4" aria-label="Subir tempo">+</button></div>
          <div class="seg" role="group" aria-label="Subdivisión"><button data-sub="1" aria-pressed="${free.sub === 1}">Negras</button><button data-sub="2" aria-pressed="${free.sub === 2}">Corcheas</button></div>
          <label class="check-row" for="free-mute"><input type="checkbox" id="free-mute" ${free.mute ? 'checked' : ''}> El clic se calla cada 2 compases</label></div>
        <button class="btn primary wide" data-tool="pulse">Empezar</button></article>
      <article class="tool"><div><h3>Nota larga</h3><p>Sostén tres notas y mira el trazo de tu afinación en el tiempo.</p></div>
        <button class="btn primary" data-tool="sustain">Abrir</button></article>
      <article class="tool"><div><h3>Grabadora</h3><p>Graba una idea al vuelo. Queda guardada para la revisión del sábado.</p></div>
        <button class="btn primary" data-tool="rec">Abrir</button></article>
      <article class="tool"><div><h3>Calibrar el teléfono</h3><p>${ms == null ? 'Sin calibrar. Hazlo una vez para saber si tocas adelantado o atrasado.' : `Calibrado: ${ms} ms de retraso.`}</p></div>
        <button class="btn ${ms == null ? 'primary' : 'soft'}" data-tool="calib">${ms == null ? 'Calibrar' : 'Repetir'}</button></article>
    </div>
    <section><div class="sec-head"><h2>Tu nota cómoda</h2></div>
      <p class="muted">La tónica que uso en los ejercicios de voz. Elige una nota grave que cantes sin esfuerzo.</p>
      <div class="row"><select id="tonic" aria-label="Nota cómoda">${[40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 52].map((m) => `<option value="${m}" ${m === tonic ? 'selected' : ''}>${nm(m)}${Math.floor(m / 12) - 1}</option>`).join('')}</select>
      <button class="btn soft" data-act="hear">▶ Oírla</button></div>
    </section>
    <p class="muted small">El micrófono solo se usa mientras un ejercicio está abierto. El audio se analiza en el teléfono y no sale de él.</p>`;
}

function onEscucharClick(e) {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.bpm) {
    free.bpm = Math.max(40, Math.min(200, free.bpm + +t.dataset.bpm));
    $('#free-bpm').textContent = free.bpm;
    return;
  }
  if (t.dataset.sub) { free.sub = +t.dataset.sub; renderEscuchar(); return; }
  if (t.dataset.act === 'hear') { playSeq([+$('#tonic').value], { dur: 1.8 }); return; }
  const tool = t.dataset.tool;
  if (!tool) return;
  free.mute = $('#free-mute').checked;
  const tonic = store.data.settings.tonic;
  const tools = {
    tuner: [{ title: 'Afinador', widget: 'tuner', how: 'Toca «Escuchar» y luego una cuerda al aire o una nota cantada. La aguja al centro significa afinado.' }, {}],
    pulse: [{ title: 'Pulso con clic', widget: 'pulse', topic: 'pulso', cat: 'tecnica', card: 'pulso', how: 'Una sola nota, exactamente con el clic. Deja el teléfono cerca del ampli.' },
      { bpm: free.bpm, sub: free.sub, bars: 8, mute: free.mute ? [2, 2] : null, what: 'notas' }],
    sustain: [{ title: 'Nota larga', widget: 'sustain', topic: 'voz', cat: 'tecnica', card: 'voz', how: 'Escucha la referencia y sostén cada nota 5 segundos con «aaa» o «mmm», a volumen medio.' },
      { notes: [tonic - 2, tonic, tonic + 3], secs: 5 }],
    rec: [{ title: 'Grabadora', widget: 'create', how: 'Graba, escucha y guarda. Las tomas aparecen en Progreso.' }, { bpm: free.bpm, label: 'Idea suelta' }],
    calib: [{ title: 'Calibrar el teléfono', widget: 'calib', how: 'El teléfono toca diez clics y mide cuánto tarda en oírlos por su propio micrófono.' }, {}],
  };
  const [def, params] = tools[tool];
  openExercise(def, params, (result) => { if (def.topic) logResult(def, 'libre_' + tool, result, true); }, { eyebrow: 'Herramienta' });
}

// ---------- Saber ----------
function ago(key) {
  if (!key) return 'sin repasar';
  const days = Math.round((new Date(dayKey()) - new Date(key)) / 86400000);
  return days <= 0 ? 'repasada hoy' : days === 1 ? 'repasada ayer' : `repasada hace ${days} días`;
}
function renderSaber() {
  const groups = [...new Set(CARDS.map((c) => c.group))];
  view.innerHTML = `<header class="top"><div><p class="eyebrow">Lo que vas aprendiendo, para consultar</p><h1>Saber</h1></div></header>
    ${groups.map((g) => `<section><div class="sec-head"><h2>${g}</h2></div><ul class="cards">
      ${CARDS.filter((c) => c.group === g).map((c) => `<li><button class="card" data-card="${c.id}"><span class="card-txt"><b>${c.title}</b><span>${c.lead}</span></span>
        <span class="tag${store.data.cards[c.id] ? '' : ' new'}">${ago(store.data.cards[c.id])}</span></button></li>`).join('')}</ul></section>`).join('')}`;
}
function openCard(id) {
  const c = cardById(id);
  if (!c) return;
  openSheet({ eyebrow: c.group, title: c.title, body: `<article class="prose">${c.body}</article>${c.widget ? '<div class="widget card-widget"></div>' : ''}${c.after || ''}` });
  if (c.widget) sheetCleanup = mountCardWidget(c.widget, $('.card-widget', sheet));
  store.data.cards[id] = dayKey();
  store.save();
}

// ---------- Progreso ----------
function stats(days) {
  const log = recentLog(days);
  const has = (w, k) => log.filter((e) => e.widget === w && e.metrics && e.metrics[k] != null);
  const topics = {};
  for (const q of has('quiz', 'total')) {
    const t = (topics[q.topic] = topics[q.topic] || { c: 0, t: 0 });
    t.c += q.metrics.correct;
    t.t += q.metrics.total;
  }
  return {
    log, topics,
    pulse: has('pulse', 'sd'),
    voice: has('sustain', 'sd'),
    find: log.filter((e) => e.widget === 'follow' && e.metrics && e.metrics.find),
    create: log.filter((e) => e.widget === 'create'),
  };
}
function spark(values, invert = true) {
  if (values.length < 2) return '';
  const w = 120;
  const h = 32;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const y = (v) => { const r = hi === lo ? 0.5 : (v - lo) / (hi - lo); return 4 + (invert ? r : 1 - r) * (h - 8); };
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (w - 8) + 4},${y(v).toFixed(1)}`);
  const last = pts[pts.length - 1].split(',');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tendencia"><polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3.2" fill="currentColor"/></svg>`;
}
function weekStrip() {
  const now = new Date();
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  const names = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return `<div class="week">${names.map((nme, i) => {
    const d = addDays(monday, i);
    const day = store.data.days[dayKey(d)];
    const some = day && day.blocks.some((b) => b.done);
    const cls = day && day.done ? 'full' : some ? 'part' : '';
    return `<div class="wd ${cls}${dayKey(d) === dayKey() ? ' today' : ''}"><i></i><span>${nme}</span></div>`;
  }).join('')}</div>`;
}

function renderProgreso() {
  const st = stats(30);
  const rv = reviewState();
  const n = streak();
  const pulseVals = st.pulse.slice(-10).map((e) => e.metrics.sd);
  const voiceVals = st.voice.slice(-10).map((e) => e.metrics.sd);
  const findVals = st.find.slice(-10).map((e) => e.metrics.per);
  const topicRows = Object.entries(st.topics).sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t);
  const metric = (title, vals, unit, note) => `<div class="metric"><div><h3>${title}</h3><p>${vals.length ? note : 'Aún sin datos. Aparece cuando hagas el ejercicio.'}</p></div>
    ${vals.length ? `<div class="metric-val"><b>${unit(vals[vals.length - 1])}</b>${spark(vals)}</div>` : ''}</div>`;
  view.innerHTML = `<header class="top"><div><p class="eyebrow">Fase 1 · Fundamentos aplicados</p><h1>Progreso</h1></div>
      <div class="streak"><b>${n}</b><span>${n === 1 ? 'día seguido' : 'días seguidos'}</span></div></header>
    <section>${weekStrip()}</section>
    <section><button class="banner${rv.review && rv.review.done ? ' quiet' : ''}" data-act="review"><b>Revisión del sábado</b>
      <span>${rv.review && rv.review.done ? `Hecha el ${fmtShort(lastSaturday())}. Puedes volver a abrirla.` : 'Resumen de la semana, tus tomas y la autoevaluación para Claude.'}</span></button></section>
    <section><div class="sec-head"><h2>Tus números</h2><span class="pill">últimos 30 días</span></div>
      ${metric('Pulso', pulseVals, (v) => `±${Math.round(v)} ms`, 'Consistencia contra el clic. Más bajo es mejor; bajo ±15 ms es muy sólido.')}
      ${metric('Voz', voiceVals, (v) => `±${Math.round(v)} cents`, 'Estabilidad al sostener una nota. Bajo ±15 cents suena firme.')}
      ${metric('Mástil', findVals, (v) => `${v} s`, 'Segundos que tardas en encontrar cada nota.')}
      <div class="metric col"><div><h3>Teoría por tema</h3><p>${topicRows.length ? 'Porcentaje de aciertos. Arriba queda lo que más te cuesta.' : 'Aún sin datos. Aparece cuando respondas preguntas.'}</p></div>
        ${topicRows.map(([t, v]) => { const pct = Math.round((v.c / v.t) * 100); return `<div class="bar"><span>${topicName(t)}</span><div class="bar-track"><i style="width:${pct}%" class="${pct < 60 ? 'low' : ''}"></i></div><b>${pct}%</b></div>`; }).join('')}</div>
    </section>
    <section><div class="sec-head"><h2>El curso</h2></div>
      ${PHASES.map((ph) => `<details class="phase" ${ph.n === 1 ? 'open' : ''}><summary><span class="ph-n">${ph.n}</span><span class="ph-t"><b>${ph.name}</b><small>${ph.state}</small></span></summary>
        <p class="muted">${ph.goal}</p>${ph.items.map(([id, txt]) => checkRow(id, txt)).join('')}</details>`).join('')}
    </section>
    <section><div class="sec-head"><h2>Pendientes con Claude</h2></div>${PENDING.map(([id, txt]) => checkRow(id, txt)).join('')}</section>
    <section><div class="sec-head"><h2>Tus tomas</h2></div><div id="takes"><p class="muted">Cargando…</p></div></section>
    <section><div class="sec-head"><h2>Tus datos</h2></div>
      <p class="muted">Todo se guarda solo en este teléfono. Exporta un respaldo de vez en cuando; las grabaciones no se incluyen.</p>
      <div class="row wrap"><button class="btn soft" data-act="export">Exportar respaldo</button><label class="btn soft" for="import-file">Importar respaldo</label>
      <input type="file" id="import-file" accept="application/json,.json" class="sr"></div><p class="status" id="data-status" aria-live="polite"></p></section>`;
  renderTakes();
}
function checkRow(id, txt) {
  const on = !!store.data.course.checks[id];
  return `<label class="check-row" for="ck-${id}"><input type="checkbox" id="ck-${id}" data-check="${id}" ${on ? 'checked' : ''}><span>${txt}</span></label>`;
}
async function renderTakes(target = $('#takes'), sinceMs = 0) {
  if (!target) return;
  const all = (await takes.all()).filter((t) => t.t >= sinceMs);
  if (!target.isConnected) return;
  if (!all.length) { target.innerHTML = `<p class="muted">${sinceMs ? 'No guardaste tomas esta semana.' : 'Todavía no hay tomas. Se guardan desde el bloque de creación o la grabadora.'}</p>`; return; }
  target.innerHTML = '';
  for (const t of all.slice(0, 30)) {
    const el = document.createElement('div');
    el.className = 'take-row';
    const url = URL.createObjectURL(t.blob);
    el.innerHTML = `<p><b>${esc(t.label || 'Toma')}</b><span>${fmtShort(new Date(t.t))} · ${mmss(t.dur || 0)}</span></p><audio controls preload="metadata" src="${url}"></audio>
      <button class="link danger" data-del="${t.id}">Borrar</button>`;
    target.append(el);
  }
  target.onclick = async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (b.dataset.sure) { await takes.del(+b.dataset.del); renderTakes(target, sinceMs); } else { b.dataset.sure = '1'; b.textContent = 'Toca otra vez para borrar'; }
  };
}

function onProgresoClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  if (t.dataset.act === 'review') openReview();
  if (t.dataset.act === 'export') {
    const blob = new Blob([JSON.stringify(store.data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `les-musiquites-${dayKey()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    $('#data-status').textContent = 'Respaldo descargado.';
  }
}
view.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.check) {
    store.data.course.checks[t.dataset.check] = t.checked;
    store.save();
  } else if (t.id === 'free-mute') {
    free.mute = t.checked;
  } else if (t.id === 'tonic') {
    store.data.settings.tonic = +t.value;
    store.save();
  } else if (t.id === 'import-file' && t.files[0]) {
    t.files[0].text().then((txt) => {
      const obj = JSON.parse(txt);
      if (!obj || typeof obj !== 'object' || !obj.days) throw new Error('formato');
      store.replace(obj);
      render();
      toast('Respaldo importado');
    }).catch(() => { $('#data-status').textContent = 'Ese archivo no es un respaldo de Les Musiquites.'; });
  }
});

// ---------- Revisión del sábado ----------
const REVIEW_Q = [
  '¿Qué bloque te costó más esta semana, y por qué?',
  'Del 1 al 5, ¿qué tan cómodo te sientes encontrando notas de oído?',
  'Tus ideas de esta semana: ¿salieron de la cabeza o las descubriste con las manos?',
  '¿Algo que te esté frustrando al tocar o cantar?',
];
function weekSummary() {
  const st = stats(7);
  const from = addDays(new Date(), -6);
  let full = 0;
  for (let i = 0; i < 7; i++) if ((store.data.days[dayKey(addDays(from, i))] || {}).done) full++;
  const byCat = { oido: 0, tecnica: 0, creacion: 0 };
  st.log.forEach((e) => { if (byCat[e.cat] != null) byCat[e.cat]++; });
  const pulse = avg(st.pulse.map((e) => e.metrics.sd));
  const bias = avg(st.pulse.filter((e) => e.metrics.mean != null).map((e) => e.metrics.mean));
  const vsd = avg(st.voice.map((e) => e.metrics.sd));
  const voff = avg(st.voice.map((e) => e.metrics.off));
  const per = avg(st.find.map((e) => e.metrics.per));
  const clarity = avg(st.create.map((e) => e.metrics.rating).filter(Boolean));
  const topics = Object.entries(st.topics).map(([t, v]) => ({ t, pct: Math.round((v.c / v.t) * 100), c: v.c, n: v.t })).sort((a, b) => a.pct - b.pct);
  const notes = st.create.map((e) => e.metrics.note).filter(Boolean);
  return { st, from, full, byCat, pulse, bias, vsd, voff, per, clarity, topics, notes };
}
function summaryText(w, answers) {
  const L = [];
  L.push(`Les Musiquites — resumen semanal (${fmtShort(w.from)} al ${fmtShort(new Date())})`);
  L.push(`Días con set completo: ${w.full} de 7 · racha actual: ${streak()}`);
  L.push(`Bloques hechos: ${w.st.log.length} (oído/teoría ${w.byCat.oido}, técnica ${w.byCat.tecnica}, creación ${w.byCat.creacion})`);
  if (w.pulse != null) L.push(`Pulso (bajo/palmas con clic): consistencia ±${Math.round(w.pulse)} ms en promedio${w.bias != null ? `; sesgo ${Math.round(w.bias) > 0 ? '+' : ''}${Math.round(w.bias)} ms (negativo = adelantado)` : '; teléfono sin calibrar, no hay dato de adelantado/atrasado'}. Detalle: ${w.st.pulse.map((e) => `±${e.metrics.sd} ms a ${e.metrics.bpm} BPM ${e.metrics.sub === 2 ? 'corcheas' : 'negras'}`).join(', ')}`);
  if (w.vsd != null) L.push(`Voz (nota larga): estabilidad ±${Math.round(w.vsd)} cents, desvío medio ${Math.round(w.voff) > 0 ? '+' : ''}${Math.round(w.voff)} cents (negativo = bajo)`);
  if (w.per != null) L.push(`Mástil: ${w.per.toFixed(1)} s por nota al buscar notas`);
  if (w.topics.length) L.push(`Teoría, aciertos por tema: ${w.topics.map((x) => `${topicName(x.t)} ${x.pct}% (${x.c}/${x.n})`).join('; ')}`);
  const other = w.st.log.filter((e) => ['sing', 'tap', 'follow', 'guided'].includes(e.widget) && !(e.metrics && e.metrics.find));
  if (other.length) L.push(`Otros ejercicios: ${other.map((e) => `${EX[e.ex] ? EX[e.ex].title : e.ex}: ${e.summary}`).join('; ')}`);
  if (w.st.create.length) L.push(`Creación: ${w.st.create.length} bloques, ${w.st.create.filter((e) => e.metrics.saved).length} tomas guardadas${w.clarity != null ? `, claridad idea→instrumento ${w.clarity.toFixed(1)}/5` : ''}`);
  if (w.notes.length) L.push(`Notas de la semana: ${w.notes.map((x) => `«${x}»`).join(' ')}`);
  L.push('Autoevaluación:');
  REVIEW_Q.forEach((q, i) => L.push(`${i + 1}. ${q} ${answers[i] ? '→ ' + answers[i] : '→ (sin responder)'}`));
  const pend = PENDING.filter(([id]) => !store.data.course.checks[id]).map(([, txt]) => txt);
  L.push(`Fase actual: 1 (Fundamentos aplicados). Pendientes: ${pend.length ? pend.join(' | ') : 'ninguno'}`);
  return L.join('\n');
}
function openReview() {
  const w = weekSummary();
  const rv = reviewState();
  const saved = rv.review || { answers: [], done: false };
  const weak = w.topics.filter((x) => x.pct < 75).map((x) => CARDS.find((c) => c.topic === x.t)).filter(Boolean);
  const stale = CARDS.filter((c) => c.group.startsWith('Fase 1')).sort((a, b) => (store.data.cards[a.id] || '').localeCompare(store.data.cards[b.id] || ''));
  const toReview = [...new Set([...weak, ...stale])].slice(0, 3);
  const line = (label, val) => `<div class="rv-line"><span>${label}</span><b>${val}</b></div>`;
  openSheet({
    eyebrow: `Semana del ${fmtShort(w.from)} al ${fmtShort(new Date())}`,
    title: 'Revisión del sábado',
    body: `<section class="rv"><h3>Tu semana en números</h3>
        ${line('Días con set completo', `${w.full} de 7`)}
        ${line('Bloques hechos', w.st.log.length)}
        ${line('Pulso', w.pulse != null ? `±${Math.round(w.pulse)} ms` : 'sin datos')}
        ${line('Voz, estabilidad', w.vsd != null ? `±${Math.round(w.vsd)} cents` : 'sin datos')}
        ${line('Mástil', w.per != null ? `${w.per.toFixed(1)} s por nota` : 'sin datos')}
        ${line('Tema más flojo', w.topics.length ? `${topicName(w.topics[0].t)} (${w.topics[0].pct}%)` : 'sin datos')}
      </section>
      <section class="rv"><h3>Para repasar hoy</h3><ul class="cards">${toReview.map((c) => `<li><button class="card" data-rvcard="${c.id}"><span class="card-txt"><b>${c.title}</b><span>${c.lead}</span></span><span class="tag">${ago(store.data.cards[c.id])}</span></button></li>`).join('')}</ul>
        <p class="hint">Abrir una ficha cierra la revisión; tus respuestas se guardan al escribir.</p></section>
      <section class="rv"><h3>Escucha tus tomas de la semana</h3><div id="rv-takes"><p class="muted">Cargando…</p></div></section>
      <section class="rv"><h3>Autoevaluación</h3>
        ${REVIEW_Q.map((q, i) => `<label class="field" for="rv-${i}">${q}</label><textarea id="rv-${i}" rows="2" data-rv="${i}">${esc(saved.answers[i] || '')}</textarea>`).join('')}</section>
      <section class="rv"><h3>Llévaselo a Claude</h3><p class="muted">Copia el resumen y pégalo en tu conversación del curso. Con eso Claude ajusta las próximas sesiones.</p>
        <button class="btn primary wide" data-rvact="copy">Copiar resumen para Claude</button>
        <textarea id="rv-text" rows="8" readonly hidden></textarea>
        <button class="btn soft wide" data-rvact="done">${saved.done ? 'Revisión hecha' : 'Marcar revisión como hecha'}</button></section>`,
  });
  renderTakes($('#rv-takes', sheet), Date.now() - 7 * 86400000);
  const body = $('.sheet-body', sheet);
  const persist = () => {
    const answers = REVIEW_Q.map((_, i) => $(`#rv-${i}`, sheet).value.trim());
    store.data.reviews[rv.key] = { ...(store.data.reviews[rv.key] || {}), answers, done: (store.data.reviews[rv.key] || {}).done || false };
    store.save();
    return answers;
  };
  body.oninput = (e) => { if (e.target.dataset.rv != null) persist(); };
  body.onclick = async (e) => {
    const cardBtn = e.target.closest('[data-rvcard]');
    if (cardBtn) { persist(); openCard(cardBtn.dataset.rvcard); return; }
    const b = e.target.closest('[data-rvact]');
    if (!b) return;
    const answers = persist();
    if (b.dataset.rvact === 'copy') {
      const text = summaryText(w, answers);
      const ta = $('#rv-text', sheet);
      ta.value = text;
      try {
        await navigator.clipboard.writeText(text);
        toast('Resumen copiado');
      } catch (err) {
        ta.hidden = false;
        ta.focus();
        ta.select();
        toast('Selecciona el texto y cópialo');
      }
    } else {
      store.data.reviews[rv.key].done = true;
      store.save();
      closeSheet();
      render();
      toast('Revisión guardada');
    }
  };
}

// ---------- Navegación ----------
const VIEWS = { hoy: renderHoy, escuchar: renderEscuchar, saber: renderSaber, progreso: renderProgreso };
function render() { VIEWS[tab](); }
function go(name) {
  tab = name;
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  render();
  window.scrollTo(0, 0);
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) go(b.dataset.tab);
});
view.addEventListener('click', (e) => {
  if (tab === 'hoy') onHoyClick(e);
  else if (tab === 'escuchar') onEscucharClick(e);
  else if (tab === 'saber') { const c = e.target.closest('[data-card]'); if (c) openCard(c.dataset.card); }
  else if (tab === 'progreso') onProgresoClick(e);
});
document.addEventListener('visibilitychange', () => {
  // Si la app quedó abierta de un día para otro, refresca el set al volver.
  if (!document.hidden && sheet.hidden) render();
});

go('hoy');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
}

// Para pruebas desde la consola.
window.__lm = {
  store, go, openReview,
  /** Abre cualquier ejercicio del banco sin registrar el resultado: __lm.probar('o_sincopa') */
  probar(id, seed = 1) {
    const { def, params } = buildExercise(id, seed);
    openExercise(def, params, null);
    return params;
  },
};
