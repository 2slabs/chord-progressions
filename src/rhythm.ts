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

const ACCENT = 104;
const NORMAL = 84;
const STEP = 0.25; // one 16th, in beats
const GAP = 0.03; // so repeated hits retrigger cleanly

/**
 * A one-bar, 16-step pattern, repeated each bar and cut off at the chord's end.
 *   X accented hit   x hit   - hold the previous hit   . rest
 */
export function steps(bar: string): Pattern {
  if (bar.length !== 16) throw new Error(`pattern must be 16 steps: ${bar}`);
  const hits: { at: number; len: number; accent: boolean }[] = [];
  for (let i = 0; i < 16; i++) {
    const c = bar[i];
    if (c === "x" || c === "X") hits.push({ at: i, len: 1, accent: c === "X" });
    else if (c === "-" && hits.length && hits[hits.length - 1].at + hits[hits.length - 1].len === i) hits[hits.length - 1].len++;
  }
  return (length) => {
    const out: Hit[] = [];
    for (let barStart = 0; barStart < length; barStart += 4) {
      for (const h of hits) {
        const start = barStart + h.at * STEP;
        if (start < length) out.push({ start, duration: h.len * STEP - GAP, notes: "all", velocity: h.accent ? ACCENT : NORMAL });
      }
    }
    return out;
  };
}

const arp = (step: number, order: (i: number, n: number) => number): Pattern =>
  (length, n) => {
    const hits: Hit[] = [];
    for (let i = 0; i * step < length - 1e-9; i++) {
      const t = i * step;
      hits.push({ start: t, duration: step * 0.9, notes: [order(i, n)], velocity: Number.isInteger(t) ? 96 : 80 });
    }
    return hits;
  };

const up = (i: number, n: number) => i % n;
const down = (i: number, n: number) => n - 1 - (i % n);
const upDown = (i: number, n: number) => {
  if (n < 3) return up(i, n);
  const k = i % (2 * n - 2);
  return k < n ? k : 2 * n - 2 - k;
};
const alberti = (i: number, n: number) => [0, n - 1, Math.min(1, n - 1), n - 1][i % 4];

const strum: Pattern = (length, n) =>
  Array.from({ length: n }, (_, k) => ({ start: k * 0.04, duration: length - k * 0.04, notes: [k], velocity: 92 - k * 3 }));

export interface Rhythm {
  id: string;
  label: string;
  group: string;
  pattern: Pattern;
}

export const RHYTHMS: Rhythm[] = [
  { id: "sustain", label: "Sustain", group: "Held", pattern: (length) => [{ start: 0, duration: length, notes: "all", velocity: 90 }] },
  { id: "strum", label: "Strum", group: "Held", pattern: strum },

  { id: "house-offbeat", label: "Offbeat organ", group: "House", pattern: steps("..X-..X-..X-..X-") },
  { id: "piano-house", label: "Piano 3-3-4", group: "House", pattern: steps("X-.x-.x-..x-.x-.") },
  { id: "house-stab", label: "Stab (1 · a · 3 · a)", group: "House", pattern: steps("X..x....X..x....") },

  { id: "dub-dotted", label: "Dotted stabs", group: "Dub", pattern: steps("X..x..x.........") },
  { id: "dub-sparse", label: "Sparse (1 · 3+)", group: "Dub", pattern: steps("X.........x.....") },
  { id: "dub-offbeat", label: "Offbeat chops", group: "Dub", pattern: steps("..x.......x.....") },

  { id: "techno-332", label: "16th 3-3-2", group: "Techno", pattern: steps("X..x..x.X..x..x.") },
  { id: "techno-stab", label: "Syncopated stab", group: "Techno", pattern: steps("...X..x....x..x.") },
  { id: "techno-offbeat-16", label: "Off-16ths", group: "Techno", pattern: steps(".x.x.x.x.x.x.x.x") },

  { id: "quarters", label: "Quarters", group: "Pulse", pattern: steps("X--.x--.x--.x--.") },
  { id: "eighths", label: "Eighths", group: "Pulse", pattern: steps("X.x.x.x.x.x.x.x.") },
  { id: "offbeats", label: "Offbeats", group: "Pulse", pattern: steps("..x...x...x...x.") },
  { id: "tresillo", label: "3-3-2", group: "Pulse", pattern: steps("X-----x-----x---") },
  { id: "charleston", label: "Charleston", group: "Pulse", pattern: steps("X-----x---------") },

  { id: "arp-up-8", label: "Up · 8ths", group: "Arpeggio", pattern: arp(0.5, up) },
  { id: "arp-down-8", label: "Down · 8ths", group: "Arpeggio", pattern: arp(0.5, down) },
  { id: "arp-updown-8", label: "Up-down · 8ths", group: "Arpeggio", pattern: arp(0.5, upDown) },
  { id: "arp-up-16", label: "Up · 16ths", group: "Arpeggio", pattern: arp(0.25, up) },
  { id: "alberti-8", label: "Alberti · 8ths", group: "Arpeggio", pattern: arp(0.5, alberti) },
];

export interface Groove {
  /** 16th swing as a percentage: 50 = straight, 58 = typical house. */
  swing?: number;
  /** Move each chord change (after the first) a 16th early. */
  push?: boolean;
}

/**
 * Lay chords end to end, `beatsPerChord` each, playing the upper voices in the
 * given rhythm. With `bass`, the first pitch of each voicing is held underneath.
 */
export function toNotes(
  voicings: number[][],
  beatsPerChord: number,
  bass: boolean,
  rhythm = "sustain",
  groove: Groove = {},
): Note[] {
  const pattern = (RHYTHMS.find((r) => r.id === rhythm) ?? RHYTHMS[0]).pattern;
  const swingDelay = ((groove.swing ?? 50) / 100 - 0.5) * 0.5;
  const chords = voicings.map((pitches, i) => {
    const t0 = i * beatsPerChord;
    const upper = bass ? pitches.slice(1) : pitches;
    const notes: Note[] = [];
    if (bass) notes.push({ pitch: pitches[0], startTime: t0, duration: beatsPerChord, velocity: 100 });
    for (const hit of pattern(beatsPerChord, upper.length)) {
      // Swing delays the 2nd and 4th 16th of each beat.
      const offbeat16 = Math.abs((hit.start % 0.5) - 0.25) < 1e-6;
      const start = hit.start + (offbeat16 ? swingDelay : 0);
      const end = Math.min(start + hit.duration, beatsPerChord);
      if (end <= start) continue;
      for (const k of hit.notes === "all" ? upper.keys() : hit.notes) {
        notes.push({ pitch: upper[k], startTime: t0 + start, duration: end - start, velocity: hit.velocity });
      }
    }
    return notes;
  });

  if (groove.push) {
    for (let i = 1; i < chords.length; i++) {
      const t0 = i * beatsPerChord;
      const pushed = t0 - STEP;
      let moved = false;
      for (const n of chords[i]) {
        if (Math.abs(n.startTime - t0) < 1e-6) {
          n.startTime = pushed;
          n.duration += STEP;
          moved = true;
        }
      }
      if (!moved) continue;
      // Cut the previous chord off where this one now starts.
      chords[i - 1] = chords[i - 1]
        .map((n) => (n.startTime + n.duration > pushed ? { ...n, duration: pushed - n.startTime } : n))
        .filter((n) => n.duration > 1e-6);
    }
  }
  return chords.flat();
}
