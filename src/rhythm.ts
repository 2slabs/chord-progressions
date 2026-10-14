// Rhythm patterns: how each chord's notes are played across its duration.
import type { Note } from "./theory.ts";

export interface Hit {
  /** Beats from the start of the chord. */
  start: number;
  duration: number;
  /** Indices into the chord's upper voices (lowest first), or every voice. */
  notes: number[] | "all";
  velocity: number;
}

/** Hits for one chord lasting `length` beats with `voices` upper notes. */
type Pattern = (length: number, voices: number) => Hit[];

const ACCENT = 96;
const BEAT = 86;
const OFFBEAT = 76;
const accent = (t: number) => (t === 0 ? ACCENT : Number.isInteger(t) ? BEAT : OFFBEAT);

/** Evenly spaced hits; `gate` is the fraction of each step the note sounds. */
function grid(length: number, step: number, gate: number, notes: (i: number) => number[] | "all"): Hit[] {
  const hits: Hit[] = [];
  for (let i = 0; i * step < length - 1e-9; i++) {
    const t = i * step;
    hits.push({ start: t, duration: step * gate, notes: notes(i), velocity: accent(t) });
  }
  return hits;
}

/** A one-bar figure of [start, duration] onsets, repeated each bar and cut off at the chord's end. */
function figure(length: number, onsets: [number, number][]): Hit[] {
  const hits: Hit[] = [];
  for (let bar = 0; bar < length; bar += 4) {
    for (const [start, duration] of onsets) {
      const t = bar + start;
      if (t < length) hits.push({ start: t, duration, notes: "all", velocity: accent(t) });
    }
  }
  return hits;
}

const arp = (step: number, order: (i: number, n: number) => number): Pattern =>
  (length, n) => grid(length, step, 0.9, (i) => [order(i, n)]);

const up = (i: number, n: number) => i % n;
const down = (i: number, n: number) => n - 1 - (i % n);
const upDown = (i: number, n: number) => {
  if (n < 3) return up(i, n);
  const k = i % (2 * n - 2);
  return k < n ? k : 2 * n - 2 - k;
};
const alberti = (i: number, n: number) => [0, n - 1, Math.min(1, n - 1), n - 1][i % 4];

const strum: Pattern = (length, n) =>
  Array.from({ length: n }, (_, k) => ({
    start: k * 0.04,
    duration: length - k * 0.04,
    notes: [k],
    velocity: 92 - k * 3,
  }));

export interface Rhythm {
  id: string;
  label: string;
  group: string;
  pattern: Pattern;
}

export const RHYTHMS: Rhythm[] = [
  { id: "sustain", label: "Sustain", group: "Held", pattern: (length) => [{ start: 0, duration: length, notes: "all", velocity: 88 }] },
  { id: "strum", label: "Strum", group: "Held", pattern: strum },
  { id: "quarters", label: "Quarters", group: "Pulse", pattern: (length) => grid(length, 1, 0.85, () => "all") },
  { id: "eighths", label: "Eighths", group: "Pulse", pattern: (length) => grid(length, 0.5, 0.8, () => "all") },
  { id: "offbeats", label: "Offbeats", group: "Pulse", pattern: (length) => figure(length, [[0.5, 0.4], [1.5, 0.4], [2.5, 0.4], [3.5, 0.4]]) },
  { id: "tresillo", label: "3-3-2", group: "Pulse", pattern: (length) => figure(length, [[0, 1.4], [1.5, 1.4], [3, 0.9]]) },
  { id: "charleston", label: "Charleston", group: "Pulse", pattern: (length) => figure(length, [[0, 1.4], [1.5, 2.4]]) },
  { id: "arp-up-8", label: "Up · 8ths", group: "Arpeggio", pattern: arp(0.5, up) },
  { id: "arp-down-8", label: "Down · 8ths", group: "Arpeggio", pattern: arp(0.5, down) },
  { id: "arp-updown-8", label: "Up-down · 8ths", group: "Arpeggio", pattern: arp(0.5, upDown) },
  { id: "arp-up-16", label: "Up · 16ths", group: "Arpeggio", pattern: arp(0.25, up) },
  { id: "alberti-8", label: "Alberti · 8ths", group: "Arpeggio", pattern: arp(0.5, alberti) },
];

/**
 * Lay chords end to end, `beatsPerChord` each, playing the upper voices in the
 * given rhythm. With `bass`, the first pitch of each voicing is held underneath.
 */
export function toNotes(voicings: number[][], beatsPerChord: number, bass: boolean, rhythm = "sustain"): Note[] {
  const pattern = (RHYTHMS.find((r) => r.id === rhythm) ?? RHYTHMS[0]).pattern;
  return voicings.flatMap((pitches, i) => {
    const t0 = i * beatsPerChord;
    const upper = bass ? pitches.slice(1) : pitches;
    const notes: Note[] = [];
    if (bass) notes.push({ pitch: pitches[0], startTime: t0, duration: beatsPerChord, velocity: 100 });
    for (const hit of pattern(beatsPerChord, upper.length)) {
      const end = Math.min(hit.start + hit.duration, beatsPerChord);
      for (const k of hit.notes === "all" ? upper.keys() : hit.notes) {
        notes.push({ pitch: upper[k], startTime: t0 + hit.start, duration: end - hit.start, velocity: hit.velocity });
      }
    }
    return notes;
  });
}
