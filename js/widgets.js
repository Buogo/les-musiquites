// Widgets interactivos. Cada uno recibe (host, params, api) y devuelve una función de limpieza.
// api.done({ summary, score, metrics }) avisa que el ejercicio terminó.
import {
  ensureAudio, getCtx, tone, stopTones, playSeq, playChord, heardNow, Metronome, Listener, latencySec, calibrate, Recorder,
} from './audio.js';
import { nm, es, en, pc, centsToPc, nearest, TUNINGS } from './music.js';
import { store, takes } from './store.js';

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sdev = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
};
const median = (a) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const signed = (x) => `${x > 0 ? '+' : ''}${Math.round(x)}`;
export const stripTags = (s) => s.replace(/<small[^>]*>.*?<\/small>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function fitCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 300;
  const h = cv.clientHeight || 120;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

/** Medidor de afinación: aguja entre -60 y +60 cents. */
function meter() {
  const el = document.createElement('div');
  el.className = 'meter';
  el.innerHTML = `<div class="meter-track"><span class="meter-zone"></span><span class="meter-mid"></span><span class="meter-needle" hidden></span></div>
    <div class="meter-legend"><span>grave</span><span class="meter-read">sin señal</span><span>agudo</span></div>`;
  const needle = el.querySelector('.meter-needle');
  const read = el.querySelector('.meter-read');
  return {
    el,
    set(cents, text) {
      if (cents == null) {
        needle.hidden = true;
        el.dataset.state = '';
        read.textContent = text || 'sin señal';
        return;
      }
      needle.hidden = false;
      needle.style.left = `${50 + (clamp(cents, -60, 60) / 60) * 50}%`;
      const a = Math.abs(cents);
      el.dataset.state = a <= 15 ? 'ok' : a <= 40 ? 'near' : 'off';
      read.textContent = text || `${signed(cents)} cents`;
    },
  };
}

// ============ Preguntas de alternativas ============
function quiz(host, p, api) {
  let i = 0;
  let correct = 0;
  let answered = false;
  const n = p.questions.length;
  const play = (q) => {
    if (!q.play) return;
    if (q.play.seq) playSeq(q.play.seq);
    else playChord(q.play.chord, { arp: true });
  };
  function show() {
    answered = false;
    const q = p.questions[i];
    host.innerHTML = `<div class="q-count">Pregunta ${i + 1} de ${n}</div>
      <p class="q-text">${q.q}</p>
      ${q.play ? '<button class="btn soft" data-act="play">▶ Escuchar de nuevo</button>' : ''}
      <div class="opts">${q.opts.map((o, j) => `<button class="opt" data-j="${j}">${o}</button>`).join('')}</div>
      <div class="q-fb" hidden></div>`;
    play(q);
  }
  host.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const q = p.questions[i];
    if (t.dataset.act === 'play') { play(q); return; }
    if (t.dataset.act === 'next') {
      i++;
      if (i < n) show();
      else {
        host.innerHTML = '';
        api.done({ summary: `${correct} de ${n} correctas`, score: correct / n, metrics: { correct, total: n } });
      }
      return;
    }
    if (t.dataset.j != null && !answered) {
      answered = true;
      const j = +t.dataset.j;
      const ok = j === q.a;
      if (ok) correct++;
      host.querySelectorAll('.opt').forEach((btn, k) => {
        btn.disabled = true;
        if (k === q.a) btn.classList.add('right');
        else if (k === j) btn.classList.add('wrong');
      });
      const fb = host.querySelector('.q-fb');
      fb.hidden = false;
      fb.className = `q-fb ${ok ? 'ok' : 'no'}`;
      fb.innerHTML = `<p><strong>${ok ? 'Correcto.' : 'No era esa.'}</strong> ${q.why}</p>
        <button class="btn primary wide" data-act="next">${i + 1 < n ? 'Siguiente' : 'Ver resultado'}</button>`;
      fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  show();
  return () => { stopTones(); host.onclick = null; };
}

// ============ Canta el grado ============
function sing(host, p, api) {
  let i = 0;
  let L = null;
  let listening = false;
  let hold = 0;
  let lastT = 0;
  let best = null;
  let timer = null;
  const results = [];
  const n = p.rounds.length;
  const m = meter();
  host.innerHTML = `<div class="q-count"></div><div class="big-ask"></div><p class="sub-ask"></p>
    <div class="slot"></div><p class="status" aria-live="polite"></p>
    <div class="row"><button class="btn soft" data-act="ref">▶ Tónica</button><button class="btn primary" data-act="go">Cantar</button></div>`;
  host.querySelector('.slot').append(m.el);
  const $ = (s) => host.querySelector(s);
  const go = $('[data-act="go"]');
  const flatOf = (r) => r.mode === 'menor';

  function show() {
    const r = p.rounds[i];
    $('.q-count').textContent = `Ronda ${i + 1} de ${n}`;
    $('.big-ask').innerHTML = `Canta el grado <b>${r.deg + 1}</b>`;
    $('.sub-ask').innerHTML = `Tonalidad: ${nm(r.tonic, flatOf(r))} ${r.mode}. La tónica que oyes es el grado 1.`;
    $('.status').textContent = 'Escucha la tónica, piensa la nota y canta.';
    m.set(null);
    go.textContent = 'Cantar';
    go.dataset.act = 'go';
    playSeq([r.tonic], { dur: 1.3 });
  }
  async function start() {
    stopTones();
    try {
      if (!L) {
        const l = new Listener();
        l.on('pitch', onPitch);
        await l.start();
        L = l;
      }
    } catch (e) { $('.status').textContent = e.message; return; }
    listening = true;
    hold = 0;
    best = null;
    lastT = 0;
    go.disabled = true;
    $('.status').textContent = 'Te escucho…';
    clearTimeout(timer);
    timer = setTimeout(() => end(false), 9000);
  }
  function onPitch(d) {
    if (!listening) return;
    const r = p.rounds[i];
    const dt = lastT ? Math.min(0.1, d.t - lastT) : 0.04;
    lastT = d.t;
    if (!d.freq) { m.set(null); return; }
    const c = centsToPc(d.freq, pc(r.target));
    m.set(c, `${es(nearest(d.freq).pc)} · ${signed(c)} cents`);
    if (best == null || Math.abs(c) < Math.abs(best)) best = c;
    if (Math.abs(c) <= 40) {
      hold += dt;
      if (hold >= 0.7) end(true);
    } else {
      hold = Math.max(0, hold - dt / 2);
    }
  }
  function end(ok) {
    if (!listening) return;
    listening = false;
    clearTimeout(timer);
    const r = p.rounds[i];
    results.push({ ok, best });
    const name = nm(r.target, flatOf(r));
    $('.status').innerHTML = ok
      ? `Afinado. El grado ${r.deg + 1} es <b>${name}</b>.`
      : `No se estabilizó en la nota. El grado ${r.deg + 1} es <b>${name}</b>: escúchalo y compáralo con lo que cantaste.`;
    playSeq([r.tonic, r.target], { dur: 0.8 });
    go.disabled = false;
    go.textContent = i + 1 < n ? 'Siguiente' : 'Ver resultado';
    go.dataset.act = 'next';
  }
  host.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'ref') playSeq([p.rounds[i].tonic], { dur: 1.3 });
    else if (t.dataset.act === 'go') start();
    else if (t.dataset.act === 'next') {
      i++;
      if (i < n) show();
      else {
        const hits = results.filter((x) => x.ok).length;
        api.done({ summary: `${hits} de ${n} grados afinados`, score: hits / n, metrics: { hits, total: n } });
      }
    }
  };
  show();
  return () => { clearTimeout(timer); listening = false; if (L) L.stop(); stopTones(); host.onclick = null; };
}

