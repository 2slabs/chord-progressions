// Chords for an existing clip (a bassline, a melody, or chords to restyle).
//
// The clip is cut into windows of `beatsPerChord`. Every real progression the style uses
// (each rotation, repeated to fill) is scored against what's sounding in each window, and
// so is the best single chord per window. Real progressions get a bonus, so they win when
// they fit nearly as well; when nothing of the style's fits, the per-window chords do.
import { pitchClassWeights, type SourceNote } from "./analysis.ts";
import {
  parseNumeral, rollSeventh, shapeOf, tonesFor,
  type ChordType, type Harmony, type Quality, type Rng, type Step,
} from "./theory.ts";

export interface Window {
  start: number;
  end: number;
  /** Pitch-class weights (absolute, 0 = C): overlap × loudness. */
  weights: number[];
  /** The bass: the lowest note sounding at the window's start, else the lowest in it. */
  bass: number | null;
}

/** Cut `length` beats into chord-length windows. */
export function windows(notes: SourceNote[], length: number, beatsPerChord: number): Window[] {
  const count = Math.max(1, Math.round(length / beatsPerChord));
  return Array.from({ length: count }, (_, i) => {
    const start = i * beatsPerChord;
    const end = i === count - 1 ? Math.max(length, start + 1e-6) : start + beatsPerChord;
    const sounding = notes.filter((n) => n.startTime < end && n.startTime + n.duration > start);
    const atStart = sounding.filter((n) => n.startTime <= start + 0.25);
    const low = (list: SourceNote[]) => list.reduce<SourceNote | null>((a, n) => (!a || n.pitch < a.pitch ? n : a), null);
    const b = low(atStart) ?? low(sounding);
    return { start, end, weights: pitchClassWeights(notes, start, end), bass: b ? ((b.pitch % 12) + 12) % 12 : null };
  });
}

const isMinorish = (intervals: number[]) => intervals.includes(3) && !intervals.includes(4);
const pc = (x: number) => ((x % 12) + 12) % 12;

interface Candidate { text: string; root: number; quality: Quality; prior: number }

/** Every chord the style uses in this mode, weighted by how often; plus the scale's own triads. */
function vocabulary(intervals: number[], harmony: Harmony): Candidate[] {
  const mode = isMinorish(intervals) ? "minor" : "major";
  const weights = new Map<string, number>();
  for (const [w, text] of harmony.progressions?.[mode] ?? []) for (const c of text.split(/\s+/)) weights.set(c, (weights.get(c) ?? 0) + w);
  for (const c of harmony.turnarounds?.[mode] ?? []) weights.set(c, (weights.get(c) ?? 0) + 1);
  const out: Candidate[] = [...weights].map(([text, w]) => ({ text, ...parseNumeral(text), prior: w }));
  // Diatonic triads, so any clip can be followed (a small prior keeps the style's own chords ahead).
  intervals.forEach((iv, d) => {
    const t = shapeOf(intervals, d, "triad");
    const quality: Quality | null = t[1] === 3 && t[2] === 7 ? "m" : t[1] === 4 && t[2] === 7 ? "M" : t[1] === 3 && t[2] === 6 ? "ø" : null;
    if (!quality) return;
    const root = iv % 12;
    if (!out.some((c) => c.root === root && c.quality === quality)) out.push({ text: `${root}${quality}`, root, quality, prior: 0.3 });
  });
  const total = out.reduce((s, c) => s + c.prior, 0) || 1;
  return out.map((c) => ({ ...c, prior: c.prior / total }));
}

/**
 * How well a chord fits one window, about −1 (wrong) to 1.5 (every note a chord tone, root in the bass).
 * Scale tones outside the chord cost a little (passing notes), notes outside the key cost more,
 * and a note a semitone above a chord tone (a ♭9 rub) costs most.
 */
export function fit(keyRoot: number, intervals: number[], root: number, quality: Quality, type: ChordType, w: Window): number {
  const total = w.weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const chordRoot = pc(keyRoot + root);
  const tones = new Set(tonesFor(quality, type === "triad" || type === "mixed" ? "seventh" : type).map((t) => pc(chordRoot + t)));
  const scale = new Set(intervals.map((i) => pc(keyRoot + i)));
  let score = 0;
  for (let p = 0; p < 12; p++) {
    const x = w.weights[p];
    if (!x) continue;
    if (tones.has(p)) score += x * (p === chordRoot ? 1.3 : 1);
    else if (tones.has(pc(p - 1))) score -= x * 1.1; // a semitone above a chord tone
    else if (scale.has(p)) score -= x * 0.3;
    else score -= x;
  }
  score /= total;
  if (w.bass !== null) {
    if (w.bass === chordRoot) score += 0.5;
    else if (tones.has(w.bass)) score += 0.1;
    else score -= 0.4;
  }
  return score;
}

