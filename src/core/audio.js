// Fully synthesized audio: no asset files. Everything is oscillators + noise through the WebAudio API.
class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.sfxGain = null; this.musicGain = null;
    this.sfxOn = true; this.musicOn = true; this.musicTimer = null; this.step = 0; this.nextNoteTime = 0;
    this.noiseBuf = null; this.lastPlayed = {};
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxOn ? 1 : 0; this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicOn ? 0.35 : 0; this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate * 1;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setSfx(on) { this.sfxOn = on; if (this.sfxGain) this.sfxGain.gain.value = on ? 1 : 0; }
  setMusic(on) { this.musicOn = on; if (this.musicGain) this.musicGain.gain.value = on ? 0.35 : 0; if (on) this.startMusic(); else this.stopMusic(); }

  tone({ f = 440, f2 = null, type = 'square', dur = 0.1, vol = 0.3, attack = 0.005, decay = null, dest = null, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay || dur));
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t0); o.stop(t0 + (decay || dur) + 0.02);
  }
  noise({ dur = 0.2, vol = 0.3, hp = 200, lp = 8000, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const h = this.ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
    const l = this.ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
    s.connect(h); h.connect(l); l.connect(g); g.connect(this.sfxGain); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  // Rate-limit spammy sfx so 20 turrets don't clip the mix.
  throttle(key, ms) { const n = performance.now(); if (this.lastPlayed[key] && n - this.lastPlayed[key] < ms) return false; this.lastPlayed[key] = n; return true; }

  play(name) {
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'shoot': if (this.throttle('shoot', 45)) this.tone({ f: 900, f2: 300, type: 'square', dur: 0.05, vol: 0.08 }); break;
      case 'sniper': this.tone({ f: 200, f2: 60, type: 'sawtooth', dur: 0.18, vol: 0.25 }); this.noise({ dur: 0.12, vol: 0.15, hp: 1000 }); break;
      case 'zap': if (this.throttle('zap', 60)) { this.tone({ f: 1800, f2: 200, type: 'sawtooth', dur: 0.09, vol: 0.12 }); this.noise({ dur: 0.06, vol: 0.08, hp: 2000 }); } break;
      case 'rocket': this.tone({ f: 120, f2: 500, type: 'sawtooth', dur: 0.25, vol: 0.15 }); break;
      case 'boom': this.noise({ dur: 0.45, vol: 0.4, hp: 60, lp: 1200 }); this.tone({ f: 90, f2: 30, type: 'sine', dur: 0.4, vol: 0.4 }); break;
      case 'flame': if (this.throttle('flame', 300)) this.noise({ dur: 0.3, vol: 0.06, hp: 300, lp: 3000 }); break;
      case 'kill': if (this.throttle('kill', 40)) this.tone({ f: 500, f2: 100, type: 'triangle', dur: 0.12, vol: 0.12 }); break;
      case 'hit': if (this.throttle('hit', 50)) this.noise({ dur: 0.04, vol: 0.06, hp: 1500 }); break;
      case 'build': this.tone({ f: 300, f2: 900, type: 'square', dur: 0.12, vol: 0.2 }); this.tone({ f: 1200, type: 'sine', dur: 0.15, vol: 0.15, delay: 0.1 }); break;
      case 'upgrade': [440, 660, 880].forEach((f, i) => this.tone({ f, type: 'square', dur: 0.1, vol: 0.15, delay: i * 0.07 })); break;
      case 'sell': this.tone({ f: 800, f2: 200, type: 'square', dur: 0.2, vol: 0.15 }); break;
      case 'deny': this.tone({ f: 160, type: 'square', dur: 0.12, vol: 0.2 }); this.tone({ f: 120, type: 'square', dur: 0.15, vol: 0.2, delay: 0.1 }); break;
      case 'hack': this.tone({ f: 400, f2: 1600, type: 'sawtooth', dur: 0.25, vol: 0.18 }); this.tone({ f: 1600, f2: 2400, type: 'sine', dur: 0.15, vol: 0.12, delay: 0.2 }); break;
      case 'hacked': this.tone({ f: 1200, f2: 150, type: 'sawtooth', dur: 0.5, vol: 0.25 }); this.noise({ dur: 0.3, vol: 0.12, hp: 400 }); break;
      case 'purge': this.tone({ f: 200, f2: 1800, type: 'square', dur: 0.3, vol: 0.2 }); break;
      case 'leak': this.tone({ f: 220, f2: 110, type: 'sawtooth', dur: 0.35, vol: 0.3 }); this.noise({ dur: 0.2, vol: 0.15, hp: 100, lp: 800 }); break;
      case 'wave': [330, 330, 440].forEach((f, i) => this.tone({ f, type: 'sawtooth', dur: 0.18, vol: 0.2, delay: i * 0.2 })); break;
      case 'boss': [110, 110, 110, 82].forEach((f, i) => { this.tone({ f, type: 'sawtooth', dur: 0.35, vol: 0.3, delay: i * 0.3 }); this.noise({ dur: 0.2, vol: 0.1, hp: 80, lp: 500, delay: i * 0.3 }); }); break;
      case 'blip': this.tone({ f: 1400, type: 'square', dur: 0.05, vol: 0.15 }); break;
      case 'bselect': this.tone({ f: 880, f2: 1320, type: 'square', dur: 0.08, vol: 0.18 }); break;
      case 'daemon': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, type: 'square', dur: 0.14, vol: 0.18, delay: i * 0.08 })); break;
      case 'fail': [300, 250, 200].forEach((f, i) => this.tone({ f, type: 'sawtooth', dur: 0.2, vol: 0.2, delay: i * 0.15 })); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ f, type: 'square', dur: 0.3, vol: 0.2, delay: i * 0.12 })); break;
      case 'lose': [400, 300, 200, 100].forEach((f, i) => this.tone({ f, f2: f * 0.7, type: 'sawtooth', dur: 0.4, vol: 0.25, delay: i * 0.25 })); break;
      case 'ap': this.tone({ f: 600, f2: 1200, type: 'triangle', dur: 0.2, vol: 0.2 }); this.tone({ f: 1200, f2: 2400, type: 'triangle', dur: 0.2, vol: 0.15, delay: 0.15 }); break;
      case 'door': this.noise({ dur: 0.25, vol: 0.3, hp: 80, lp: 600 }); this.tone({ f: 80, type: 'square', dur: 0.3, vol: 0.2 }); break;
      case 'stun': this.tone({ f: 2000, f2: 400, type: 'square', dur: 0.2, vol: 0.15 }); break;
    }
  }

  // Minimal synthwave loop: bass sequence + arpeggio, scheduled with a look-ahead timer.
  startMusic() {
    if (!this.ctx || !this.musicOn || this.musicTimer) return;
    this.step = 0; this.nextNoteTime = this.ctx.currentTime + 0.1;
    const bass = [55, 55, 55, 55, 65.4, 65.4, 49, 49];      // A1 A1 A1 A1 C2 C2 G1 G1
    const arp = [220, 261.6, 329.6, 440, 329.6, 261.6];      // Am arpeggio
    const stepLen = 0.14;
    const tick = () => {
      if (!this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
        const t = this.nextNoteTime; const s = this.step;
        if (s % 2 === 0) this.tone({ f: bass[Math.floor(s / 4) % bass.length], type: 'sawtooth', dur: stepLen * 1.6, vol: 0.18, dest: this.musicGain, delay: t - this.ctx.currentTime });
        this.tone({ f: arp[s % arp.length] * (Math.floor(s / 32) % 2 ? 1.5 : 1), type: 'square', dur: stepLen * 0.8, vol: 0.05, dest: this.musicGain, delay: t - this.ctx.currentTime });
        if (s % 8 === 4) this.noise({ dur: 0.08, vol: 0.0, hp: 3000 });
        this.nextNoteTime += stepLen; this.step++;
      }
    };
    this.musicTimer = setInterval(tick, 100);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
}
export const Audio = new AudioEngine();