// ============ Nota larga ============
function sustain(host, p, api) {
  let i = 0;
  let L = null;
  let phase = 'idle';
  let samples = [];
  let t0 = 0;
  let lastVoice = 0;
  let timer = null;
  const results = [];
  const n = p.notes.length;
  host.innerHTML = `<div class="q-count"></div><div class="big-ask"></div>
    <canvas class="trace" aria-label="Trazo de afinación en el tiempo"></canvas>
    <div class="trace-legend"><span>↑ alta</span><span>la franja es ±15 cents</span><span>↓ baja</span></div>
    <p class="status" aria-live="polite"></p>
    <div class="row"><button class="btn soft" data-act="ref">▶ Referencia</button><button class="btn primary" data-act="go">Sostener ${p.secs} s</button></div>
    <ul class="rounds"></ul>`;
  const $ = (s) => host.querySelector(s);
  const cv = $('.trace');
  const go = $('[data-act="go"]');

  function draw() {
    const { g, w, h } = fitCanvas(cv);
    const y = (c) => h / 2 - (clamp(c, -100, 100) / 100) * (h / 2 - 4);
    g.clearRect(0, 0, w, h);
    g.fillStyle = cssVar('--good-soft');
    g.fillRect(0, y(15), w, y(-15) - y(15));
    g.strokeStyle = cssVar('--line');
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    if (!samples.length) return;
    g.strokeStyle = cssVar('--accent');
    g.lineWidth = 2.5;
    g.lineJoin = 'round';
    g.beginPath();
    samples.forEach((s, k) => {
      const x = (s.x / p.secs) * w;
      if (k === 0) g.moveTo(x, y(s.c)); else g.lineTo(x, y(s.c));
    });
    g.stroke();
  }
  function show() {
    $('.q-count').textContent = `Nota ${i + 1} de ${n}`;
    $('.big-ask').innerHTML = `Sostén <b>${nm(p.notes[i])}</b>`;
    $('.status').textContent = 'Escucha la referencia y luego sostén la nota. Puedes cantarla en la octava que te quede cómoda.';
    samples = [];
    draw();
    go.disabled = false;
    go.textContent = `Sostener ${p.secs} s`;
    go.dataset.act = 'go';
    playSeq([p.notes[i]], { dur: 1.6 });
  }
  async function start() {
    stopTones();
    try {
      if (!L) {
        const l = new Listener();
        l.on('pitch', onPitch);
        await l.start();
        L = l;
      }
    } catch (e) { $('.status').textContent = e.message; return; }
    samples = [];
    phase = 'wait';
    go.disabled = true;
    $('.status').textContent = 'Cuando quieras: empieza a cantar.';
    clearTimeout(timer);
    timer = setTimeout(() => { if (phase === 'wait') abort('No oí ninguna nota. Acércate al teléfono y prueba de nuevo.'); }, 9000);
  }
  function abort(msg) {
    phase = 'idle';
    clearTimeout(timer);
    $('.status').textContent = msg;
    go.disabled = false;
  }
  function onPitch(d) {
    if (phase === 'idle') return;
    const target = pc(p.notes[i]);
    if (phase === 'wait') {
      if (d.freq && d.clarity > 0.7) {
        phase = 'hold';
        t0 = d.t;
        lastVoice = d.t;
        $('.status').textContent = 'Sostén… parejo, sin empujar.';
      }
      return;
    }
    const x = d.t - t0;
    if (d.freq) {
      samples.push({ x, c: centsToPc(d.freq, target) });
      lastVoice = d.t;
    } else if (d.t - lastVoice > 0.8) {
      abort('Se cortó la nota. Toma aire y prueba otra vez.');
      return;
    }
    draw();
    if (x >= p.secs) finishRound();
  }
  function finishRound() {
    phase = 'idle';
    clearTimeout(timer);
    const body = samples.filter((s) => s.x > 0.4).map((s) => s.c);
    const off = mean(body);
    const sd = sdev(body);
    results.push({ off, sd });
    const where = Math.abs(off) <= 12 ? 'centrada' : off > 0 ? `${Math.round(off)} cents alta` : `${Math.round(-off)} cents baja`;
    const steady = sd <= 10 ? 'muy estable' : sd <= 20 ? 'estable' : sd <= 35 ? 'algo temblorosa' : 'inestable';
    const li = document.createElement('li');
    li.innerHTML = `<b>${es(p.notes[i])}</b> ${where} · ${steady} (±${Math.round(sd)} cents)`;
    $('.rounds').append(li);
    $('.status').textContent = Math.abs(off) > 50
      ? 'Quedaste más cerca de la nota vecina que de la pedida. Escucha la referencia otra vez antes de seguir.'
      : off < -12 ? 'Tiende a quedar baja: más aire y piensa la nota «desde arriba».' : off > 12 ? 'Tiende a quedar alta: relaja la garganta y no empujes.' : 'Bien centrada.';
    go.disabled = false;
    go.textContent = i + 1 < n ? 'Siguiente nota' : 'Ver resultado';
    go.dataset.act = 'next';
  }
  host.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'ref') { if (phase === 'idle') playSeq([p.notes[i]], { dur: 1.6 }); }
    else if (t.dataset.act === 'go') start();
    else if (t.dataset.act === 'next') {
      i++;
      if (i < n) show();
      else {
        const sd = mean(results.map((r) => r.sd));
        const off = mean(results.map((r) => r.off));
        api.done({
          summary: `Estabilidad ±${Math.round(sd)} cents · desvío ${signed(off)} cents`,
          score: clamp(1 - sd / 50, 0, 1),
          metrics: { sd: Math.round(sd), off: Math.round(off) },
        });
      }
    }
  };
  show();
  return () => { clearTimeout(timer); phase = 'idle'; if (L) L.stop(); stopTones(); host.onclick = null; };
}

