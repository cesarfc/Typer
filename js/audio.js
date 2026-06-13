// ============================================================
// TypeQuest — sound effects, all synthesized with WebAudio.
// No audio files needed; works fully offline.
// ============================================================

const SFX = {
  ctx: null,
  enabled: true,

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  tone(freq, dur, { type = "sine", gain = 0.12, when = 0, slideTo = null } = {}) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  noise(dur, { gain = 0.15, when = 0, freq = 800 } = {}) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t0);
  },

  // --- game sounds ---
  click(combo = 0) {
    const base = 540 + Math.min(combo, 30) * 6 + Math.random() * 40;
    this.tone(base, 0.045, { gain: 0.08 });
  },
  error() {
    this.tone(130, 0.18, { type: "square", gain: 0.07, slideTo: 90 });
  },
  word() {
    this.tone(660, 0.09, { gain: 0.1 });
    this.tone(880, 0.12, { gain: 0.1, when: 0.08 });
  },
  combo() {
    this.tone(500, 0.3, { type: "sawtooth", gain: 0.05, slideTo: 1400 });
  },
  flee() {
    this.tone(500, 0.25, { type: "triangle", gain: 0.08, slideTo: 220 });
  },
  catchJingle() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, { gain: 0.12, when: i * 0.1 }));
  },
  // a bright sparkly twinkle for a shiny reveal
  shiny() {
    [1318, 1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.16, { type: "triangle", gain: 0.09, when: i * 0.07 }));
    this.tone(3136, 0.5, { gain: 0.07, when: 0.28 });
    this.noise(0.06, { gain: 0.04, freq: 7000, when: 0.28 });
  },
  star(i) {
    this.tone(700 + i * 160, 0.18, { gain: 0.13 });
  },
  fanfare() {
    [523, 523, 659, 784].forEach((f, i) => this.tone(f, 0.13, { gain: 0.12, when: i * 0.12 }));
    this.tone(1047, 0.5, { gain: 0.13, when: 0.5 });
    this.tone(784, 0.5, { gain: 0.08, when: 0.5 });
  },
  medal() {
    // a struck fifth — reads "gong", clearly distinct from the trophy arpeggio
    this.noise(0.06, { gain: 0.12, freq: 1600 });
    this.tone(392, 0.5, { gain: 0.12 });
    this.tone(587.9, 0.7, { gain: 0.1, when: 0.06 });
  },
  bossHit() {
    this.noise(0.18, { gain: 0.18, freq: 900 });
    this.tone(160, 0.18, { type: "square", gain: 0.1, slideTo: 60 });
  },
  hurt() {
    this.tone(300, 0.3, { type: "sawtooth", gain: 0.1, slideTo: 110 });
    this.noise(0.25, { gain: 0.1, freq: 400 });
  },
  defeat() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, { type: "triangle", gain: 0.1, when: i * 0.22 }));
  },
  levelup() {
    this.tone(400, 0.4, { gain: 0.1, slideTo: 1200 });
    this.tone(1200, 0.25, { gain: 0.1, when: 0.38 });
  },
  trophy() {
    [659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.14, { gain: 0.1, when: i * 0.09 }));
  },
  thump() {
    this.tone(110, 0.14, { type: "sine", gain: 0.2, slideTo: 55 });
    this.noise(0.08, { gain: 0.08, freq: 300 });
  },
  tick() {
    this.tone(880, 0.05, { gain: 0.1 });
  },
  pop() {
    this.noise(0.2, { gain: 0.16, freq: 1400 });
    this.tone(280, 0.28, { gain: 0.12, slideTo: 980 });
  },

  setEnabled(on) {
    this.enabled = on;
    if (on) this.init();
  },
};
