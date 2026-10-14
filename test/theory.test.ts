import { test } from "node:test";
import assert from "node:assert/strict";
import { SCALES, buildChord, generate, reroll, voice, toNotes, type Rng } from "../src/theory.ts";

const seeded = (seed: number): Rng => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test("diatonic triads in C major", () => {
  const names = [0, 1, 2, 3, 4, 5, 6].map((d) => buildChord(0, SCALES.Major, d, false));
  assert.deepEqual(names.map((c) => c.name), ["C", "Dm", "Em", "F", "G", "Am", "B°"]);
  assert.deepEqual(names.map((c) => c.numeral), ["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
});

test("diatonic sevenths in A minor", () => {
  const names = [0, 1, 2, 3, 4, 5, 6].map((d) => buildChord(9, SCALES.Minor, d, true).name);
  assert.deepEqual(names, ["Am7", "Bø7", "Cmaj7", "Dm7", "Em7", "Fmaj7", "G7"]);
});

test("flat keys are spelled with flats", () => {
  assert.equal(buildChord(5, SCALES.Major, 3, false).name, "B♭"); // IV in F
  assert.equal(buildChord(2, SCALES.Minor, 5, false).name, "B♭"); // VI in D minor
  assert.equal(buildChord(4, SCALES.Major, 2, false).name, "G♯m"); // iii in E
});

test("harmonic minor V is major, vii is diminished seventh", () => {
  assert.equal(buildChord(9, SCALES["Harmonic Minor"], 4, false).name, "E");
  assert.equal(buildChord(9, SCALES["Harmonic Minor"], 6, true).name, "G♯°7");
});

test("generated progressions have the right length, no repeats, and loop cleanly", () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const count of [2, 4, 8]) {
      const steps = generate(0, SCALES.Major, count, "none", seeded(seed));
      assert.equal(steps.length, count);
      for (let i = 1; i < count; i++) assert.notEqual(steps[i].degree, steps[i - 1].degree);
      if (count > 2) assert.notEqual(steps[count - 1].degree, steps[0].degree);
    }
  }
});

test("works for non-heptatonic scales", () => {
  const pentatonic = [0, 2, 4, 7, 9];
  const steps = generate(0, pentatonic, 4, "mixed", seeded(3));
  assert.equal(steps.length, 4);
  for (const s of steps) assert.ok(s.degree >= 0 && s.degree < 5);
});

test("reroll changes only the chosen chord and avoids its neighbours", () => {
  const steps = generate(0, SCALES.Major, 4, "none", seeded(7));
  for (let seed = 1; seed <= 50; seed++) {
    const out = reroll(0, SCALES.Major, steps, 1, "none", seeded(seed));
    assert.equal(out[0], steps[0]);
    assert.equal(out[2], steps[2]);
    assert.notEqual(out[1].degree, steps[1].degree);
    assert.notEqual(out[1].degree, steps[0].degree);
    assert.notEqual(out[1].degree, steps[2].degree);
  }
});

test("smooth voicing moves less than root-position voicing", () => {
  const chords = [0, 5, 3, 4].map((d) => buildChord(0, SCALES.Major, d, false));
  const movement = (v: number[][]) =>
    v.slice(1).reduce((s, c, i) => s + c.reduce((t, p, j) => t + Math.abs(p - v[i][j]), 0), 0);
  const smooth = voice(0, chords, { center: 60, smooth: true, bass: false });
  const blocky = voice(0, chords, { center: 60, smooth: false, bass: false });
  assert.ok(movement(smooth) < movement(blocky), `${movement(smooth)} vs ${movement(blocky)}`);
  for (const v of smooth) for (const p of v) assert.ok(p >= 48 && p <= 80);
});

test("bass note is the chord root two octaves down", () => {
  const chords = [buildChord(0, SCALES.Major, 4, false)]; // G
  const [v] = voice(0, chords, { center: 60, smooth: true, bass: true });
  assert.equal(v[0], 43);
  assert.equal(v[0] % 12, 7);
});

test("notes are laid out end to end", () => {
  const notes = toNotes([[60, 64, 67], [57, 60, 64]], 4, false);
  assert.equal(notes.length, 6);
  assert.deepEqual(notes.map((n) => n.startTime), [0, 0, 0, 4, 4, 4]);
  assert.ok(notes.every((n) => n.duration === 4));
});
