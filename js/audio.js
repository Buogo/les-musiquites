// Motor de audio: clic, tonos de referencia, metrónomo, escucha (micrófono) y grabadora.
import { mtof } from './music.js';
import { store } from './store.js';

let ctx = null;
let master = null;
const live = new Set();

export async function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state !== 'running') {
    try { await ctx.resume(); } catch (e) { /* se reanuda con el siguiente toque */ }
  }
  return ctx;
}
export const getCtx = () => ctx;

/** Clic agudo y corto (~5 kHz) para que el micrófono lo pueda separar del instrumento. */
export function click(t, accent = false, vol = 0.5) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = accent ? 6200 : 5000;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.06);
}

/** Tono de referencia. Diente de sierra filtrado: los armónicos se oyen aunque el parlante no baje a 60 Hz. */
export function tone(midi, t, dur, { vol = 0.2 } = {}) {
  const f = mtof(midi);
  const o = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.value = f;
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(3200, Math.max(900, f * 6));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.setValueAtTime(vol, Math.max(t + 0.02, t + dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
  live.add(o);
  o.onended = () => live.delete(o);
  return t + dur;
}
export function stopTones() {
  for (const o of live) { try { o.stop(); } catch (e) { /* ya terminó */ } }
  live.clear();
}
/** Toca notas una tras otra. Devuelve la duración total en segundos. */
export async function playSeq(midis, { dur = 0.55, gap = 0.04 } = {}) {
  await ensureAudio();
  stopTones();
  let t = ctx.currentTime + 0.06;
  for (const m of midis) t = tone(m, t, dur) + gap;
  return midis.length * (dur + gap);
}
export async function playChord(midis, { dur = 1.5, arp = false } = {}) {
  await ensureAudio();
  stopTones();
  let t = ctx.currentTime + 0.06;
  if (arp) {
    for (const m of midis) t = tone(m, t, 0.42) + 0.03;
    t += 0.1;
  }
  for (const m of midis) tone(m, t, dur, { vol: 0.2 / Math.sqrt(midis.length) + 0.04 });
  return (arp ? midis.length * 0.45 + 0.1 : 0) + dur;
}

/** Tiempo del contexto que se está oyendo ahora mismo (para comparar toques en pantalla con el clic). */
export function heardNow() {
  if (ctx.getOutputTimestamp) {
    const ts = ctx.getOutputTimestamp();
    if (ts && ts.contextTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
  }
  return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
}

export class Metronome {
  /**
   * @param bpm pulsos por minuto
   * @param sub subdivisiones por pulso (1 negras, 2 corcheas)
   * @param audible función (beat) => boolean para silenciar compases
   * @param onTick ({k, beat, step, isBeat, accent, t}) llamado cuando suena cada subdivisión
   * @param total cantidad de subdivisiones antes de detenerse (0 = infinito)
   */
  constructor({ bpm, sub = 1, beatsPerBar = 4, audible = () => true, onTick = null, onEnd = null, total = 0 }) {
    Object.assign(this, { bpm, sub, beatsPerBar, audible, onTick, onEnd, total });
    this.g = 60 / bpm / sub;
    this.k = 0;
    this.timeouts = new Set();
    this.running = false;
  }
  start(delay = 0.3) {
    this.t0 = ctx.currentTime + delay;
    this.running = true;
    this.timer = setInterval(() => this.pump(), 25);
    this.pump();
    return this.t0;
  }
  timeOf(k) { return this.t0 + k * this.g; }
  pump() {
    if (!this.running) return;
    while (this.timeOf(this.k) < ctx.currentTime + 0.14) {
      const k = this.k++;
      if (this.total && k >= this.total) {
        const wait = Math.max(0, (this.timeOf(k) - ctx.currentTime) * 1000);
        this.later(() => { this.stop(); if (this.onEnd) this.onEnd(); }, wait);
        clearInterval(this.timer);
        return;
      }
      const t = this.timeOf(k);
      const isBeat = k % this.sub === 0;
      const beat = Math.floor(k / this.sub);
      const accent = isBeat && beat % this.beatsPerBar === 0;
      if (isBeat && this.audible(beat)) click(t, accent);
      if (this.onTick) {
        const info = { k, beat, step: k % (this.sub * this.beatsPerBar), isBeat, accent, t };
        this.later(() => this.onTick(info), Math.max(0, (t - ctx.currentTime) * 1000));
      }
    }
  }
  later(fn, ms) {
    const id = setTimeout(() => { this.timeouts.delete(id); fn(); }, ms);
    this.timeouts.add(id);
  }
  stop() {
    this.running = false;
    clearInterval(this.timer);
    for (const id of this.timeouts) clearTimeout(id);
    this.timeouts.clear();
  }
}

// ---- Detección de afinación (YIN) ----
const yinBuf = new Float32Array(1100);
export function yin(buf, sr, fmin = 36, fmax = 1200) {
  const half = buf.length >> 1;
  const tauMin = Math.max(2, Math.floor(sr / fmax));
  const tauMax = Math.min(half - 2, yinBuf.length - 2, Math.ceil(sr / fmin));
  let running = 0;
  yinBuf[0] = 1;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const d = buf[i] - buf[i + tau];
      sum += d * d;
    }
    running += sum;
    yinBuf[tau] = running > 0 ? (sum * tau) / running : 1;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (yinBuf[t] < 0.15) {
      while (t + 1 <= tauMax && yinBuf[t + 1] < yinBuf[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let best = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++) if (yinBuf[t] < yinBuf[best]) best = t;
    if (yinBuf[best] > 0.35) return null;
    tau = best;
  }
  const a = yinBuf[tau - 1];
  const b = yinBuf[tau];
  const c = yinBuf[tau + 1];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? (a - c) / (2 * den) : 0;
  return { freq: sr / (tau + Math.max(-1, Math.min(1, shift))), clarity: 1 - b };
}

function micError(e) {
  const name = e && e.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new Error('No tengo permiso para usar el micrófono. Actívalo en los ajustes del navegador para este sitio y vuelve a intentar.');
  }
  if (name === 'NotFoundError') return new Error('No encontré ningún micrófono en este dispositivo.');
  if (!navigator.mediaDevices) return new Error('El micrófono solo funciona con conexión segura (https). Abre la app desde su dirección publicada.');
  return new Error('No pude abrir el micrófono: ' + ((e && e.message) || 'error desconocido'));
}
const MIC = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };

/** Escucha el micrófono y emite: 'pitch' {freq|null, clarity, rms, t}, 'onset' {t, band}, 'level' {rms}. */
export class Listener {
  constructor() { this.h = {}; this.active = false; }
  on(type, fn) { (this.h[type] = this.h[type] || []).push(fn); return this; }
  emit(type, d) { for (const fn of this.h[type] || []) fn(d); }
  async start(testSource = null) {
    await ensureAudio();
    if (!Listener.loaded) {
      await ctx.audioWorklet.addModule('js/worklet.js');
      Listener.loaded = true;
    }
    if (testSource) {
      this.src = testSource;
    } else {
      try {
        if (!navigator.mediaDevices) throw new Error('insecure');
        this.stream = await navigator.mediaDevices.getUserMedia(MIC);
      } catch (e) { throw micError(e); }
      this.src = ctx.createMediaStreamSource(this.stream);
    }
    this.node = new AudioWorkletNode(ctx, 'lm-listener');
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.decSr = ctx.sampleRate / Math.max(1, Math.round(ctx.sampleRate / 16000));
    this.src.connect(this.node);
    this.node.connect(this.sink);
    this.sink.connect(ctx.destination);
    this.node.port.onmessage = (e) => this.handle(e.data);
    this.active = true;
    return this;
  }
  handle(d) {
    if (!this.active) return;
    if (d.type === 'frame') {
      const buf = d.buf;
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length);
      let res = null;
      if (rms > 0.0008) res = yin(buf, this.decSr);
      this.emit('pitch', { freq: res ? res.freq : null, clarity: res ? res.clarity : 0, rms, t: d.t });
    } else if (d.type === 'onset') {
      this.emit('onset', d);
    } else if (d.type === 'level') {
      this.emit('level', d);
    }
  }
  stop() {
    this.active = false;
    try { this.src && this.src.disconnect(this.node); } catch (e) { /* ya desconectado */ }
    try { this.node && this.node.disconnect(); } catch (e) { /* idem */ }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

/** Latencia de ida y vuelta guardada (segundos) o null si no se ha calibrado. */
export function latencySec() {
  const ms = store.data.settings.latencyMs;
  return ms == null ? null : ms / 1000;
}

/** Calibración: el teléfono toca clics y los escucha por su propio micrófono. Devuelve ms. */
export async function calibrate() {
  const L = new Listener();
  const hits = [];
  L.on('onset', (o) => { if (o.band === 'high') hits.push(o.t); });
  await L.start();
  const N = 10;
  const g = 0.5;
  const t0 = ctx.currentTime + 0.6;
  for (let i = 0; i < N; i++) click(t0 + i * g, false, 0.9);
  await new Promise((r) => setTimeout(r, (0.6 + N * g + 0.4) * 1000));
  L.stop();
  const devs = [];
  for (let i = 0; i < N; i++) {
    const t = t0 + i * g;
    const h = hits.find((x) => x - t >= 0 && x - t < 0.4);
    if (h != null) devs.push(h - t);
  }
  if (devs.length < 5) throw new Error('No alcancé a oír los clics. Sube el volumen, quita los audífonos y prueba en un lugar silencioso.');
  devs.sort((a, b) => a - b);
  const ms = Math.round(devs[Math.floor(devs.length / 2)] * 1000);
  store.data.settings.latencyMs = ms;
  store.save();
  return ms;
}

/** Grabadora simple para guardar tomas. */
export class Recorder {
  async start() {
    try {
      if (!navigator.mediaDevices) throw new Error('insecure');
      this.stream = await navigator.mediaDevices.getUserMedia(MIC);
    } catch (e) { throw micError(e); }
    if (!window.MediaRecorder) {
      this.stream.getTracks().forEach((t) => t.stop());
      throw new Error('Este navegador no permite grabar audio.');
    }
    this.chunks = [];
    this.mr = new MediaRecorder(this.stream);
    this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.t0 = performance.now();
    this.mr.start();
  }
  stop() {
    return new Promise((resolve) => {
      if (!this.mr || this.mr.state === 'inactive') { resolve(null); return; }
      this.mr.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mr.mimeType || 'audio/webm' });
        this.stream.getTracks().forEach((t) => t.stop());
        resolve({ blob, dur: (performance.now() - this.t0) / 1000 });
      };
      this.mr.stop();
    });
  }
  cancel() {
    try { if (this.mr && this.mr.state !== 'inactive') { this.mr.onstop = null; this.mr.stop(); } } catch (e) { /* nada */ }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
  }
}
