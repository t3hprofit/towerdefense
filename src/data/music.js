// Music: one synthwave song per district plus a menu track, all played by the sequencer in
// src/core/audio.js. Songs are data so a tune can be changed without touching the synth.
//
// Song format
//   bpm       tempo; one step is a 16th note (4 per beat, 16 per bar).
//   root      Hz of the song's tonic in the bass register (A1 = 55).
//   voices    PATCHES names (src/core/audio.js) for the bass, arp and lead.
//   sections  name -> {
//     chords  one [semitones from root, 'm' | 'M' | '5'] per HALF bar (8 steps), so 8 entries =
//             4 bars. '5' is an open fifth (no third).
//     bass    16-char pattern per bar, repeated: '1' root '3' third '5' fifth '7' flat 7th
//             '8' octave, '.' rest, '_' hold the previous note one more step.
//     arp     chord-tone indices cycled one per step (0 root, 1 third, 2 fifth, 3 octave,
//             4 third+8ve, 5 fifth+8ve); null = no arp. Length need not divide 16 (polymeter).
//     arpFollow  false = arp stays on the section's first chord while the bass moves (the
//             original Watson sound). Default true.
//     arpShift   semitones added to the arp (the original tune jumps +7 every other segment).
//     lead    melody as 'semi:steps' tokens from the lead octave (root x 4), '.' = rest.
//             Tokens are consumed across bars; missing steps are rests.
//     drums   16-char pattern per bar: 'k' kick 's' snare 'h' hat 'o' open hat,
//             'K' kick+hat, 'S' snare+hat, '.' rest. null = no drums.
//   }
//   order     section names in play order. loopFrom is the index the loop returns to.

const WATSON_SECTIONS = {
  // The original loop: Am | C G with the Am arpeggio riding over the bass.
  I: { chords: [[0, 'm'], [0, 'm'], [3, 'M'], [-2, 'M'], [0, 'm'], [0, 'm'], [3, 'M'], [-2, 'M']],
    bass: '1_1_1_1_1_1_1_1_', arp: [0, 1, 2, 3, 2, 1], arpFollow: false, drums: null },
  A: { chords: [[0, 'm'], [0, 'm'], [3, 'M'], [-2, 'M'], [0, 'm'], [0, 'm'], [3, 'M'], [-2, 'M']],
    bass: '1_1_1_1_1_1_1_1_', arp: [0, 1, 2, 3, 2, 1], arpFollow: false, drums: 'K.h.S.h.K.h.S.h.' },
  // The original "up a fifth" segment, now with a lead over it.
  B: { chords: [[0, 'm'], [0, 'm'], [3, 'M'], [-2, 'M'], [0, 'm'], [0, 'm'], [3, 'M'], [-2, 'M']],
    bass: '1_1_1_1_1_1_1_1_', arp: [0, 1, 2, 3, 2, 1], arpFollow: false, arpShift: 7, drums: 'K.h.S.h.K.h.S.ho',
    lead: '12:3 10:1 8:4 7:6 .:2  3:2 5:2 7:4 .:2 7:2 5:2 2:2  0:6 .:2 3:2 5:2 7:4  8:4 7:4 5:2 3:2 2:4' },
  // Bridge: F G Am E, the arp follows the chords for the first time.
  C: { chords: [[-4, 'M'], [-4, 'M'], [-2, 'M'], [-2, 'M'], [0, 'm'], [0, 'm'], [7, 'M'], [7, 'M']],
    bass: '1_1_1_1_1_1_8_1_', arp: [0, 2, 3, 2], drums: 'K.h.S.h.K.h.S.hh',
    lead: '8:4 12:4 15:4 12:4  10:4 14:4 17:4 14:4  12:4 15:2 17:2 19:8  19:4 14:4 11:4 .:4' },
  // Chorus: Am F C G with the hook.
  D: { chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-4, 'M'], [3, 'M'], [3, 'M'], [-2, 'M'], [-2, 'M']],
    bass: '1_1_1_1_1_1_8_1_', arp: [0, 1, 2, 3, 2, 1], drums: 'K.h.S.hhK.h.S.ho',
    lead: '12:2 .:2 12:2 15:2 17:4 15:2 12:2  8:2 .:2 8:2 12:2 15:4 12:2 8:2  7:2 .:2 7:2 10:2 12:4 10:2 7:2  10:4 7:4 5:4 2:4' },
};