// ============ Pulso: tocar con el clic y medir ============
/** Análisis puro, separado para poder probarlo. */
export function analyzePulse({ onsets, start, g, total, lat, muted = () => false }) {
  let offset = lat;
  const calibrated = lat != null;
  if (!calibrated) {
    // Sin calibrar: estimamos el retraso constante con la fase media de los ataques.
    let sx = 0;
    let sy = 0;
    for (const t of onsets) {
      const ph = ((t - start) / g) * 2 * Math.PI;
      sx += Math.cos(ph);
      sy += Math.sin(ph);
    }
    let frac = Math.atan2(sy, sx) / (2 * Math.PI);
    if (frac < 0) frac += 1;
    offset = frac * g;
    if (offset > 0.9 * g) offset -= g;
  }
  const hit = new Map();
  for (const t of onsets) {
    const x = (t - offset - start) / g;
    const k = Math.round(x);
    if (k < 0 || k >= total) continue;
    const dev = (x - k) * g * 1000;
    if (!hit.has(k) || Math.abs(dev) < Math.abs(hit.get(k))) hit.set(k, dev);
  }
  let pts = [...hit.entries()].map(([k, dev]) => ({ k, dev })).sort((a, b2) => a.k - b2.k);
  const med = median(pts.map((x) => x.dev));
  pts = pts.filter((x) => Math.abs(x.dev - med) < 0.3 * g * 1000);
  const devs = pts.map((x) => x.dev);
  const half = Math.floor(total / 2);
  const first = pts.filter((x) => x.k < half).map((x) => x.dev);
  const second = pts.filter((x) => x.k >= half).map((x) => x.dev);
  const withClick = pts.filter((x) => !muted(x.k)).map((x) => x.dev);
  const noClick = pts.filter((x) => muted(x.k)).map((x) => x.dev);
  return {
    pts, calibrated, hits: pts.length, total,
    sd: sdev(devs), mean: mean(devs),
    trend: first.length > 2 && second.length > 2 ? mean(second) - mean(first) : 0,
    mutedShift: noClick.length > 2 && withClick.length > 2 ? mean(noClick) - mean(withClick) : null,
    mutedSd: noClick.length > 2 ? sdev(noClick) : null,
  };
}

