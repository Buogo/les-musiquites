// Procesador de audio: corre en el hilo de audio.
// - Banda grave (< 1.1 kHz): ataques de bajo/guitarra/voz/palmas y cuadros para detectar afinación.
// - Banda aguda (> 3.8 kHz): solo para oír el clic del metrónomo al calibrar la latencia.
// El clic suena en ~5 kHz justamente para que NO se cuele en la banda grave.

function biquad(type, fc, q, sr) {
  const w = (2 * Math.PI * fc) / sr;
  const cs = Math.cos(w);
  const al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
  else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
  const a0 = 1 + al;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cs) / a0, a2: (1 - al) / a0, z1: 0, z2: 0 };
}
function run(f, x) {
  const y = f.b0 * x + f.z1;
  f.z1 = f.b1 * x - f.a1 * y + f.z2;
  f.z2 = f.b2 * x - f.a2 * y;
  return y;
}

class LMListener extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate;
    this.lp1 = biquad('lp', 1100, 0.541, sr);
    this.lp2 = biquad('lp', 1100, 1.307, sr);
    this.hp1 = biquad('hp', 3800, 0.707, sr);
    this.hp2 = biquad('hp', 3800, 0.707, sr);
    this.dec = Math.max(1, Math.round(sr / 16000));
    this.W = 2048;
    this.hop = 640;
    this.ring = new Float32Array(this.W);
    this.rpos = 0;
    this.sinceHop = 0;
    this.decAcc = 0;
    this.decN = 0;
    this.low = { slow: 0, noise: 1e-6, last: -1 };
    this.high = { slow: 0, noise: 1e-6, last: -1 };
    this.ratio = 4;
    this.refractory = 0.09;
    this.lvlAcc = 0;
    this.lvlN = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.ratio) this.ratio = d.ratio;
      if (d.refractory) this.refractory = d.refractory;
    };
    this.port.postMessage({ type: 'ready', decSr: sr / this.dec });
  }

  detect(st, e, t, band) {
    const hit = e > st.slow * this.ratio && e > st.noise * 10 && e > 2e-7 && t - st.last > this.refractory;
    if (hit) {
      st.last = t;
      st.slow = e;
      this.port.postMessage({ type: 'onset', band, t, e });
    } else {
      st.slow += (e - st.slow) * 0.06;
    }
    if (e < st.noise) st.noise = Math.max(e, 1e-9);
    else st.noise *= 1.0005;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const n = ch.length;
    let eL = 0;
    let eH = 0;
    for (let i = 0; i < n; i++) {
      const x = ch[i];
      const l = run(this.lp2, run(this.lp1, x));
      const h = run(this.hp2, run(this.hp1, x));
      eL += l * l;
      eH += h * h;
      this.decAcc += l;
      if (++this.decN === this.dec) {
        this.ring[this.rpos] = this.decAcc / this.dec;
        this.rpos = (this.rpos + 1) % this.W;
        this.decAcc = 0;
        this.decN = 0;
        if (++this.sinceHop >= this.hop) {
          this.sinceHop = 0;
          const out = new Float32Array(this.W);
          const tail = this.W - this.rpos;
          out.set(this.ring.subarray(this.rpos), 0);
          out.set(this.ring.subarray(0, this.rpos), tail);
          this.port.postMessage({ type: 'frame', t: currentTime, buf: out }, [out.buffer]);
        }
      }
    }
    eL /= n;
    eH /= n;
    // Si casi toda la energía está en la banda aguda, es el clic colándose por el parlante: no es una nota.
    if (eL > eH * 0.002) this.detect(this.low, eL, currentTime, 'low');
    else this.low.slow += (eL - this.low.slow) * 0.06;
    this.detect(this.high, eH, currentTime, 'high');
    this.lvlAcc += eL;
    if (++this.lvlN >= 16) {
      this.port.postMessage({ type: 'level', rms: Math.sqrt(this.lvlAcc / this.lvlN) });
      this.lvlAcc = 0;
      this.lvlN = 0;
    }
    return true;
  }
}

registerProcessor('lm-listener', LMListener);