export const SONGS = {
  // Main menu and district select: the Watson theme without drums.
  menu: {
    bpm: 107, root: 55, voices: { bass: 'fatbass', arp: 'bell', lead: 'supersaw' },
    sections: { I: WATSON_SECTIONS.I, B: { ...WATSON_SECTIONS.B, drums: null }, D: { ...WATSON_SECTIONS.D, drums: null } },
    order: ['I', 'B', 'I', 'D'], loopFrom: 0,
  },
  // Watson: the original A minor loop, grown into a full tune.
  watson: {
    bpm: 107, root: 55, voices: { bass: 'fatbass', arp: 'pwm', lead: 'supersaw' },
    sections: WATSON_SECTIONS,
    order: ['I', 'A', 'B', 'A', 'B', 'C', 'D', 'D', 'B'], loopFrom: 1,
  },
  // Westbrook: Japantown. The in (miyako-bushi) scale D Eb G A Bb with its minor-second step,
  // open-fifth chords instead of triads, a plucked koto-style lead with grace notes and tremolo,
  // and a sparse taiko-like kick pattern.
  westbrook: {
    bpm: 118, root: 73.42, voices: { bass: 'fatbass', arp: 'glass', lead: 'pluck' },
    sections: {
      I: { chords: [[0, '5'], [0, '5'], [0, '5'], [0, '5'], [0, '5'], [0, '5'], [1, '5'], [0, '5']],
        bass: '1___1_..1___1_8_', arp: [0, 2, 3, 4], drums: null,
        lead: '12:3 13:1 12:4 7:4 5:4  .:4 8:2 7:2 5:2 7:2 .:4  12:1 12:1 12:1 12:1 13:2 12:2 8:4 7:4  8:2 13:2 12:8 .:4' },
      A: { chords: [[0, '5'], [0, '5'], [1, '5'], [0, '5'], [5, '5'], [5, '5'], [7, '5'], [7, '5']],
        bass: '1_1_1.1_1_1_8.1_', arp: [0, 2, 3, 4, 3, 2], drums: 'K.h.k.h.S.h.k.ho' },
      B: { chords: [[0, '5'], [0, '5'], [1, '5'], [0, '5'], [5, '5'], [5, '5'], [7, '5'], [7, '5']],
        bass: '1_1_1.1_1_1_8.1_', arp: [0, 2, 3, 4, 3, 2], drums: 'K.h.k.h.S.h.k.ho',
        lead: '12:3 13:1 12:4 .:2 7:2 5:2 7:2  8:2 13:2 12:4 .:1 12:1 12:1 12:1 .:4  5:2 7:2 8:4 7:2 5:2 .:4  7:2 8:2 7:2 5:2 1:4 0:4' },
      C: { chords: [[-4, '5'], [-4, '5'], [5, '5'], [5, '5'], [1, '5'], [1, '5'], [7, '5'], [7, '5']],
        bass: '1_1_1_1_1_1_8_5_', arp: [0, 2, 3, 2], drums: 'K.hhk.h.S.hhk.ho',
        lead: '20:3 19:1 17:4 20:2 19:2 17:4  17:2 19:2 20:2 24:2 20:4 19:4  25:1 24:3 25:1 24:3 20:4 19:4  19:2 17:2 13:2 12:2 7:8' },
      D: { chords: [[0, '5'], [0, '5'], [-4, '5'], [-4, '5'], [5, '5'], [7, '5'], [1, '5'], [0, '5']],
        bass: '1_1_1.1_1_1_8.1_', arp: [0, 2, 3, 4, 3, 2], drums: 'K.h.k.hhS.h.k.ho',
        lead: '12:1 12:1 12:2 17:2 19:2 20:4 19:2 17:2  20:1 20:1 20:2 19:2 17:2 12:4 13:2 12:2  17:4 19:4 20:2 19:2 17:2 19:2  25:1 24:3 20:4 13:2 12:6' },
    },
    order: ['I', 'A', 'B', 'A', 'B', 'C', 'D', 'D', 'B'], loopFrom: 1,
  },
  // Heywood: slower, F# phrygian with a tresillo bass for the Valentinos' turf.
  heywood: {
    bpm: 100, root: 46.25, voices: { bass: 'fatbass', arp: 'epiano', lead: 'brass' },
    sections: {
      I: { chords: [[0, 'm'], [0, 'm'], [1, 'M'], [1, 'M'], [0, 'm'], [0, 'm'], [1, 'M'], [1, 'M']],
        bass: '1__1__1_1__1__5_', arp: [0, 2, 3, 2], drums: null },
      A: { chords: [[0, 'm'], [0, 'm'], [1, 'M'], [1, 'M'], [0, 'm'], [0, 'm'], [10, 'M'], [10, 'M']],
        bass: '1__1__1_1__1__5_', arp: [0, 1, 2, 3, 2, 1], drums: 'K.hhS.h.K.hhS.hh' },
      B: { chords: [[0, 'm'], [0, 'm'], [1, 'M'], [1, 'M'], [0, 'm'], [0, 'm'], [10, 'M'], [10, 'M']],
        bass: '1__1__1_1__1__5_', arp: [0, 1, 2, 3, 2, 1], drums: 'K.hhS.h.K.hhS.ho',
        lead: '12:3 13:1 12:4 7:4 .:4  13:2 15:2 13:2 12:2 10:4 .:4  7:2 8:2 7:2 5:2 3:4 .:4  3:2 5:2 7:2 10:2 12:8' },
      C: { chords: [[5, 'm'], [5, 'm'], [7, 'M'], [7, 'M'], [0, 'm'], [0, 'm'], [1, 'M'], [1, 'M']],
        bass: '1__1__1_1__1__8_', arp: [0, 2, 3, 2], drums: 'K.hhS.h.K.h.S.hh',
        lead: '17:2 15:2 13:2 12:2 10:4 12:4  11:4 7:4 .:4 11:4  12:2 15:2 19:4 15:2 12:2 8:4  7:2 8:2 7:2 3:2 1:8' },
      D: { chords: [[0, 'm'], [0, 'm'], [1, 'M'], [1, 'M'], [3, 'M'], [3, 'M'], [10, 'M'], [10, 'M']],
        bass: '1__1__1_1__1__5_', arp: [0, 1, 2, 3, 2, 1], drums: 'K.hhS.hhK.hhS.ho',
        lead: '12:2 .:2 12:2 15:2 19:4 15:2 12:2  13:2 .:2 13:2 15:2 19:4 15:2 13:2  15:4 19:2 22:2 24:4 22:2 19:2  22:4 19:4 15:4 12:4' },
    },
    order: ['I', 'A', 'B', 'A', 'B', 'C', 'D', 'D', 'B'], loopFrom: 1,
  },
  // Santo Domingo: industrial techno, C minor, straight eighths and short stabs.
  santo: {
    bpm: 128, root: 65.41, voices: { bass: 'acidbass', arp: 'pwm', lead: 'brass' },
    sections: {
      I: { chords: [[0, 'm'], [0, 'm'], [0, 'm'], [0, 'm'], [0, 'm'], [0, 'm'], [-2, 'M'], [-2, 'M']],
        bass: '1.1.1.1.1.1.1.1.', arp: [0, 3, 0, 3, 2, 3, 0, 2], drums: null },
      A: { chords: [[0, 'm'], [0, 'm'], [0, 'm'], [0, 'm'], [-4, 'M'], [-4, 'M'], [-2, 'M'], [-2, 'M']],
        bass: '1.1.1.1.1.1.1.8.', arp: [0, 3, 0, 3, 2, 3, 0, 2], drums: 'K.h.S.h.K.h.S.h.' },
      B: { chords: [[0, 'm'], [0, 'm'], [0, 'm'], [0, 'm'], [-4, 'M'], [-4, 'M'], [-2, 'M'], [-2, 'M']],
        bass: '1.1.1.1.1.1.1.8.', arp: [0, 3, 0, 3, 2, 3, 0, 2], drums: 'K.h.S.h.K.h.S.hh',
        lead: '12:1 .:3 12:1 .:3 15:1 .:3 12:1 .:1 10:1 .:1  12:1 .:3 12:1 .:3 15:1 .:3 17:1 .:1 15:1 .:1  8:1 .:3 8:1 .:3 12:1 .:3 15:1 .:3  10:1 .:3 10:1 .:3 14:1 .:3 17:1 .:1 14:1 .:1' },
      C: { chords: [[5, 'm'], [5, 'm'], [5, 'm'], [5, 'm'], [-5, 'M'], [-5, 'M'], [-5, 'M'], [-5, 'M']],
        bass: '1.1.1.1.1.1.1111', arp: [0, 2, 3, 2], drums: 'K.hhS.h.K.hhS.hh',
        lead: '17:2 20:2 24:4 20:2 17:2 15:4  17:2 20:2 24:4 20:2 17:2 12:4  19:2 23:2 26:4 23:2 19:2 14:4  19:4 .:4 23:4 26:4' },
      D: { chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-4, 'M'], [-2, 'M'], [-2, 'M'], [-5, 'M'], [-5, 'M']],
        bass: '1.1.1.1.1.1.1.8.', arp: [0, 3, 0, 3, 2, 3, 0, 2], drums: 'K.h.S.hhK.h.S.ho',
        lead: '12:4 15:2 17:2 19:4 17:2 15:2  12:4 15:2 17:2 20:4 17:2 15:2  14:4 17:2 19:2 22:4 19:2 17:2  19:4 .:2 19:2 23:4 26:4' },
    },
    order: ['I', 'A', 'A', 'B', 'B', 'C', 'D', 'D', 'B'], loopFrom: 1,
  },
  // Pacifica: slow, half-time, G minor, soft voices and a minor-second lead for the Voodoo Boys.
  pacifica: {
    bpm: 92, root: 49, voices: { bass: 'subbass', arp: 'bell', lead: 'epiano' },
    sections: {
      I: { chords: [[0, 'm'], [0, 'm'], [0, 'm'], [0, 'm'], [8, 'M'], [8, 'M'], [7, 'M'], [7, 'M']],
        bass: '1___1__.1___..1.', arp: [0, 2, 1, 3], drums: null },
      A: { chords: [[0, 'm'], [0, 'm'], [8, 'M'], [8, 'M'], [0, 'm'], [0, 'm'], [7, 'M'], [7, 'M']],
        bass: '1___1__.1___..1.', arp: [0, 2, 1, 3], drums: 'K.hh..h.S.h...hh' },
      B: { chords: [[0, 'm'], [0, 'm'], [8, 'M'], [8, 'M'], [0, 'm'], [0, 'm'], [7, 'M'], [7, 'M']],
        bass: '1___1__.1___..1.', arp: [0, 2, 1, 3], drums: 'K.hh..h.S.h...hh',
        lead: '19:3 20:1 19:4 .:8  15:3 14:1 15:4 .:8  12:2 15:2 19:2 20:2 19:4 15:4  14:4 11:4 7:8' },
      C: { chords: [[5, 'm'], [5, 'm'], [5, 'm'], [5, 'm'], [3, 'M'], [3, 'M'], [-2, 'M'], [-2, 'M']],
        bass: '1___1__.1___..8.', arp: [0, 2, 3, 2], drums: 'K.hh..h.S.hh.hhh',
        lead: '17:4 20:4 24:4 20:4  17:4 20:4 19:4 15:4  15:4 17:2 19:2 22:4 19:4  22:3 24:1 22:4 17:8' },
      D: { chords: [[0, 'm'], [0, 'm'], [3, 'M'], [3, 'M'], [8, 'M'], [8, 'M'], [7, 'M'], [7, 'M']],
        bass: '1___1__.1___..1.', arp: [0, 2, 1, 3], drums: 'K.hh..h.S.hh.hhh',
        lead: '24:4 22:2 20:2 19:4 15:4  17:4 15:2 17:2 19:8  20:4 19:2 17:2 15:4 12:4  14:3 15:1 14:4 7:8' },
    },
    order: ['I', 'A', 'B', 'A', 'B', 'C', 'D', 'D', 'B'], loopFrom: 1,
  },
  // City Center: fast B minor with an octave bass and a soaring hook for Arasaka Tower.
  center: {
    bpm: 132, root: 61.74, voices: { bass: 'octbass', arp: 'glass', lead: 'supersaw' },
    sections: {
      I: { chords: [[0, 'm'], [0, 'm'], [0, 'm'], [0, 'm'], [-4, 'M'], [-4, 'M'], [-2, 'M'], [-2, 'M']],
        bass: '1_1_1_1_1_1_1_1_', arp: [0, 2, 3, 2], drums: null },
      A: { chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-4, 'M'], [3, 'M'], [3, 'M'], [-2, 'M'], [-2, 'M']],
        bass: '1.8.1.8.1.8.1.8.', arp: [0, 2, 3, 2], drums: 'K.h.S.h.K.h.S.h.' },
      B: { chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-4, 'M'], [3, 'M'], [3, 'M'], [-2, 'M'], [-2, 'M']],
        bass: '1.8.1.8.1.8.1.8.', arp: [0, 2, 3, 2], drums: 'K.h.S.h.K.h.S.hh',
        lead: '12:4 14:2 15:2 19:4 15:2 14:2  12:4 14:2 15:2 20:4 19:2 15:2  10:4 12:2 14:2 17:4 15:2 14:2  14:4 12:4 10:4 .:4' },
      C: { chords: [[5, 'm'], [5, 'm'], [-5, 'M'], [-5, 'M'], [0, 'm'], [0, 'm'], [-5, 'M'], [-5, 'M']],
        bass: '1_1_1_1_1.8.1.8.', arp: [0, 1, 2, 3, 2, 1], drums: 'K.h.S.h.K.hhS.ho',
        lead: '17:4 20:4 24:4 20:4  19:4 23:4 26:4 23:4  24:4 22:2 20:2 19:4 15:4  14:4 11:4 7:8' },
      D: { chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-4, 'M'], [3, 'M'], [3, 'M'], [-2, 'M'], [-2, 'M']],
        bass: '1.8.1.8.1.8.1.8.', arp: [0, 2, 3, 2], drums: 'K.h.S.hhK.h.S.ho',
        lead: '19:2 .:2 19:2 20:2 22:4 20:2 19:2  15:2 .:2 15:2 17:2 19:4 17:2 15:2  14:2 .:2 14:2 15:2 17:4 15:2 14:2  12:4 14:4 15:4 17:4' },
    },
    order: ['I', 'A', 'B', 'A', 'B', 'C', 'D', 'D', 'B'], loopFrom: 1,
  },
};