function pulse(host, p, api) {
  const countIn = 4;
  const beats = p.bars * 4;
  let L = null;
  let met = null;
  let onsets = [];
  let t0 = 0;
  const cyc = p.mute ? p.mute[0] + p.mute[1] : 0;
  const barMuted = (bar) => (p.mute ? bar % cyc >= p.mute[0] : false);
  host.innerHTML = `<div class="bpm"><b>${p.bpm}</b> BPM · ${p.sub === 2 ? 'corcheas' : 'negras'} · ${p.bars} compases${p.mute ? ' · el clic se calla' : ''}</div>
    <div class="beats">${[0, 1, 2, 3].map(() => '<span></span>').join('')}</div>
    <p class="status" aria-live="polite">Un compás de entrada y empiezas.</p>
    <canvas class="trace short" aria-label="Desviación de cada nota respecto al clic"></canvas>
    <div class="trace-legend"><span>↑ tarde</span><span>cada punto es una de tus ${p.what}</span><span>↓ antes</span></div>
    <div class="row"><button class="btn primary" data-act="go">Empezar</button></div>
    <div class="pulse-res" hidden></div>
    ${latencySec() == null ? '<p class="hint">Sin calibrar puedo medir qué tan parejo tocas, pero no si vas adelantado o atrasado. Calibra una vez en Escuchar → Calibrar.</p>' : ''}`;
  const $ = (s) => host.querySelector(s);
  const dots = host.querySelectorAll('.beats span');
  const cv = $('.trace');

  function draw(res) {
    const { g, w, h } = fitCanvas(cv);
    const total = beats * p.sub;
    g.clearRect(0, 0, w, h);
    if (p.mute) {
      g.fillStyle = cssVar('--surface-2');
      for (let bar = 0; bar < p.bars; bar++) if (barMuted(bar)) g.fillRect((bar / p.bars) * w, 0, w / p.bars, h);
    }
    g.fillStyle = cssVar('--good-soft');
    g.fillRect(0, h / 2 - (20 / 90) * (h / 2), w, (40 / 90) * (h / 2));
    g.strokeStyle = cssVar('--line');
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    if (!res) return;
    const c = res.calibrated ? 0 : res.mean;
    for (const pt of res.pts) {
      const d = pt.dev - c;
      const x = ((pt.k + 0.5) / total) * w;
      const y = h / 2 - (clamp(d, -90, 90) / 90) * (h / 2 - 5);
      g.fillStyle = Math.abs(d) <= 20 ? cssVar('--good') : Math.abs(d) <= 45 ? cssVar('--warn') : cssVar('--bad');
      g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill();
    }
  }
  async function start() {
    const go = $('[data-act="go"]');
    go.disabled = true;
    $('.pulse-res').hidden = true;
    onsets = [];
    try {
      await ensureAudio();
      L = new Listener();
      L.on('onset', (o) => { if (o.band === 'low') onsets.push(o.t); });
      await L.start();
    } catch (e) { $('.status').textContent = e.message; go.disabled = false; return; }
    met = new Metronome({
      bpm: p.bpm, sub: p.sub, total: (countIn + beats) * p.sub,
      audible: (beat) => beat < countIn || !barMuted(Math.floor((beat - countIn) / 4)),
      onTick: ({ beat, isBeat }) => {
        if (!isBeat) return;
        dots.forEach((d, j) => d.classList.toggle('on', j === beat % 4));
        if (beat < countIn) $('.status').textContent = `Entrada: ${beat + 1}`;
        else {
          const bar = Math.floor((beat - countIn) / 4);
          $('.status').textContent = `Compás ${bar + 1} de ${p.bars}${barMuted(bar) ? ' · sin clic, sigue tú' : ''}`;
        }
      },
      onEnd: finish,
    });
    t0 = met.start(0.4);
  }
  function finish() {
    setTimeout(() => {
      if (L) L.stop();
      dots.forEach((d) => d.classList.remove('on'));
      const g = met.g;
      const total = beats * p.sub;
      const res = analyzePulse({
        onsets, start: t0 + countIn * p.sub * g, g, total, lat: latencySec(),
        muted: (k) => barMuted(Math.floor(k / (4 * p.sub))),
      });
      draw(res);
      const go = $('[data-act="go"]');
      go.disabled = false;
      go.textContent = 'Repetir';
      go.className = 'btn soft';
      const box = $('.pulse-res');
      box.hidden = false;
      if (res.hits < total * 0.4) {
        $('.status').textContent = 'Casi no te oí.';
        box.innerHTML = `<p>Detecté ${res.hits} de ${total} ${p.what}. Acerca el teléfono al ampli, sube el volumen del instrumento o baja el del clic, y repite.</p>
          <button class="btn ghost wide" data-act="skip">Terminar sin medir</button>`;
        return;
      }
      const sd = Math.round(res.sd);
      const grade = sd <= 15 ? 'Muy sólido' : sd <= 25 ? 'Sólido' : sd <= 40 ? 'Irregular' : 'Suelto';
      const lines = [];
      if (res.calibrated) {
        const mn = Math.round(res.mean);
        lines.push(Math.abs(mn) <= 12 ? 'En promedio caes centrado en el clic.' : mn < 0 ? `En promedio vas <b>${-mn} ms adelantado</b>: estás corriendo.` : `En promedio vas <b>${mn} ms atrasado</b>: estás arrastrando.`);
      }
      if (Math.abs(res.trend) > 12) lines.push(res.trend > 0 ? 'En la segunda mitad te fuiste quedando atrás.' : 'En la segunda mitad te fuiste adelantando.');
      if (res.mutedShift != null) {
        const ms = Math.round(res.mutedShift);
        lines.push(Math.abs(ms) <= 15 ? 'Sin clic mantuviste el tempo.' : ms < 0 ? `Sin clic te adelantaste ${-ms} ms: tiendes a acelerar en el silencio.` : `Sin clic te atrasaste ${ms} ms: tiendes a frenar en el silencio.`);
      }
      if (sd > 25) lines.push('Para emparejar: baja 10 BPM y cuenta las subdivisiones en voz alta.');
      $('.status').textContent = `${grade}.`;
      box.innerHTML = `<div class="stat-row"><div><b>±${sd} ms</b><span>consistencia</span></div><div><b>${res.hits}/${total}</b><span>${p.what} detectadas</span></div></div>
        ${lines.map((l) => `<p>${l}</p>`).join('')}
        <button class="btn primary wide" data-act="done">Guardar resultado</button>`;
      box.dataset.summary = `±${sd} ms a ${p.bpm} BPM · ${res.hits}/${total}`;
      box.dataset.sd = sd;
      box.dataset.mean = res.calibrated ? Math.round(res.mean) : '';
      box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 350);
  }
  host.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'go') start();
    else if (t.dataset.act === 'skip') api.done({ summary: 'Sin medición', score: null, metrics: {} });
    else if (t.dataset.act === 'done') {
      const box = $('.pulse-res');
      const sd = +box.dataset.sd;
      const metrics = { sd, bpm: p.bpm, sub: p.sub };
      if (box.dataset.mean !== '') metrics.mean = +box.dataset.mean;
      api.done({ summary: box.dataset.summary, score: clamp(1 - sd / 60, 0, 1), metrics });
    }
  };
  draw(null);
  return () => { if (met) met.stop(); if (L) L.stop(); host.onclick = null; };
}

