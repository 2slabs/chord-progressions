// Read harmony out of a MIDI clip: the key, and which chord is sounding when.
// Works on chord clips (stabs, pads, the chord-progressions tool's output) and,
// more conservatively, on single-line melodies.
import { SCALES, chordSymbol, noteNames, numeralOf } from "./theory.ts";

export interface SourceNote {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
}

export interface Key {
  root: number;
  /** A key of SCALES. */
  scale: string;
}

/** A stretch of time with one chord. Times in beats from the start of the clip. */
export interface Segment {
  start: number;
  end: number;
  /** Chord root as a pitch class, 0 = C. */
  root: number;
  /** Chord tones in semitones above the root (from the matched template). */
  tones: number[];
  name: string;
  numeral: string;
}

// Krumhansl–Kessler key profiles.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Pitch-class weights for notes sounding in [from, to): overlap × loudness. */
export function pitchClassWeights(notes: SourceNote[], from = -Infinity, to = Infinity): number[] {
  const w = Array<number>(12).fill(0);
  for (const n of notes) {
    const overlap = Math.min(n.startTime + n.duration, to) - Math.max(n.startTime, from);
    if (overlap > 0) w[((n.pitch % 12) + 12) % 12] += overlap * (0.5 + n.velocity / 127);
  }
  return w;
}

function correlation(a: number[], b: number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Best-fitting major or minor key (Krumhansl–Schmuckler). */
export function detectKey(notes: SourceNote[]): Key {
  const w = pitchClassWeights(notes);
  let best: Key = { root: 9, scale: "Minor" };
  let bestScore = -Infinity;
  for (let root = 0; root < 12; root++) {
    const rotated = w.map((_, i) => w[(i + root) % 12]);
    for (const [scale, profile] of [["Major", MAJOR_PROFILE], ["Minor", MINOR_PROFILE]] as const) {
      const score = correlation(rotated, profile);
      if (score > bestScore) {
        bestScore = score;
        best = { root, scale };
      }
    }
  }
  return best;
}

/**
 * Key for a loop: loops in these genres almost always start on the tonic, so take
 * the first chord's root (found with a provisional major/minor key), then the
 * mode from SCALES that best fits the notes on that root.
 */
export function detectLoopKey(notes: SourceNote[], length: number): Key {
  const provisional = detectKey(notes);
  const segments = analyze(notes, length, provisional);
  const root = segments.length ? segments[0].root : provisional.root;
  const w = pitchClassWeights(notes);
  let best = provisional.root === root ? provisional.scale : "Minor";
  let bestFit = -Infinity;
  for (const [scale, intervals] of Object.entries(SCALES)) {
    const inScale = new Set(intervals.map((i) => (i + root) % 12));
    const fit = w.reduce((s, x, pc) => s + (inScale.has(pc) ? x : -x), 0);
    if (fit > bestFit + 1e-9) {
      bestFit = fit;
      best = scale;
    }
  }
  return { root, scale: best };
}

// Chord templates, simplest first (ties go to the simpler chord). Includes the
// extended shapes these genres use: m9, m11, maj9, 11, quartal stacks.
const TEMPLATES: number[][] = [
  [0, 4, 7], [0, 3, 7], [0, 3, 6], [0, 5, 7], [0, 2, 7], [0, 7],
  [0, 4, 7, 10], [0, 4, 7, 11], [0, 3, 7, 10], [0, 3, 6, 10],
  [0, 3, 10, 14], [0, 4, 11, 14], [0, 4, 10, 14], [0, 3, 10, 14, 17], [0, 10, 14, 17], [0, 5, 10, 15],
];

function lowestPitchClass(notes: SourceNote[], from: number, to: number): number | null {
  let low: SourceNote | null = null;
  for (const n of notes) {
    if (n.startTime < to && n.startTime + n.duration > from && (!low || n.pitch < low.pitch)) low = n;
  }
  return low ? ((low.pitch % 12) + 12) % 12 : null;
}

/** Most notes ever sounding at once (1 ≈ a melody). */
export function polyphony(notes: SourceNote[]): number {
  let max = 0;
  for (const n of notes) {
    const t = n.startTime + 1e-6;
    max = Math.max(max, notes.filter((m) => m.startTime <= t && m.startTime + m.duration > t).length);
  }
  return max;
}

interface Match { root: number; tones: number[]; score: number }

/** Score every root × template against one window's weights. */
function bestChord(w: number[], bass: number | null, key: Key, melody: boolean): Match | null {
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const scale = new Set(SCALES[key.scale].map((i) => (i + key.root) % 12));
  let best: Match | null = null;
  for (let root = 0; root < 12; root++) {
    if (melody && !scale.has(root)) continue;
    for (const tones of TEMPLATES) {
      const pcs = new Set(tones.map((t) => (root + t) % 12));
      let matched = 0;
      let missing = 0;
      for (const pc of pcs) {
        if (w[pc] > 0) matched += w[pc] * (pc === root ? 1.25 : 1);
        else missing++;
      }
      const unmatched = w.reduce((s, x, pc) => s + (pcs.has(pc) ? 0 : x), 0);
      let score = matched - 0.8 * unmatched - 0.12 * total * missing;
      if (bass === root) score += 0.25 * total; // the lowest note is usually the root
      if ([...pcs].every((pc) => scale.has(pc))) score += (melody ? 0.3 : 0.05) * total;
      if (!best || score > best.score + 1e-9) best = { root, tones, score };
    }
  }
  return best;
}

/**
 * Chords over time. The clip is cut into windows of `resolution` beats; each
 * gets its best chord; neighbours with the same root merge. Silent windows
 * continue the previous chord.
 */
export function analyze(notes: SourceNote[], length: number, key: Key, resolution = 4): Segment[] {
  const melody = polyphony(notes) <= 1;
  const window = melody ? Math.max(resolution, 4) : resolution;
  const names = noteNames(key.root, SCALES[key.scale]);
  const raw: { start: number; end: number; match: Match | null }[] = [];
  for (let start = 0; start < length - 1e-9; start += window) {
    const end = Math.min(start + window, length);
    const w = pitchClassWeights(notes, start, end);
    raw.push({ start, end, match: bestChord(w, lowestPitchClass(notes, start, end), key, melody) });
  }
  // Fill silent windows from their neighbours; a fully silent clip sits on the tonic.
  const firstHeard = raw.find((r) => r.match)?.match ?? { root: key.root, tones: [0, 7], score: 0 };
  let prev = firstHeard;
  for (const r of raw) prev = r.match ??= prev;

  const segments: Segment[] = [];
  for (const r of raw) {
    const m = r.match!;
    const last = segments[segments.length - 1];
    if (last && last.root === m.root) {
      last.end = r.end;
      continue;
    }
    const rel = (m.root - key.root + 12) % 12;
    segments.push({
      start: r.start,
      end: r.end,
      root: m.root,
      tones: m.tones,
      name: names[m.root] + chordSymbol(m.tones),
      numeral: numeralOf(rel, m.tones),
    });
  }
  // A loop that starts and ends on the same chord is one chord across the seam; leave it split
  // (the bass needs to land on the 1), but never return an empty list.
  return segments;
}
