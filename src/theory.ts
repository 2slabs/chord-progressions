// Pure music theory: scales, diatonic chords, progression generation, voicing.
// No Live or DOM dependencies, so it runs in the extension, the dialog, and tests.

export const SCALES: Record<string, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  "Melodic Minor": [0, 2, 3, 5, 7, 9, 11],
};

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
// Major keys conventionally spelled with flats: F B♭ E♭ A♭ D♭ G♭.
const FLAT_MAJOR_KEYS = new Set([5, 10, 3, 8, 1, 6]);

export const ROOT_LABELS = SHARP_NAMES.map((s, i) => (s === FLAT_NAMES[i] ? s : `${s} / ${FLAT_NAMES[i]}`));

/** Note names for a key: flats or sharps depending on the relative major. */
export function noteNames(root: number, intervals: number[]): string[] {
  const minorish = intervals.includes(3) && !intervals.includes(4);
  const relativeMajor = (root + (minorish ? 3 : 0)) % 12;
  return FLAT_MAJOR_KEYS.has(relativeMajor) ? FLAT_NAMES : SHARP_NAMES;
}

const QUALITIES: Record<string, string> = {
  "4,7": "",
  "3,7": "m",
  "3,6": "°",
  "4,8": "+",
  "2,7": "sus2",
  "5,7": "sus4",
  "4,7,11": "maj7",
  "4,7,10": "7",
  "3,7,10": "m7",
  "3,6,10": "ø7",
  "3,6,9": "°7",
  "3,7,11": "m(maj7)",
  "4,8,11": "+maj7",
  "4,8,10": "+7",
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

export interface Chord {
  degree: number;
  /** Semitones of the chord root above the key root (0–11). */
  root: number;
  /** Chord tones as semitones above the chord root, ascending, starting at 0. */
  tones: number[];
  /** e.g. "Am7" */
  name: string;
  /** e.g. "vi7"; degree number for non-heptatonic scales. */
  numeral: string;
}

/** Stack every other scale tone from `degree`: 3 notes for a triad, 4 for a seventh. */
export function buildChord(keyRoot: number, intervals: number[], degree: number, seventh: boolean): Chord {
  const n = intervals.length;
  const abs: number[] = [];
  for (let k = 0; k < (seventh ? 4 : 3); k++) {
    const idx = degree + 2 * k;
    abs.push(intervals[idx % n] + 12 * Math.floor(idx / n));
  }
  const tones = abs.map((t) => t - abs[0]);
  const root = abs[0] % 12;
  const key = tones.slice(1).join(",");
  const quality = QUALITIES[key] ?? `(${key})`;
  const names = noteNames(keyRoot, intervals);
  return {
    degree,
    root,
    tones,
    name: names[(keyRoot + root) % 12] + quality,
    numeral: n === 7 ? numeral(degree, tones, quality) : String(degree + 1),
  };
}

function numeral(degree: number, tones: number[], quality: string): string {
  const minorThird = tones[1] === 3;
  const base = minorThird ? ROMAN[degree].toLowerCase() : ROMAN[degree];
  if (quality === "" || quality === "m") return base;
  if (quality === "m7") return base + "7";
  if (quality === "m(maj7)") return base + "(maj7)";
  return base + quality;
}

// Tonal tendencies between scale degrees (rows: from, cols: to), roughly
// tonic → predominant → dominant → tonic. Diagonal is 0: no immediate repeats.
const TRANSITIONS: number[][] = [
  //  I    ii   iii  IV   V    vi   vii
  [0, 15, 5, 30, 25, 25, 2], // I
  [10, 0, 5, 10, 50, 10, 10], // ii
  [10, 10, 0, 30, 5, 45, 0], // iii
  [25, 10, 5, 0, 35, 15, 5], // IV
  [50, 2, 5, 15, 0, 28, 0], // V
  [10, 25, 10, 35, 20, 0, 0], // vi
  [60, 0, 20, 0, 0, 20, 0], // vii
];

export type Rng = () => number;

function pick(weights: number[], rng: Rng): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(rng() * weights.length);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

function transition(n: number, from: number, to: number): number {
  if (from === to) return 0;
  if (n === 7) return TRANSITIONS[from][to];
  return to === 0 ? 2 : 1; // other scales: wander, with a pull home
}

/** Diminished/augmented triads sound unstable in pop contexts; use them sparingly. */
function stability(keyRoot: number, intervals: number[], degree: number): number {
  const q = buildChord(keyRoot, intervals, degree, false).tones[2];
  return q === 7 ? 1 : 0.1;
}

export interface Step {
  degree: number;
  seventh: boolean;
}

export type SeventhMode = "none" | "all" | "mixed";

export function rollSeventh(mode: SeventhMode, rng: Rng): boolean {
  return mode === "all" || (mode === "mixed" && rng() < 0.4);
}

export function generate(
  keyRoot: number,
  intervals: number[],
  count: number,
  sevenths: SeventhMode,
  rng: Rng = Math.random,
): Step[] {
  const n = intervals.length;
  const stab = intervals.map((_, d) => stability(keyRoot, intervals, d));
  // Usually open on the tonic; otherwise IV or vi (any stable degree for other scales).
  const openers = intervals.map((_, d) => (d === 0 ? 0 : n === 7 ? (d === 3 || d === 5 ? 1 : 0) : stab[d]));
  const degrees: number[] = [rng() < 0.75 ? 0 : pick(openers, rng)];
  for (let i = 1; i < count; i++) {
    const prev = degrees[i - 1];
    const last = i === count - 1;
    const weights = intervals.map((_, d) => {
      let w = transition(n, prev, d) * stab[d];
      // End on something that leads back to the first chord so the clip loops.
      if (last && count > 2) w *= d === degrees[0] ? 0 : transition(n, d, degrees[0]) / 10 + 0.1;
      return w;
    });
    degrees.push(pick(weights, rng));
  }
  return degrees.map((degree) => ({ degree, seventh: rollSeventh(sevenths, rng) }));
}

/** Re-pick one step so it still connects to its neighbours (wrapping, since clips loop). */
export function reroll(
  keyRoot: number,
  intervals: number[],
  steps: Step[],
  index: number,
  sevenths: SeventhMode,
  rng: Rng = Math.random,
): Step[] {
  const n = intervals.length;
  const prev = steps[(index - 1 + steps.length) % steps.length].degree;
  const next = steps[(index + 1) % steps.length].degree;
  const current = steps[index].degree;
  const weights = intervals.map((_, d) => {
    if (d === current || (steps.length > 1 && (d === prev || d === next))) return 0;
    return (transition(n, prev, d) + 1) * (transition(n, d, next) + 1) * stability(keyRoot, intervals, d);
  });
  const out = steps.slice();
  out[index] = { degree: pick(weights, rng), seventh: rollSeventh(sevenths, rng) };
  return out;
}

export interface VoicingOptions {
  /** MIDI pitch the voicings gravitate around (e.g. 60 = C3 in Live). */
  center: number;
  /** Pick inversions that minimise movement between chords. */
  smooth: boolean;
  /** Add the chord root an octave or two below. */
  bass: boolean;
}

function candidates(keyRoot: number, chord: Chord, center: number): number[][] {
  const out: number[][] = [];
  const base = keyRoot + chord.root;
  for (let inv = 0; inv < chord.tones.length; inv++) {
    const shape = chord.tones.map((t, i) => (i < inv ? t + 12 : t)).sort((a, b) => a - b);
    for (let oct = -4; oct <= 4; oct++) {
      const v = shape.map((t) => base + t + 12 * oct);
      if (v[0] >= center - 9 && v[0] <= center + 5) out.push(v);
    }
  }
  return out;
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

function distance(a: number[], b: number[]): number {
  const near = (x: number, set: number[]) => Math.min(...set.map((y) => Math.abs(x - y)));
  return a.reduce((s, x) => s + near(x, b), 0) + b.reduce((s, y) => s + near(y, a), 0);
}

/** Absolute MIDI pitches for each chord. */
export function voice(keyRoot: number, chords: Chord[], opts: VoicingOptions): number[][] {
  const result: number[][] = [];
  let prev: number[] | null = null;
  for (const chord of chords) {
    const options = candidates(keyRoot, chord, opts.center);
    let best = options[0];
    let bestCost = Infinity;
    for (const v of options) {
      const rootPosition = v[0] % 12 === (keyRoot + chord.root) % 12;
      const drift = Math.abs(mean(v) - opts.center);
      const cost =
        opts.smooth && prev
          ? distance(v, prev) + 0.4 * drift
          : (rootPosition ? 0 : 100) + drift;
      if (cost < bestCost) {
        bestCost = cost;
        best = v;
      }
    }
    prev = best;
    if (opts.bass) {
      const pc = (keyRoot + chord.root) % 12;
      const low = opts.center - 24;
      const bassNote = low + ((pc - (low % 12) + 12) % 12);
      result.push([bassNote, ...best]);
    } else {
      result.push(best);
    }
  }
  return result;
}

export interface Note {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
}