// ============ Seguir notas: escalas, arpegios, encontrar notas ============
function follow(host, p, api) {
  let i = 0;
  let L = null;
  let run = false;
  let streak = 0;
  let acc = [];
  let needOnset = false;
  let advT = 0;
  let mutedUntil = 0;
  let tStart = 0;
  let skipped = 0;
  const cents = [];
  const n = p.targets.length;
  const scale = p.mode === 'scale';
  const m = meter();
  host.innerHTML = `${scale ? `<div class="chips">${p.targets.map((t, j) => `<span class="chip" data-j="${j}">${t.label}<small>${t.sub || t.cif}</small></span>`).join('')}</div>` : '<div class="q-count"></div>'}
    <div class="big-note"><span class="bn-es"></span><span class="bn-cif"></span><span class="bn-sub"></span></div>
    <div class="slot"></div><p class="status" aria-live="polite">${p.voice ? 'Escucha la referencia y empieza cuando quieras.' : 'Deja el teléfono cerca del ampli o de la guitarra.'}</p>
    <div class="row">${p.refs ? '<button class="btn soft" data-act="ref">▶ Referencia</button>' : ''}<button class="btn primary" data-act="go">Empezar</button><button class="btn ghost" data-act="skip" hidden>Saltar nota</button></div>`;
  host.querySelector('.slot').append(m.el);
  const $ = (s) => host.querySelector(s);

  function render() {
    const t = p.targets[i];
    $('.bn-es').textContent = t.label;
    $('.bn-cif').textContent = p.voice ? '' : t.cif;
    $('.bn-sub').textContent = t.sub || '';
    if (scale) {
      host.querySelectorAll('.chip').forEach((c, j) => {
        c.classList.toggle('done', j < i);
        c.classList.toggle('now', j === i);
      });
      const now = host.querySelector('.chip.now');
      if (now) now.scrollIntoView({ block: 'nearest', inline: 'center' });
    } else {
      $('.q-count').textContent = `Nota ${i + 1} de ${n}`;
    }
  }
  async function start() {
    stopTones();
    try {
      L = new Listener();
      L.on('pitch', onPitch);
      L.on('onset', (o) => { if (o.band === 'low' && o.t > advT + 0.08) needOnset = false; });
      await L.start();
    } catch (e) { $('.status').textContent = e.message; return; }
    run = true;
    tStart = performance.now();
    $('[data-act="go"]').hidden = true;
    $('[data-act="skip"]').hidden = false;
    $('.status').textContent = p.voice ? 'Canta cada grado diciendo su número.' : 'Toca la nota. Avanzo cuando la oigo afinada.';
  }
  function onPitch(d) {
    if (!run || d.t < mutedUntil) return;
    if (!d.freq) { m.set(null); streak = 0; acc = []; return; }
    const c = centsToPc(d.freq, p.targets[i].pc);
    m.set(c, `oigo ${es(nearest(d.freq).pc)} · ${signed(c)} cents`);
    if (needOnset) return;
    if (Math.abs(c) <= 45) {
      streak++;
      acc.push(c);
      if (streak >= 3) advance(mean(acc));
    } else {
      streak = 0;
      acc = [];
    }
  }
  function advance(c) {
    if (c != null) cents.push(c); else skipped++;
    i++;
    streak = 0;
    acc = [];
    if (i >= n) { finish(); return; }
    needOnset = p.targets[i].pc === p.targets[i - 1].pc;
    advT = getCtx().currentTime;
    render();
  }
  function finish() {
    run = false;
    if (L) L.stop();
    const secs = (performance.now() - tStart) / 1000;
    const got = cents.length;
    const tune = Math.round(mean(cents.map(Math.abs)));
    const per = secs / n;
    const summary = scale
      ? `${got} de ${n} notas en ${Math.round(secs)} s · afinación ±${tune} cents`
      : `${got} de ${n} notas · ${per.toFixed(1)} s por nota`;
    host.innerHTML = '';
    api.done({ summary, score: got / n, metrics: { got, total: n, secs: Math.round(secs), per: +per.toFixed(1), tune, skipped, find: !scale } });
  }
  host.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'go') start();
    else if (t.dataset.act === 'skip') advance(null);
    else if (t.dataset.act === 'ref') {
      playSeq(p.refs, { dur: 0.5 }).then((dur) => { mutedUntil = getCtx().currentTime + dur + 0.3; });
    }
  };
  render();
  return () => { run = false; if (L) L.stop(); stopTones(); host.onclick = null; };
}

