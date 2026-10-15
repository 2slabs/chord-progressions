import { test } from "node:test";
import assert from "node:assert/strict";
import { harmonize, rerollToFit, windows } from "../src/harmonize.ts";
import { SCALES, buildChord } from "../src/theory.ts";
import { styleById } from "../src/styles.ts";
import type { SourceNote } from "../src/analysis.ts";

const n = (pitch: number, startTime: number, duration = 0.5, velocity = 100): SourceNote => ({ pitch, startTime, duration, velocity });
/** A bass riff: the given root (MIDI) on the 1 and the "and" of 2 of each bar, an octave on 3. */
const bassBars = (roots: number[]) =>
  roots.flatMap((r, bar) => [n(r, bar * 4), n(r, bar * 4 + 1.5), n(r + 12, bar * 4 + 2.5)]);
let x = 7;
const rng = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0), (x >>> 8) / 16777216);
const names = (keyRoot: number, scale: string, style: string, notes: SourceNote[], length: number, bpc = 4) => {
  const st = styleById(style);
  const h = harmonize(notes, length, keyRoot, SCALES[scale], bpc, st.chord, st.harmony, rng);
  return { ...h, names: h.steps.map((s) => buildChord(keyRoot, SCALES[scale], s, st.chord, st.harmony.movement).name) };
};

test("windows: one per chord length, bass = lowest note at the start", () => {
  const ws = windows(bassBars([45, 50]), 8, 4);
  assert.equal(ws.length, 2);
  assert.deepEqual(ws.map((w) => w.bass), [9, 2]);
});

test("deep house over an A–D bass: Am9 Dm9 (i–iv), a real progression", () => {
  const h = names(9, "Dorian", "deep-house", bassBars([45, 50]), 8);
  assert.deepEqual(h.names, ["Am9", "Dm9"]);
  assert.equal(h.from, "real");
});

test("a bass that starts mid-loop gets the rotated progression (iv–i)", () => {
  const h = names(9, "Dorian", "deep-house", bassBars([50, 45]), 8);
  assert.deepEqual(h.names, ["Dm9", "Am9"]);
});

test("Good Life's bass roots (B F♯ A E) give i–v–♭vii–iv, all minor, in detroit style", () => {
  const h = names(11, "Minor", "detroit", bassBars([47, 42, 45, 40]), 16);
  assert.deepEqual(h.names, ["Bm9", "F♯m9", "Am9", "Em9"]);
});

test("a melody without a bass still gets chords that contain it", () => {
  const melody = [n(72, 0, 1), n(76, 1, 1), n(79, 2, 1), n(77, 4, 1), n(81, 5, 1), n(84, 6, 1)]; // C E G | F A C
  const h = names(0, "Major", "classic-house", melody, 8);
  assert.deepEqual(h.names, ["Cmaj7", "Fmaj7"]);
});

test("every chord fits its window better than a wrong one would, at any chord length", () => {
  const notes = bassBars([45, 45, 53, 55]); // A A F G
  for (const bpc of [2, 4, 8]) {
    const st = styleById("deep-house");
    const h = harmonize(notes, 16, 9, SCALES.Dorian, bpc, st.chord, st.harmony, rng);
    assert.equal(h.steps.length, 16 / bpc);
    assert.ok(h.score > 0.5, `bpc ${bpc}: score ${h.score}`);
  }
});

test("reroll to fit changes only that chord", () => {
  const st = styleById("deep-house");
  const notes = bassBars([45, 50]);
  const h = harmonize(notes, 8, 9, SCALES.Dorian, 4, st.chord, st.harmony, rng);
  const out = rerollToFit(notes, 8, 9, SCALES.Dorian, 4, st.chord, st.harmony, h.steps, 1, rng);
  assert.deepEqual(out[0], h.steps[0]);
  assert.notDeepEqual([out[1].root, out[1].quality], [h.steps[1].root, h.steps[1].quality]);
});