const CHORD_TONES = { m: [0, 3, 7, 12, 15, 19], M: [0, 4, 7, 12, 16, 19], 5: [0, 7, 12, 19, 24, 31] };
const BASS_DEG = { 1: 0, 5: 7, 7: 10, 8: 12 };

// Flatten a song into one entry per step so the sequencer only indexes an array.
// Each step: { bass: {semi, len} | null, arp: semi | null, lead: {semi, len} | null, drum: char }.
// Semitones are relative to song.root; arp and lead already include their octave offset.
export function compileSong(song) {
  const steps = []; let loopStep = 0; const warnings = [];
  song.order.forEach((name, oi) => {
    if (oi === song.loopFrom) loopStep = steps.length;
    const sec = song.sections[name]; const total = sec.chords.length * 8;
    const toks = (sec.lead || '').trim().split(/\s+/).filter(Boolean);
    const leadAt = []; let pos = 0;
    for (const tk of toks) { const [n, l] = tk.split(':'); const len = Number(l); if (n !== '.') leadAt[pos] = { semi: Number(n) + 24, len }; pos += len; }
    if (pos > total) warnings.push(`${name}: lead is ${pos} steps, section is ${total}`);
    for (let s = 0; s < total; s++) {
      const [cRoot, q] = sec.chords[Math.floor(s / 8)];
      const tones = CHORD_TONES[q]; const i = s % 16;
      let bass = null; const bc = sec.bass[i];
      if (bc !== '.' && bc !== '_') { let len = 1; while (i + len < 16 && sec.bass[i + len] === '_') len++; bass = { semi: cRoot + (bc === '3' ? tones[1] : BASS_DEG[bc]), len }; }
      let arp = null;
      if (sec.arp) { const [aRoot, aq] = sec.arpFollow === false ? sec.chords[0] : [cRoot, q]; arp = aRoot + CHORD_TONES[aq][sec.arp[s % sec.arp.length]] + 24 + (sec.arpShift || 0); }
      steps.push({ bass, arp, lead: leadAt[s] || null, drum: sec.drums ? sec.drums[i] : '.' });
    }
  });
  return { bpm: song.bpm, root: song.root, voices: song.voices, loopStep, steps, warnings };
}