// ============ Síncopa con los dedos ============
const STEP_NAMES = ['el 1', 'el «y» del 1', 'el 2', 'el «y» del 2', 'el 3', 'el «y» del 3', 'el 4', 'el «y» del 4'];
function tap(host, p, api) {
  const labels = ['1', 'y', '2', 'y', '3', 'y', '4', 'y'];
  let met = null;
  let taps = [];
  let t0 = 0;
  let running = false;
  host.innerHTML = `<div class="bpm"><b>${p.bpm}</b> BPM · ${p.name}</div>
    <div class="grid8">${p.pattern.map((v, j) => `<span class="cell${v ? ' hit' : ''}${j % 2 === 0 ? ' beat' : ''}"><i></i><small>${labels[j]}</small></span>`).join('')}</div>
    <p class="status" aria-live="polite">Los cuadros llenos son los golpes. Escúchalo primero.</p>
    <button class="pad" disabled>Toca aquí</button>
    <div class="row"><button class="btn soft" data-act="demo">▶ Escuchar patrón</button><button class="btn primary" data-act="go">Empezar</button></div>
    <div class="pulse-res" hidden></div>`;
  const $ = (s) => host.querySelector(s);
  const cells = host.querySelectorAll('.cell');
  const pad = $('.pad');
  const mark = (step) => cells.forEach((c, j) => c.classList.toggle('now', j === step));
  const setBusy = (busy) => host.querySelectorAll('[data-act]').forEach((x) => { x.disabled = busy; });

  async function demo() {
    await ensureAudio();
    if (met) met.stop();
    setBusy(true);
    met = new Metronome({ bpm: p.bpm, sub: 2, total: 16, onTick: ({ step }) => mark(step), onEnd: () => { mark(-1); setBusy(false); } });
    const s = met.start(0.3);
    for (let k = 0; k < 16; k++) if (p.pattern[k % 8]) tone(57, s + k * met.g, 0.13, { vol: 0.25 });
    $('.status').textContent = 'Escucha: el tono marca el patrón, el clic marca el pulso.';
  }
  async function start() {
    await ensureAudio();
    if (met) met.stop();
    taps = [];
    setBusy(true);
    $('.pulse-res').hidden = true;
    met = new Metronome({
      bpm: p.bpm, sub: 2, total: 8 + p.bars * 8,
      onTick: ({ k, step, beat }) => {
        mark(step);
        if (k < 8) $('.status').textContent = `Entrada: ${beat + 1}`;
        else {
          if (!running) { running = true; pad.disabled = false; }
          $('.status').textContent = `Compás ${Math.floor((k - 8) / 8) + 1} de ${p.bars}`;
        }
      },
      onEnd: finish,
    });
    t0 = met.start(0.4);
    // El pad se habilita un poco antes del primer golpe para no perder el 1.
    setTimeout(() => { pad.disabled = false; running = true; }, Math.max(0, (7.5 * met.g + 0.4) * 1000));
  }
  function onTap(e) {
    e.preventDefault();
    if (!running) return;
    taps.push(heardNow());
    pad.classList.add('hit');
    setTimeout(() => pad.classList.remove('hit'), 90);
  }
  function finish() {
    running = false;
    pad.disabled = true;
    mark(-1);
    setBusy(false);
    const g = met.g;
    const used = new Set();
    const devs = [];
    const miss = new Array(8).fill(0);
    let expected = 0;
    for (let bar = 0; bar < p.bars; bar++) {
      for (let j = 0; j < 8; j++) {
        if (!p.pattern[j]) continue;
        expected++;
        const t = t0 + (8 + bar * 8 + j) * g;
        let bestK = -1;
        let bestD = 0.45 * g;
        taps.forEach((x, k) => {
          if (used.has(k)) return;
          const d = Math.abs(x - t);
          if (d < bestD) { bestD = d; bestK = k; }
        });
        if (bestK >= 0) { used.add(bestK); devs.push((taps[bestK] - t) * 1000); } else miss[j]++;
      }
    }
    const extras = taps.length - used.size;
    const hits = devs.length;
    const centered = devs.map((d) => d - median(devs));
    const sd = Math.round(sdev(centered));
    const worst = miss.indexOf(Math.max(...miss));
    const lines = [];
    if (hits < expected) lines.push(`${expected - hits === 1 ? 'Se te escapó 1 golpe' : `Se te escaparon ${expected - hits} golpes`}${miss[worst] > 0 ? `; el más difícil fue ${STEP_NAMES[worst]}` : ''}.`);
    if (extras > 0) lines.push(`Diste ${extras} golpe${extras > 1 ? 's' : ''} de más, donde el patrón tenía silencio.`);
    if (hits === expected && extras === 0) lines.push('Patrón completo, sin golpes de más.');
    if (hits >= expected * 0.6) lines.push(sd <= 30 ? 'Los golpes cayeron parejos.' : 'Los golpes bailaron un poco: cuenta «1 y 2 y» en voz alta mientras tocas.');
    const box = $('.pulse-res');
    box.hidden = false;
    box.innerHTML = `<div class="stat-row"><div><b>${hits}/${expected}</b><span>golpes acertados</span></div><div><b>±${sd} ms</b><span>consistencia</span></div></div>
      ${lines.map((l) => `<p>${l}</p>`).join('')}
      <button class="btn primary wide" data-act="done">Guardar resultado</button>`;
    box.dataset.summary = `${hits}/${expected} golpes · ±${sd} ms`;
    box.dataset.score = clamp((hits - extras * 0.5) / expected, 0, 1);
    box.dataset.sd = sd;
    $('.status').textContent = 'Puedes repetir o guardar.';
    $('[data-act="go"]').textContent = 'Repetir';
    $('[data-act="go"]').className = 'btn soft';
  }
  pad.addEventListener('pointerdown', onTap);
  host.onclick = (e) => {
    const t = e.target.closest('button[data-act]');
    if (!t) return;
    if (t.dataset.act === 'demo') demo();
    else if (t.dataset.act === 'go') start();
    else if (t.dataset.act === 'done') {
      const box = $('.pulse-res');
      api.done({ summary: box.dataset.summary, score: +box.dataset.score, metrics: { sd: +box.dataset.sd, tapScore: +box.dataset.score } });
    }
  };
  return () => { if (met) met.stop(); stopTones(); host.onclick = null; };
}

