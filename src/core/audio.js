// Fully synthesized audio: no asset files. Everything is oscillators + noise through the WebAudio API.
import { SONGS, compileSong } from '../data/music.js';
const SFX_SCALE = 0.6;
const MUSIC_LEVEL = 0.35;
// Instrument patches for the music voices (songs name them in src/data/music.js `voices`).
//   oscs    layered oscillators: semi/detune relative to the note, gain relative to the patch,
//           fm = { ratio, index, decay } adds a sine modulator on that oscillator's frequency.
//   filter  lowpass sweeping f0 -> f1 Hz over ft seconds with resonance q (omit for none).
//   env     amp envelope: attack, decay, sustain level (0 = pluck), release, in seconds.
//   vib     vibrato: LFO rate Hz, depth in cents, seconds before it reaches full depth.
//   width   stereo spread 0..1: layers pan alternately left/right (single layers by pitch).
//   gain    loudness trim so the role volumes in playStep stay comparable across patches.
//   send / verb   how much goes to the tempo-synced delay / the reverb.
const PATCHES = {
  fatbass:  { oscs: [{ type: 'sawtooth' }, { type: 'square', semi: -12, gain: 0.5 }], filter: { f0: 900, f1: 250, q: 1.5, ft: 0.25 }, env: { a: 0.008, d: 0.2, s: 0.6, r: 0.08 }, gain: 1.1 },
  acidbass: { oscs: [{ type: 'sawtooth' }], filter: { f0: 2000, f1: 220, q: 7, ft: 0.2 }, env: { a: 0.003, d: 0.25, s: 0.6, r: 0.08 }, gain: 1.3 },
  subbass:  { oscs: [{ type: 'sine' }, { type: 'triangle', gain: 0.6 }, { type: 'sine', semi: 12, gain: 0.15 }], filter: { f0: 700, f1: 300, q: 1, ft: 0.3 }, env: { a: 0.01, d: 0.3, s: 0.8, r: 0.12 }, gain: 0.6 },
  octbass:  { oscs: [{ type: 'sawtooth' }, { type: 'sawtooth', detune: 9, gain: 0.7 }, { type: 'square', semi: -12, gain: 0.4 }], filter: { f0: 1500, f1: 450, q: 2, ft: 0.12 }, env: { a: 0.004, d: 0.12, s: 0.5, r: 0.06 }, gain: 0.8 },
  softarp:  { oscs: [{ type: 'triangle' }, { type: 'sawtooth', detune: 8, gain: 0.35 }], filter: { f0: 2200, f1: 900, q: 1, ft: 0.25 }, env: { a: 0.01, d: 0.25, s: 0.4, r: 0.15 }, gain: 1.0, width: 0.4, send: 0.25, verb: 0.3 },
  glass:    { oscs: [{ type: 'triangle' }, { type: 'sine', semi: 12, gain: 0.5 }], env: { a: 0.004, d: 0.3, s: 0, r: 0.15 }, gain: 1.8, width: 0.5, send: 0.35, verb: 0.4 },
  bell:     { oscs: [{ type: 'sine', fm: { ratio: 3.5, index: 1.5, decay: 0.4 } }], env: { a: 0.003, d: 0.7, s: 0, r: 0.15 }, gain: 1.2, width: 0.6, send: 0.4, verb: 0.5 },
  epiano:   { oscs: [{ type: 'sine', fm: { ratio: 1, index: 1.5, decay: 0.3 } }, { type: 'sine', semi: 12, gain: 0.2 }], env: { a: 0.005, d: 0.4, s: 0.3, r: 0.2 }, gain: 0.8, width: 0.4, send: 0.3, verb: 0.35 },
  pluck:    { oscs: [{ type: 'triangle' }, { type: 'triangle', semi: 12, gain: 0.4 }], filter: { f0: 5000, f1: 1200, q: 1, ft: 0.3 }, env: { a: 0.003, d: 0.45, s: 0, r: 0.08 }, gain: 2.0, width: 0.3, send: 0.3, verb: 0.4 },
  supersaw: { oscs: [{ type: 'sawtooth', detune: -15 }, { type: 'sawtooth' }, { type: 'sawtooth', detune: 15 }], filter: { f0: 900, f1: 2200, q: 1, ft: 0.4 }, env: { a: 0.04, d: 0.3, s: 0.75, r: 0.25 }, vib: { rate: 5.5, depth: 8, delay: 0.25 }, gain: 0.55, width: 0.5, send: 0.3, verb: 0.35 },
  pad:      { oscs: [{ type: 'sawtooth', detune: -8 }, { type: 'sawtooth', detune: 8, gain: 0.8 }, { type: 'square', semi: -12, gain: 0.3 }], filter: { f0: 500, f1: 1400, q: 1, ft: 1.2 }, env: { a: 0.4, d: 0.5, s: 0.8, r: 0.6 }, gain: 1.5, width: 0.6, verb: 0.5 },
  brass:    { oscs: [{ type: 'sawtooth' }, { type: 'sawtooth', detune: 6, gain: 0.6 }], filter: { f0: 400, f1: 2600, q: 2, ft: 0.12 }, env: { a: 0.03, d: 0.1, s: 0.8, r: 0.12 }, vib: { rate: 5, depth: 5, delay: 0.3 }, gain: 0.7, width: 0.3, send: 0.25, verb: 0.25 },
};
class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.sfxGain = null; this.musicGain = null;
    this.sfxOn = true; this.sfxLevel = 1; this.musicOn = true; this.weaponGain = null; this.musicTimer = null; this.step = 0; this.nextNoteTime = 0;
    this.track = 'menu'; this.song = null; this.stepLen = 0.14; this.musicDelay = null; this.musicVerb = null;
    this.noiseBuf = null; this.lastPlayed = {};
  }
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    // iOS can hand back a new context in 'suspended'; resume it inside this same gesture, and start the
    // music as soon as it actually runs (whichever tap that turns out to be).
    this.ctx.onstatechange = () => {
      if (!this.ctx) return;
      if (this.ctx.state === 'interrupted' && !document.hidden) this.ctx.resume().catch(() => {});
      if (this.ctx.state === 'running' && this.musicOn && !this.musicTimer && !document.hidden) this.startMusic();
    };
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxOn ? this.sfxLevel * SFX_SCALE : 0; this.sfxGain.connect(this.master);
    // Weapon fire is the repetitive stuff; it gets its own quieter, low-passed bus.
    this.weaponGain = this.ctx.createGain(); this.weaponGain.gain.value = 0.45; const wlp = this.ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 2600; this.weaponGain.connect(wlp); wlp.connect(this.sfxGain);
    // Music bus: voices -> musicGain -> soft compressor -> trim -> master. The toggle and track-switch dip act on musicGain.
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicOn ? MUSIC_LEVEL : 0;
    const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 15; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    // The compressor adds ~5 dB of makeup gain; trim it back so the music keeps its level against the SFX.
    const trim = this.ctx.createGain(); trim.gain.value = 0.56;
    this.musicGain.connect(comp); comp.connect(trim); trim.connect(this.master);
    // Reverb: a generated 1.8 s decaying-noise impulse through a convolver, darkened, fed by patch `verb` sends.
    const sr = this.ctx.sampleRate, vlen = Math.floor(sr * 1.8), ir = this.ctx.createBuffer(2, vlen, sr);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < vlen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / vlen, 2) * Math.exp(-i / (sr * 0.45)); }
    this.musicVerb = this.ctx.createConvolver(); this.musicVerb.buffer = ir;
    const vlp = this.ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 3500; const vg = this.ctx.createGain(); vg.gain.value = 0.6;
    this.musicVerb.connect(vlp); vlp.connect(vg); vg.connect(this.musicGain);
    // Tempo-synced feedback delay the music patches send to (delayTime is set per song).
    this.musicDelay = this.ctx.createDelay(1); this.musicDelay.delayTime.value = 0.3;
    const dfb = this.ctx.createGain(); dfb.gain.value = 0.3; const dlp = this.ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
    this.musicDelay.connect(dlp); dlp.connect(dfb); dfb.connect(this.musicDelay); dlp.connect(this.musicGain);
    const len = this.ctx.sampleRate * 1;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  // level: 1 = full, 0.5 = low, 0 = off
  // FULL (1) maps to 60% of the bus so effects sit a little above the music rather than three times it.
  setSfx(level) { const v = level === true ? 1 : level === false ? 0 : Number(level); this.sfxLevel = v > 0 ? v : this.sfxLevel; this.sfxOn = v > 0; if (this.sfxGain) this.sfxGain.gain.value = v * SFX_SCALE; }
  setMusic(on) { this.musicOn = on; this.musicLevel(on ? MUSIC_LEVEL : 0); if (on) this.startMusic(); else this.stopMusic(); }
  // Set the music bus level, cancelling any ramp the track switch scheduled.
  musicLevel(v) {
    if (!this.musicGain) return;
    const g = this.musicGain.gain; const now = this.ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.setValueAtTime(v, now);
  }

  tone({ f = 440, f2 = null, type = 'square', dur = 0.1, vol = 0.3, attack = 0.005, decay = null, dest = null, delay = 0, at = null, detune = 0 }) {
    if (!this.ctx) return;
    const t0 = at !== null ? Math.max(at, this.ctx.currentTime) : this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (detune) o.detune.value = detune;
    if (f2 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay || dur));
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t0); o.stop(t0 + (decay || dur) + 0.02);
  }
  noise({ dur = 0.2, vol = 0.3, hp = 200, lp = 8000, delay = 0, dest = null, at = null }) {
    if (!this.ctx) return;
    const t0 = at !== null ? Math.max(at, this.ctx.currentTime) : this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const h = this.ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
    const l = this.ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
    s.connect(h); h.connect(l); l.connect(g); g.connect(dest || this.sfxGain); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  // Rate-limit spammy sfx so 20 turrets don't clip the mix.
  throttle(key, ms) { const n = performance.now(); if (this.lastPlayed[key] && n - this.lastPlayed[key] < ms) return false; this.lastPlayed[key] = n; return true; }

  // Play one note on a music patch: layered oscillators -> optional swept lowpass -> ADSR gain.
  voice(name, f, t, dur, vol, dest) {
    const p = PATCHES[name] || PATCHES.supersaw; const ctx = this.ctx; const e = p.env;
    const out = ctx.createGain(); const g = out.gain; const v = vol * (p.gain || 1);
    const tA = t + e.a, tD = tA + e.d, hold = Math.max(t + dur, tD), tEnd = hold + e.r;
    const sus = Math.max(v * e.s, 0.0001);
    g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(v, tA); g.exponentialRampToValueAtTime(sus, tD);
    g.setValueAtTime(sus, hold); g.exponentialRampToValueAtTime(0.0001, tEnd);
    let input = out;
    if (p.filter) {
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = p.filter.q;
      fl.frequency.setValueAtTime(p.filter.f0, t); fl.frequency.exponentialRampToValueAtTime(p.filter.f1, t + p.filter.ft);
      fl.connect(out); input = fl;
    }
    let lfo = null;
    if (p.vib) {
      const o = ctx.createOscillator(); o.frequency.value = p.vib.rate; lfo = ctx.createGain();
      lfo.gain.setValueAtTime(0, t); lfo.gain.linearRampToValueAtTime(p.vib.depth, t + p.vib.delay);
      o.connect(lfo); o.start(t); o.stop(tEnd + 0.02);
    }
    const canPan = p.width && ctx.createStereoPanner;
    p.oscs.forEach((o, i) => {
      const osc = ctx.createOscillator(); osc.type = o.type; const of = f * Math.pow(2, (o.semi || 0) / 12);
      osc.frequency.value = of; if (o.detune) osc.detune.value = o.detune; if (lfo) lfo.connect(osc.detune);
      if (o.fm) {
        const mod = ctx.createOscillator(); mod.frequency.value = of * o.fm.ratio; const mg = ctx.createGain();
        mg.gain.setValueAtTime(of * o.fm.index, t); mg.gain.exponentialRampToValueAtTime(of * o.fm.index * 0.02, t + o.fm.decay);
        mod.connect(mg); mg.connect(osc.frequency); mod.start(t); mod.stop(tEnd + 0.02);
      }
      let node = osc;
      if (o.gain !== undefined && o.gain !== 1) { const og = ctx.createGain(); og.gain.value = o.gain; osc.connect(og); node = og; }
      if (canPan) { const pan = ctx.createStereoPanner(); pan.pan.value = p.width * (p.oscs.length > 1 ? (i % 2 ? 1 : -1) : Math.sin(f)); node.connect(pan); node = pan; }
      node.connect(input);
      osc.start(t); osc.stop(tEnd + 0.02);
    });
    out.connect(dest);
    if (p.send && this.musicDelay) { const sg = ctx.createGain(); sg.gain.value = p.send; out.connect(sg); sg.connect(this.musicDelay); }
    if (p.verb && this.musicVerb) { const vg = ctx.createGain(); vg.gain.value = p.verb; out.connect(vg); vg.connect(this.musicVerb); }
  }
  // Schedule one sequencer step (bass, arp, lead, drum) of the current song at time t.
  playStep(ev, t) {
    const song = this.song, v = song.voices, stepLen = this.stepLen, m = this.musicGain;
    const hz = semi => song.root * Math.pow(2, semi / 12);
    if (ev.bass) this.voice(v.bass, hz(ev.bass.semi), t, stepLen * ev.bass.len * 0.8, 0.2, m);
    if (ev.arp !== null) this.voice(v.arp, hz(ev.arp), t, stepLen * 0.8, 0.12, m);
    if (ev.lead) this.voice(v.lead, hz(ev.lead.semi), t, stepLen * ev.lead.len * 0.9, 0.25, m);
    const d = ev.drum;
    if (d === 'k' || d === 'K') { this.tone({ f: 160, f2: 45, type: 'sine', dur: 0.2, vol: 0.45, dest: m, at: t }); this.noise({ dur: 0.012, vol: 0.12, hp: 1500, lp: 6000, dest: m, at: t }); }
    if (d === 's' || d === 'S') { this.noise({ dur: 0.12, vol: 0.16, hp: 900, lp: 6000, dest: m, at: t }); this.tone({ f: 190, f2: 120, type: 'triangle', dur: 0.09, vol: 0.2, dest: m, at: t }); this.noise({ dur: 0.1, vol: 0.08, hp: 900, lp: 5000, dest: this.musicVerb, at: t }); }
    if (d === 'h' || d === 'K' || d === 'S') this.noise({ dur: 0.045, vol: 0.05, hp: 8000, lp: 11000, dest: m, at: t });
    if (d === 'o') this.noise({ dur: 0.16, vol: 0.045, hp: 6500, lp: 11000, dest: m, at: t });
  }

  play(name) {
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'shoot': if (this.throttle('shoot', 110)) { this.noise({ dur: 0.035, vol: 0.25, hp: 800, lp: 3000, dest: this.weaponGain }); this.tone({ f: 220, f2: 90, type: 'triangle', dur: 0.04, vol: 0.12, dest: this.weaponGain }); } break;
      case 'sniper': if (this.throttle('sniper', 150)) { this.tone({ f: 160, f2: 50, type: 'triangle', dur: 0.16, vol: 0.3, dest: this.weaponGain }); this.noise({ dur: 0.1, vol: 0.2, hp: 600, lp: 2500, dest: this.weaponGain }); } break;
      case 'zap': if (this.throttle('zap', 160)) { this.tone({ f: 700, f2: 180, type: 'triangle', dur: 0.08, vol: 0.18, dest: this.weaponGain }); this.noise({ dur: 0.05, vol: 0.12, hp: 1200, lp: 4000, dest: this.weaponGain }); } break;
      case 'rocket': if (this.throttle('rocket', 200)) this.tone({ f: 100, f2: 320, type: 'triangle', dur: 0.22, vol: 0.2, dest: this.weaponGain }); break;
      case 'boom': if (this.throttle('boom', 120)) { this.noise({ dur: 0.4, vol: 0.5, hp: 60, lp: 900, dest: this.weaponGain }); this.tone({ f: 80, f2: 30, type: 'sine', dur: 0.35, vol: 0.5, dest: this.weaponGain }); } break;
      case 'flame': if (this.throttle('flame', 400)) this.noise({ dur: 0.3, vol: 0.12, hp: 300, lp: 1800, dest: this.weaponGain }); break;
      case 'kill': if (this.throttle('kill', 140)) this.tone({ f: 420, f2: 120, type: 'sine', dur: 0.1, vol: 0.2, dest: this.weaponGain }); break;
      case 'hit': if (this.throttle('hit', 120)) this.noise({ dur: 0.03, vol: 0.08, hp: 1500, dest: this.weaponGain }); break;
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
      // Jacking in. Starts with a click and a mid blip at t=0 so it is audible the instant the button
      // is hit on a phone speaker (nothing below ~300 Hz carries there), then a sweep, data burst,
      // handshake blips and a low thump as the link opens.
      case 'jackin':
        this.noise({ dur: 0.04, vol: 0.15, hp: 3000, lp: 10000 }); this.tone({ f: 1400, f2: 2000, type: 'square', dur: 0.05, vol: 0.12 });
        this.tone({ f: 320, f2: 1200, type: 'sawtooth', dur: 0.28, vol: 0.16 });
        this.noise({ dur: 0.08, vol: 0.1, hp: 2000, lp: 9000, delay: 0.08 });
        [1200, 1600, 2400].forEach((f, i) => this.tone({ f, type: 'square', dur: 0.05, vol: 0.1, delay: 0.14 + i * 0.06 }));
        this.tone({ f: 90, f2: 45, type: 'sine', dur: 0.3, vol: 0.3, delay: 0.22 }); this.noise({ dur: 0.25, vol: 0.1, hp: 80, lp: 700, delay: 0.22 });
        break;
      case 'daemon': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, type: 'square', dur: 0.14, vol: 0.18, delay: i * 0.08 })); break;
      case 'fail': [300, 250, 200].forEach((f, i) => this.tone({ f, type: 'sawtooth', dur: 0.2, vol: 0.2, delay: i * 0.15 })); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ f, type: 'square', dur: 0.3, vol: 0.2, delay: i * 0.12 })); break;
      case 'lose': [400, 300, 200, 100].forEach((f, i) => this.tone({ f, f2: f * 0.7, type: 'sawtooth', dur: 0.4, vol: 0.25, delay: i * 0.25 })); break;
      case 'ap': this.tone({ f: 600, f2: 1200, type: 'triangle', dur: 0.2, vol: 0.2 }); this.tone({ f: 1200, f2: 2400, type: 'triangle', dur: 0.2, vol: 0.15, delay: 0.15 }); break;
      case 'door': this.noise({ dur: 0.25, vol: 0.3, hp: 80, lp: 600 }); this.tone({ f: 80, type: 'square', dur: 0.3, vol: 0.2 }); break;
      case 'stun': this.tone({ f: 2000, f2: 400, type: 'square', dur: 0.2, vol: 0.15 }); break;
    }
  }

  // Synthwave sequencer: plays a song from src/data/music.js (one per district plus 'menu') with a
  // look-ahead timer. Bass, arp and lead are PATCHES voices; kick/snare/hats are sine + filtered noise.
  // track: song id. Omitted = the last requested track, so toggling music back on resumes the right one.
  startMusic(track) {
    const switching = !!track && track !== this.track;
    if (track) this.track = track;
    if (switching) this.stopMusic();
    if (!this.ctx || !this.musicOn || this.musicTimer) return;
    const song = this.song = compileSong(SONGS[this.track] || SONGS.menu);
    const stepLen = this.stepLen = 60 / song.bpm / 4;
    const now = this.ctx.currentTime;
    this.step = 0; this.nextNoteTime = now + (switching ? 0.3 : 0.1);
    this.musicDelay.delayTime.setValueAtTime(stepLen * 6, now);  // dotted eighth
    if (switching) {
      // Dip the bus so the old track's last scheduled notes fade instead of overlapping the new one.
      const g = this.musicGain.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.2); g.setValueAtTime(0, now + 0.3); g.linearRampToValueAtTime(MUSIC_LEVEL, now + 0.6);
    }
    const tick = () => {
      if (!this.ctx) return;
      // If timers stalled (background, throttling), skip ahead instead of bursting every missed note.
      if (this.nextNoteTime < this.ctx.currentTime) this.nextNoteTime = this.ctx.currentTime + 0.05;
      while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
        this.playStep(song.steps[this.step], this.nextNoteTime);
        this.nextNoteTime += stepLen; this.step++;
        if (this.step >= song.steps.length) this.step = song.loopStep;
      }
    };
    this.musicTimer = setInterval(tick, 100);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
  // Backgrounded: silence everything and stop scheduling (throttled timers otherwise stutter the music).
  background() { this.stopMusic(); if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  foreground() { if (!this.ctx) return; this.ctx.resume().catch(() => {}); if (this.musicOn) this.startMusic(); }
}
export const Audio = new AudioEngine();
