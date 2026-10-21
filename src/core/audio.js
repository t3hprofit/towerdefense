// Fully synthesized audio: no asset files. Everything is oscillators + noise through the WebAudio API.
import { SONGS, compileSong } from '../data/music.js';
const SFX_SCALE = 0.6;
const MUSIC_LEVEL = 0.35;
class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.sfxGain = null; this.musicGain = null;
    this.sfxOn = true; this.sfxLevel = 1; this.musicOn = true; this.weaponGain = null; this.musicTimer = null; this.step = 0; this.nextNoteTime = 0;
    this.track = 'menu'; this.song = null;
    this.noiseBuf = null; this.lastPlayed = {};
  }
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    this.ctx.onstatechange = () => { if (this.ctx && this.ctx.state === 'interrupted' && !document.hidden) this.ctx.resume().catch(() => {}); };
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxOn ? this.sfxLevel * SFX_SCALE : 0; this.sfxGain.connect(this.master);
    // Weapon fire is the repetitive stuff; it gets its own quieter, low-passed bus.
    this.weaponGain = this.ctx.createGain(); this.weaponGain.gain.value = 0.45; const wlp = this.ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 2600; this.weaponGain.connect(wlp); wlp.connect(this.sfxGain);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicOn ? MUSIC_LEVEL : 0; this.musicGain.connect(this.master);
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
  // look-ahead timer. Bass, arp and lead are oscillators; kick/snare/hats are sine + filtered noise.
  // track: song id. Omitted = the last requested track, so toggling music back on resumes the right one.
  startMusic(track) {
    const switching = !!track && track !== this.track;
    if (track) this.track = track;
    if (switching) this.stopMusic();
    if (!this.ctx || !this.musicOn || this.musicTimer) return;
    const song = this.song = compileSong(SONGS[this.track] || SONGS.menu);
    const stepLen = 60 / song.bpm / 4; const v = song.voices;
    const hz = semi => song.root * Math.pow(2, semi / 12);
    const now = this.ctx.currentTime;
    this.step = 0; this.nextNoteTime = now + (switching ? 0.3 : 0.1);
    if (switching) {
      // Dip the bus so the old track's last scheduled notes fade instead of overlapping the new one.
      const g = this.musicGain.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.2); g.setValueAtTime(0, now + 0.3); g.linearRampToValueAtTime(MUSIC_LEVEL, now + 0.6);
    }
    const playStep = (ev, t) => {
      const m = this.musicGain;
      if (ev.bass) this.tone({ f: hz(ev.bass.semi), type: v.bass, dur: stepLen * ev.bass.len * 0.8, vol: 0.18, dest: m, at: t });
      if (ev.arp !== null) this.tone({ f: hz(ev.arp), type: v.arp, dur: stepLen * 0.8, vol: 0.05, dest: m, at: t });
      if (ev.lead) {
        const f = hz(ev.lead.semi), dur = stepLen * ev.lead.len * 0.9;
        // Plucked leads decay on their own clock and get a bright octave on the attack.
        const env = v.pluck ? { dur, decay: v.pluck, attack: 0.003 } : { dur, attack: 0.02 };
        this.tone({ f, type: v.lead, ...env, vol: 0.035, detune: 6, dest: m, at: t }); this.tone({ f, type: v.lead, ...env, vol: 0.035, detune: -6, dest: m, at: t });
        if (v.pluck) this.tone({ f: f * 2, type: 'triangle', dur: 0.15, attack: 0.002, vol: 0.02, dest: m, at: t });
      }
      const d = ev.drum;
      if (d === 'k' || d === 'K') this.tone({ f: 160, f2: 45, type: 'sine', dur: 0.2, vol: 0.45, dest: m, at: t });
      if (d === 's' || d === 'S') { this.noise({ dur: 0.12, vol: 0.18, hp: 900, lp: 7000, dest: m, at: t }); this.tone({ f: 200, f2: 120, type: 'triangle', dur: 0.08, vol: 0.2, dest: m, at: t }); }
      if (d === 'h' || d === 'K' || d === 'S') this.noise({ dur: 0.035, vol: 0.07, hp: 7000, lp: 12000, dest: m, at: t });
      if (d === 'o') this.noise({ dur: 0.14, vol: 0.06, hp: 6000, lp: 12000, dest: m, at: t });
    };
    const tick = () => {
      if (!this.ctx) return;
      // If timers stalled (background, throttling), skip ahead instead of bursting every missed note.
      if (this.nextNoteTime < this.ctx.currentTime) this.nextNoteTime = this.ctx.currentTime + 0.05;
      while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
        playStep(song.steps[this.step], this.nextNoteTime);
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