// ============ Creación: consigna + grabadora ============
function create(host, p, api) {
  let rec = null;
  let take = null;
  let rating = 0;
  let met = null;
  let tick = null;
  let saved = false;
  let url = null;
  host.innerHTML = `${p.prompt ? `<div class="prompt"><p>${p.prompt}</p>${p.tip ? `<p class="tip">${p.tip}</p>` : ''}</div>` : ''}
    <div class="row"><button class="btn soft" data-act="click" aria-pressed="false">Clic a ${p.bpm} BPM</button></div>
    <div class="recorder"><button class="rec" data-act="rec" aria-label="Grabar o detener"><span></span></button>
      <div><div class="rec-time">0:00</div><div class="rec-hint">Toca el botón para grabar una toma (máx. 60 s)</div></div></div>
    <div class="take" hidden><audio controls></audio>
      <div class="row"><button class="btn soft" data-act="save">Guardar toma</button><button class="btn ghost" data-act="redo">Descartar</button></div></div>
    <p class="status" aria-live="polite"></p>
    ${p.prompt ? `<div class="rate"><p>¿Qué tan clara bajó la idea de la cabeza al instrumento?</p>
      <div class="stars">${[1, 2, 3, 4, 5].map((k) => `<button data-rate="${k}">${k}</button>`).join('')}</div>
      <div class="stars-legend"><span>la descubrí con las manos</span><span>salió tal como la oía</span></div></div>
    <label class="field" for="create-note">Nota para la revisión del sábado (opcional)</label>
    <textarea id="create-note" rows="2"></textarea>
    <button class="btn primary wide" data-act="done">Terminar bloque</button>` : ''}`;
  const $ = (s) => host.querySelector(s);

  async function toggleRec() {
    const btn = $('.rec');
    if (rec) {
      clearInterval(tick);
      const r = rec;
      rec = null;
      btn.classList.remove('on');
      take = await r.stop();
      if (take) {
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(take.blob);
        $('.take audio').src = url;
        $('.take').hidden = false;
        saved = false;
        $('[data-act="save"]').disabled = false;
        $('[data-act="save"]').textContent = 'Guardar toma';
        $('.rec-hint').textContent = 'Escúchala. Puedes guardarla o grabar otra.';
      }
      return;
    }
    try {
      const r = new Recorder();
      await r.start();
      rec = r;
    } catch (e) { $('.status').textContent = e.message; return; }
    $('.status').textContent = '';
    btn.classList.add('on');
    const s0 = performance.now();
    $('.rec-hint').textContent = 'Grabando… toca de nuevo para detener.';
    tick = setInterval(() => {
      const s = (performance.now() - s0) / 1000;
      $('.rec-time').textContent = mmss(s);
      if (s >= 60) toggleRec();
    }, 250);
  }
  async function toggleClick() {
    const btn = $('[data-act="click"]');
    if (met) { met.stop(); met = null; btn.setAttribute('aria-pressed', 'false'); return; }
    await ensureAudio();
    met = new Metronome({ bpm: p.bpm });
    met.start(0.1);
    btn.setAttribute('aria-pressed', 'true');
  }
  host.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.rate) {
      rating = +t.dataset.rate;
      host.querySelectorAll('.stars button').forEach((x) => x.classList.toggle('on', +x.dataset.rate <= rating));
    } else if (t.dataset.act === 'rec') toggleRec();
    else if (t.dataset.act === 'click') toggleClick();
    else if (t.dataset.act === 'redo') { take = null; $('.take').hidden = true; $('.rec-time').textContent = '0:00'; }
    else if (t.dataset.act === 'save' && take && !saved) {
      try {
        await takes.add({ label: p.label || stripTags(p.prompt || 'Toma libre').slice(0, 90), blob: take.blob, dur: take.dur });
        saved = true;
        t.disabled = true;
        t.textContent = 'Guardada';
        if (api.saved) api.saved();
      } catch (err) { $('.status').textContent = 'No pude guardar la toma en este dispositivo.'; }
    } else if (t.dataset.act === 'done') {
      const note = ($('#create-note').value || '').trim();
      const parts = [saved ? 'Toma guardada' : take ? 'Toma sin guardar' : 'Sin toma'];
      if (rating) parts.push(`claridad ${rating}/5`);
      api.done({ summary: parts.join(' · '), score: rating ? rating / 5 : null, metrics: { rating, saved, note } });
    }
  };
  return () => {
    clearInterval(tick);
    if (rec) rec.cancel();
    if (met) met.stop();
    if (url) URL.revokeObjectURL(url);
    host.onclick = null;
  };
}

