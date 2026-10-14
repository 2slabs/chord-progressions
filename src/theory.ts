// Pure music theory: scales, chords, progression generation, voicing.
// No Live or DOM dependencies, so it runs in the extension, the dialog, and tests.

export const SCALES: Record<string, number[]> = {
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
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

// ---- chords --------------------------------------------------------------------

export type ChordType = "triad" | "mixed" | "seventh" | "ninth" | "eleventh" | "sus2" | "sus4" | "quartal";

export const CHORD_TYPES: [ChordType, string][] = [
  ["triad", "Triads"],
  ["mixed", "Triads + 7ths"],
  ["seventh", "7ths"],
  ["ninth", "9ths"],
  ["eleventh", "11ths"],
  ["sus2", "sus2"],
  ["sus4", "sus4"],
  ["quartal", "Quartal (4ths)"],
];

/**
 * Diatonic: every chord is built from the scale on its own degree.
 * Parallel: the tonic chord's shape is moved, unchanged, to each new root
 * ("chord memory" – the dub techno / Detroit stab sound).
 */
export type Movement = "diatonic" | "parallel";

export interface Chord {
  degree: number;
  /** Semitones of the chord root above the key root (0–11). */
  root: number;
  /** Chord tones as semitones above the chord root, ascending, starting at 0. */
  tones: number[];
  /** e.g. "Am9" */
  name: string;
  /** e.g. "i9", "♭VImaj7" */
  numeral: string;
}

export interface Step {
  degree: number;
  /** Only used by the "mixed" chord type: this chord gets a 7th. */
  seventh: boolean;
}

/** Scale tones `steps` scale-steps above `degree`, as semitones above that degree. */
function stack(intervals: number[], degree: number, steps: number[]): number[] {
  const n = intervals.length;
  const abs = steps.map((k) => intervals[(degree + k) % n] + 12 * Math.floor((degree + k) / n));
  return abs.map((t) => t - abs[0]);
}

/** Chord tones for `type` built inside the scale on `degree`. */
export function shapeOf(intervals: number[], degree: number, type: ChordType, seventh = false): number[] {
  const third = stack(intervals, degree, [0, 2])[1];
  // A ♭9 (semitone above the root, an octave up) grinds on pads and stabs; leave it out.
  const nine = (steps: number[]) =>
    stack(intervals, degree, stack(intervals, degree, [0, 8])[1] === 13 ? steps.filter((k) => k !== 8) : steps);
  switch (type) {
    case "triad":
      return stack(intervals, degree, [0, 2, 4]);
    case "mixed":
      return stack(intervals, degree, seventh ? [0, 2, 4, 6] : [0, 2, 4]);
    case "seventh":
      return stack(intervals, degree, [0, 2, 4, 6]);
    case "ninth": // root, 3rd, 7th, 9th – a perfect 5th adds little and muddies stabs
      return nine(stack(intervals, degree, [0, 4])[1] === 7 ? [0, 2, 6, 8] : [0, 2, 4, 6, 8]);
    case "eleventh": // minor: root b3 b7 9 11. Major: drop the 3rd, which clashes with the 11th.
      return nine(third === 3 ? [0, 2, 6, 8, 10] : [0, 6, 8, 10]);
    case "sus2": {
      const t = stack(intervals, degree, [0, 1, 4]);
      return t[1] === 2 && t[2] === 7 ? t : stack(intervals, degree, [0, 2, 4]);
    }
    case "sus4": {
      const t = stack(intervals, degree, [0, 3, 4]);
      return t[1] === 5 && t[2] === 7 ? t : shapeOf(intervals, degree, "sus2");
    }
    case "quartal":
      return stack(intervals, degree, [0, 3, 6, 9]);
  }
}

/** Chord symbol suffix from its tones (semitones above the root), e.g. "m9", "maj7", "7sus4". */
export function chordSymbol(tones: number[]): string {
  const pcs = new Set(tones.map((t) => ((t % 12) + 12) % 12));
  const has = (x: number) => pcs.has(x);
  const third = has(4) ? 4 : has(3) ? 3 : 0;
  const seventh = has(11) ? 11 : has(10) ? 10 : 0;
  const minor = third === 3;

  if (minor && has(6) && !has(7)) {
    if (seventh === 10) return "ø7";
    if (has(9)) return "°7";
    return "°";
  }
  if (third === 4 && has(8) && !has(7)) return seventh === 11 ? "+maj7" : seventh === 10 ? "+7" : "+";

  const ninth = has(2);
  const eleventh = has(5);
  let s = minor ? "m" : "";
  if (seventh) {
    if (!third) {
      const maj = seventh === 11 ? "maj" : "";
      if (eleventh && ninth) return maj ? "maj9sus4" : "11";
      return maj + "7" + (eleventh ? "sus4" : ninth ? "sus2" : "(no3)");
    }
    const ext = has(9) ? "13" : eleventh && (ninth || minor) ? "11" : ninth ? "9" : "7";
    s += seventh === 11 ? (minor ? `(maj${ext})` : `maj${ext}`) : ext;
    if (eleventh && ext !== "11" && ext !== "13") s += "(add11)";
  } else {
    if (!third) return eleventh ? "sus4" : ninth ? "sus2" : "5";
    if (ninth) s += "add9";
    if (eleventh) s += "add11";
  }
  if (has(1)) s += "(♭9)";
  if (third === 4 && has(3)) s += "(♯9)";
  if (has(6) && has(7)) s += "(♯11)";
  if (has(8) && has(7)) s += "(♭13)";
  return s;
}

const ROMAN = ["I", "♭II", "II", "♭III", "III", "IV", "♯IV", "V", "♭VI", "VI", "♭VII", "VII"];

/** Roman numeral relative to the key root, e.g. "♭VImaj7", "iv9", "vii°". */
export function numeralOf(root: number, tones: number[]): string {
  const symbol = chordSymbol(tones);
  const minor = symbol.startsWith("m") && !symbol.startsWith("maj");
  const dim = symbol.startsWith("°") || symbol.startsWith("ø");
  const base = minor || dim ? ROMAN[root].toLowerCase() : ROMAN[root];
  return base + (minor ? symbol.slice(1) : symbol);
}

export function buildChord(
  keyRoot: number,
  intervals: number[],
  step: Step,
  type: ChordType,
  movement: Movement = "diatonic",
): Chord {
  const tones = movement === "parallel"
    ? shapeOf(intervals, 0, type, step.seventh)
    : shapeOf(intervals, step.degree, type, step.seventh);
  const root = intervals[step.degree % intervals.length] % 12;
  const names = noteNames(keyRoot, intervals);
  return {
    degree: step.degree,
    root,
    tones,
    name: names[(keyRoot + root) % 12] + chordSymbol(tones),
    numeral: numeralOf(root, tones),
  };
}

// ---- progressions ----------------------------------------------------------------

/** How a style moves between chords. Matrices are indexed by scale degree (0–6). */
export interface Harmony {
  movement: Movement;
  /** Diatonic: weight of moving from degree [row] to degree [col]. */
  transitions?: number[][];
  /** Parallel: weight of each degree as a destination when leaving the tonic (defaults to row 0 of transitions). */
  roots?: number[];
  /** Chance the progression opens on the tonic (default 0.75). */
  tonicStart?: number;
}

// Classic tonic → predominant → dominant → tonic tendencies.
export const FUNCTIONAL: number[][] = [
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

function transition(n: number, harmony: Harmony, from: number, to: number): number {
  if (from === to) return 0;
  if (harmony.movement === "parallel" && n === 7) {
    // Leave the tonic to a style-typical root, then mostly come home.
    const roots = harmony.roots ?? (harmony.transitions ?? FUNCTIONAL)[0];
    return from === 0 ? roots[to] : to === 0 ? 50 : roots[to] * 0.4;
  }
  if (n === 7) return (harmony.transitions ?? FUNCTIONAL)[from][to];
  return to === 0 ? 2 : 1; // other scales: wander, with a pull home
}

/** Diminished/augmented chords sound unstable; use them sparingly (diatonic only). */
function stability(intervals: number[], harmony: Harmony, degree: number): number {
  if (harmony.movement === "parallel") return 1;
  return shapeOf(intervals, degree, "triad")[2] === 7 ? 1 : 0.1;
}

export function rollSeventh(type: ChordType, rng: Rng): boolean {
  return type === "mixed" && rng() < 0.4;
}

export function generate(
  intervals: number[],
  count: number,
  type: ChordType,
  harmony: Harmony,
  rng: Rng = Math.random,
): Step[] {
  const n = intervals.length;
  const stab = intervals.map((_, d) => stability(intervals, harmony, d));
  const tonicStart = harmony.movement === "parallel" ? 1 : harmony.tonicStart ?? 0.75;
  // Otherwise open on IV or vi (any stable degree for other scales).
  const openers = intervals.map((_, d) => (d === 0 ? 0 : n === 7 ? (d === 3 || d === 5 ? 1 : 0) : stab[d]));
  const degrees: number[] = [rng() < tonicStart ? 0 : pick(openers, rng)];
  for (let i = 1; i < count; i++) {
    const prev = degrees[i - 1];
    const last = i === count - 1;
    const weights = intervals.map((_, d) => {
      let w = transition(n, harmony, prev, d) * stab[d];
      // End on something that leads back to the first chord so the clip loops.
      if (last && count > 2) w *= d === degrees[0] ? 0 : transition(n, harmony, d, degrees[0]) / 10 + 0.1;
      return w;
    });
    degrees.push(pick(weights, rng));
  }
  return degrees.map((degree) => ({ degree, seventh: rollSeventh(type, rng) }));
}

/** Re-pick one step so it still connects to its neighbours (wrapping, since clips loop). */
export function reroll(
  intervals: number[],
  steps: Step[],
  index: number,
  type: ChordType,
  harmony: Harmony,
  rng: Rng = Math.random,
): Step[] {
  const n = intervals.length;
  const prev = steps[(index - 1 + steps.length) % steps.length].degree;
  const next = steps[(index + 1) % steps.length].degree;
  const current = steps[index].degree;
  const weights = intervals.map((_, d) => {
    if (d === current || (steps.length > 1 && (d === prev || d === next))) return 0;
    if (steps.length === 1) return (transition(n, harmony, 0, d) + 1) * stability(intervals, harmony, d);
    return (transition(n, harmony, prev, d) + 1) * (transition(n, harmony, d, next) + 1) * stability(intervals, harmony, d);
  });
  const out = steps.slice();
  out[index] = { degree: pick(weights, rng), seventh: rollSeventh(type, rng) };
  return out;
}

// ---- voicing ---------------------------------------------------------------------

/**
 * smooth: inversions that minimise movement between chords.
 * close: root position, packed tight.
 * spread: open (drop-2) voicings, also chosen for smooth movement.
 */
export type VoicingMode = "smooth" | "close" | "spread";

export interface VoicingOptions {
  /** MIDI pitch the voicings gravitate around (e.g. 60 = C3 in Live). */
  center: number;
  mode: VoicingMode;
  /** Add the chord root an octave or two below. */
  bass: boolean;
  /** Keep the first chord's exact shape and move it to each root. */
  parallel?: boolean;
}

/** Open a close voicing: drop the second-highest note an octave (or raise the middle of a triad). */
function spread(v: number[]): number[] {
  const out = v.slice();
  if (out.length >= 4) out[out.length - 2] -= 12;
  else if (out.length === 3) out[1] += 12;
  return out.sort((a, b) => a - b);
}

function candidates(keyRoot: number, chord: Chord, opts: VoicingOptions): number[][] {
  const out: number[][] = [];
  const base = keyRoot + chord.root;
  for (let inv = 0; inv < chord.tones.length; inv++) {
    const shape = chord.tones.map((t, i) => (i < inv ? t + 12 : t)).sort((a, b) => a - b);
    for (let oct = -4; oct <= 4; oct++) {
      let v = shape.map((t) => base + t + 12 * oct);
      if (opts.mode === "spread") v = spread(v);
      if (v[0] >= opts.center - (opts.mode === "spread" ? 14 : 9) && v[0] <= opts.center + 5) out.push(v);
    }
  }
  return out;
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

function distance(a: number[], b: number[]): number {
  const near = (x: number, set: number[]) => Math.min(...set.map((y) => Math.abs(x - y)));
  return a.reduce((s, x) => s + near(x, b), 0) + b.reduce((s, y) => s + near(y, a), 0);
}

function best<T>(options: T[], cost: (o: T) => number): T {
  let pickd = options[0];
  let min = Infinity;
  for (const o of options) {
    const c = cost(o);
    if (c < min) {
      min = c;
      pickd = o;
    }
  }
  return pickd;
}

/** Absolute MIDI pitches for each chord. */
export function voice(keyRoot: number, chords: Chord[], opts: VoicingOptions): number[][] {
  const upper: number[][] = [];
  for (const [i, chord] of chords.entries()) {
    const prev = upper[i - 1];
    const rootPc = (keyRoot + chord.root) % 12;
    if (opts.parallel && i > 0) {
      // Same shape as the first chord, shifted to this root by the octave that fits best.
      const shift = (((chord.root - chords[0].root) % 12) + 12) % 12;
      const shifts = [shift - 24, shift - 12, shift, shift + 12];
      const chosen = best(shifts, (s) => {
        const v = upper[0].map((p) => p + s);
        const drift = Math.abs(mean(v) - opts.center);
        // Average movement per voice, weighed equally against staying in the register.
        return opts.mode === "close" ? drift : distance(v, prev) / (2 * v.length) + drift;
      });
      upper.push(upper[0].map((p) => p + chosen));
      continue;
    }
    upper.push(
      best(candidates(keyRoot, chord, opts), (v) => {
        const drift = Math.abs(mean(v) - opts.center);
        if (opts.mode === "close" || !prev) return (v[0] % 12 === rootPc ? 0 : 100) + drift;
        return distance(v, prev) + 0.4 * drift;
      }),
    );
  }
  if (!opts.bass) return upper;
  const low = opts.center - 24;
  return upper.map((v, i) => {
    const pc = (keyRoot + chords[i].root) % 12;
    return [low + ((pc - (low % 12) + 12) % 12), ...v];
  });
}

export interface Note {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
}