export interface Harmonized {
  steps: Step[];
  /** Mean fit per window (see `fit`). */
  score: number;
  /** "real" when one of the style's progressions was used, else "per window". */
  from: "real" | "per window";
}

const REAL_BONUS = 0.15;

/**
 * Chords for the clip. `rng` picks among the near-best options, so generating again
 * gives a different good fit rather than the same one.
 */
export function harmonize(
  notes: SourceNote[],
  length: number,
  keyRoot: number,
  intervals: number[],
  beatsPerChord: number,
  type: ChordType,
  harmony: Harmony,
  rng: Rng = Math.random,
): Harmonized {
  const ws = windows(notes, length, beatsPerChord);
  const count = ws.length;
  const mode = isMinorish(intervals) ? "minor" : "major";
  const parallel = harmony.movement === "parallel";
  const tonicQuality: Quality = mode === "minor" ? "m" : "M";
  const q = (c: { quality: Quality }) => (parallel ? tonicQuality : c.quality);
  const vocab = vocabulary(intervals, harmony);
  const fitOf = (c: Candidate, i: number) => fit(keyRoot, intervals, c.root, q(c), type, ws[i]);

  const options: { chords: Candidate[]; score: number; from: Harmonized["from"] }[] = [];

  // Each real progression, in every rotation (the clip may start mid-loop), repeated to fill.
  for (const [weight, text] of harmony.progressions?.[mode] ?? []) {
    const prog = text.split(/\s+/).map((t) => vocab.find((c) => c.text === t) ?? { text: t, ...parseNumeral(t), prior: 0 });
    if (prog.length > count || count % prog.length !== 0) continue;
    for (let r = 0; r < prog.length; r++) {
      const chords = Array.from({ length: count }, (_, i) => prog[(i + r) % prog.length]);
      const mean = chords.reduce((s, c, i) => s + fitOf(c, i), 0) / count;
      options.push({ chords, score: mean + REAL_BONUS + 0.02 * Math.log(1 + weight), from: "real" });
    }
  }

  // The best chord per window, preferring the style's chords and not changing chord for nothing.
  const free: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    let best = vocab[0];
    let bestScore = -Infinity;
    for (const c of vocab) {
      const s = fitOf(c, i) + 0.3 * c.prior + (free[i - 1] && free[i - 1].text === c.text ? 0.05 : 0);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    free.push(best);
  }
  options.push({ chords: free, score: free.reduce((s, c, i) => s + fitOf(c, i), 0) / count, from: "per window" });

  // Pick among the options within reach of the best (weighted towards the best).
  options.sort((a, b) => b.score - a.score);
  const top = options.filter((o) => o.score >= options[0].score - 0.12);
  const weights = top.map((o) => Math.exp((o.score - options[0].score) * 20));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  let chosen = top[0];
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r < 0) { chosen = top[i]; break; }
  }
  const steps = chosen.chords.map((c) => ({
    degree: Math.max(0, intervals.findIndex((iv) => iv % 12 === c.root)),
    seventh: rollSeventh(type, rng),
    root: c.root,
    quality: c.quality,
  }));
  const score = chosen.chords.reduce((s, c, i) => s + fitOf(c, i), 0) / count;
  return { steps, score, from: chosen.from };
}

/** Re-pick one chord: another of the style's chords, weighted by how well it fits that window. */
export function rerollToFit(
  notes: SourceNote[],
  length: number,
  keyRoot: number,
  intervals: number[],
  beatsPerChord: number,
  type: ChordType,
  harmony: Harmony,
  steps: Step[],
  index: number,
  rng: Rng = Math.random,
): Step[] {
  const ws = windows(notes, length, beatsPerChord);
  const vocab = vocabulary(intervals, harmony);
  const cur = steps[index];
  const options = vocab.filter((c) => !(c.root === cur.root && c.quality === cur.quality));
  if (!options.length || !ws[index]) return steps;
  const parallel = harmony.movement === "parallel";
  const tonicQuality: Quality = isMinorish(intervals) ? "m" : "M";
  const weights = options.map((c) => Math.exp(4 * fit(keyRoot, intervals, c.root, parallel ? tonicQuality : c.quality, type, ws[index])) * (0.5 + c.prior));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  let pick = options[0];
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r < 0) { pick = options[i]; break; }
  }
  const out = steps.slice();
  out[index] = { degree: Math.max(0, intervals.findIndex((iv) => iv % 12 === pick.root)), seventh: rollSeventh(type, rng), root: pick.root, quality: pick.quality };
  return out;
}