// ============ Guiado: pasos + cuenta regresiva + autoevaluación ============
function guided(host, p, api) {
  let left = p.secs;
  let timer = null;
  let met = null;
  host.innerHTML = `<ol class="steps">${p.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    <div class="count">${mmss(left)}</div>
    <div class="row"><button class="btn primary" data-act="go">${p.bpm ? `Empezar con clic a ${p.bpm}` : 'Empezar'}</button><button class="btn ghost" data-act="end">Terminar</button></div>
    <div class="rate" hidden><p>${p.ask || '¿Cómo salió?'}</p>
      <div class="stars">${[1, 2, 3, 4, 5].map((k) => `<button data-rate="${k}">${k}</button>`).join('')}</div>
      <div class="stars-legend"><span>mal</span><span>muy bien</span></div></div>`;
  const $ = (s) => host.querySelector(s);
  function end() {
    clearInterval(timer);
    if (met) { met.stop(); met = null; }
    $('.rate').hidden = false;
    $('[data-act="go"]').hidden = true;
    $('[data-act="end"]').hidden = true;
    $('.rate').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  host.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'go') {
      t.disabled = true;
      if (p.bpm) {
        await ensureAudio();
        met = new Metronome({ bpm: p.bpm });
        met.start(0.2);
      }
      timer = setInterval(() => {
        left--;
        $('.count').textContent = mmss(Math.max(0, left));
        if (left <= 0) end();
      }, 1000);
    } else if (t.dataset.act === 'end') end();
    else if (t.dataset.rate) {
      const r = +t.dataset.rate;
      api.done({ summary: `Autoevaluación ${r}/5`, score: r / 5, metrics: { rating: r } });
    }
  };
  return () => { clearInterval(timer); if (met) met.stop(); host.onclick = null; };
}

// ============ Herramientas libres ============
function tuner(host) {
  let L = null;
  const recent = [];
  const m = meter();
  const chips = (inst) => TUNINGS[inst].strings.map((s) => `<button class="chip tap" data-midi="${s}">${es(s)}<small>${en(s)}</small></button>`).join('');
  host.innerHTML = `<div class="big-note"><span class="bn-es">—</span><span class="bn-cif"></span><span class="bn-sub">toca o canta una nota</span></div>
    <div class="slot"></div>
    <div class="row"><button class="btn primary" data-act="go">Escuchar</button></div>
    <p class="status" aria-live="polite"></p>
    <h3 class="mini">Cuerdas al aire, afinación estándar</h3>
    <p class="hint">Toca una para oír la referencia.</p>
    <div class="chips wrap"><span class="chips-label">Bajo</span>${chips('bajo')}</div>
    <div class="chips wrap"><span class="chips-label">Guitarra</span>${chips('guitarra')}</div>`;
  host.querySelector('.slot').append(m.el);
  const $ = (s) => host.querySelector(s);
  function onPitch(d) {
    if (!d.freq) { recent.length = 0; m.set(null); return; }
    recent.push(d.freq);
    if (recent.length > 3) recent.shift();
    const f = median(recent);
    const nr = nearest(f);
    $('.bn-es').textContent = es(nr.pc);
    $('.bn-cif').textContent = `${en(nr.pc)}${nr.octave}`;
    $('.bn-sub').textContent = `${f.toFixed(1)} Hz`;
    m.set(nr.cents, Math.abs(nr.cents) <= 5 ? 'afinada' : nr.cents > 0 ? `${signed(nr.cents)} cents: baja un poco` : `${signed(nr.cents)} cents: sube un poco`);
  }
  host.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.midi) { playSeq([+t.dataset.midi], { dur: 1.8 }); return; }
    if (t.dataset.act === 'go') {
      if (L) { L.stop(); L = null; t.textContent = 'Escuchar'; m.set(null); return; }
      try {
        const l = new Listener();
        l.on('pitch', onPitch);
        await l.start();
        L = l;
        t.textContent = 'Detener';
        $('.status').textContent = '';
      } catch (err) { $('.status').textContent = err.message; }
    }
  };
  return () => { if (L) L.stop(); stopTones(); host.onclick = null; };
}

function calib(host, p, api) {
  const paint = () => {
    const ms = store.data.settings.latencyMs;
    host.querySelector('.calib-now').innerHTML = ms == null
      ? 'Aún sin calibrar.'
      : `Calibrado: este teléfono tarda <b>${ms} ms</b> entre que suena el clic y lo oye su micrófono.`;
  };
  host.innerHTML = `<ol class="steps">
      <li>Quita los audífonos: el clic tiene que sonar por el parlante del teléfono.</li>
      <li>Sube el volumen a más de la mitad y deja el teléfono sobre la mesa, en silencio.</li>
      <li>Toca «Calibrar». Sonarán diez clics en cinco segundos.</li></ol>
    <p class="calib-now"></p><p class="status" aria-live="polite"></p>
    <div class="row"><button class="btn primary" data-act="go">Calibrar</button><button class="btn ghost" data-act="clear">Borrar</button></div>
    <p class="hint">Con esto puedo decirte si tocas adelantado o atrasado, no solo qué tan parejo. Repítelo si cambias de teléfono. Si practicas con audífonos Bluetooth, el retraso real será mayor que el medido.</p>`;
  paint();
  host.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const st = host.querySelector('.status');
    if (t.dataset.act === 'clear') { store.data.settings.latencyMs = null; store.save(); paint(); st.textContent = ''; return; }
    t.disabled = true;
    st.textContent = 'Escuchando los clics…';
    try {
      await calibrate();
      st.textContent = 'Listo.';
      if (api && api.saved) api.saved();
    } catch (err) { st.textContent = err.message; }
    t.disabled = false;
    paint();
  };
  return () => { host.onclick = null; };
}

export const WIDGETS = { quiz, sing, sustain, pulse, follow, tap, create, guided, tuner, calib };
