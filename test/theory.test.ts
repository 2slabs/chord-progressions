import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCALES, buildChord, chordSymbol, generate, parseNumeral, reroll, tonesFor, voice, type ChordType, type Harmony, type Rng,
} from "../src/theory.ts";
import { STYLES } from "../src/styles.ts";

const seeded = (seed: number): Rng => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
/** mulberry32: well-spread from the first draw (the LCG above isn't, for nearby seeds). */
const mixed = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const DIATONIC: Harmony = { movement: "diatonic" };
const chord = (key: number, scale: string, degree: number, type: ChordType, movement: Harmony["movement"] = "diatonic") =>
  buildChord(key, SCALES[scale], { degree, seventh: false }, type, movement);
const all = (key: number, scale: string, type: ChordType) => [0, 1, 2, 3, 4, 5, 6].map((d) => chord(key, scale, d, type));

test("diatonic triads in C major", () => {
  const cs = all(0, "Major", "triad");
  assert.deepEqual(cs.map((c) => c.name), ["C", "Dm", "Em", "F", "G", "Am", "B°"]);
  assert.deepEqual(cs.map((c) => c.numeral), ["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
});

test("diatonic sevenths in A minor, with flat-numerals relative to the minor tonic", () => {
  const cs = all(9, "Minor", "seventh");
  assert.deepEqual(cs.map((c) => c.name), ["Am7", "Bø7", "Cmaj7", "Dm7", "Em7", "Fmaj7", "G7"]);
  assert.deepEqual(cs.map((c) => c.numeral), ["i7", "iiø7", "♭IIImaj7", "iv7", "v7", "♭VImaj7", "♭VII7"]);
});

test("ninths drop the 5th and are named from their notes", () => {
  const cs = all(2, "Dorian", "ninth"); // D Dorian
  assert.deepEqual(cs[0].tones, [0, 3, 10, 14]);
  assert.deepEqual(cs.map((c) => c.name), ["Dm9", "Em7", "Fmaj9", "G9", "Am9", "Bø7", "Cmaj9"]);
});

test("elevenths keep the minor 3rd but drop a clashing major 3rd", () => {
  assert.equal(chord(9, "Minor", 0, "eleventh").name, "Am11");
  assert.deepEqual(chord(9, "Minor", 0, "eleventh").tones, [0, 3, 10, 14, 17]);
  const major = chord(0, "Major", 4, "eleventh"); // G in C major
  assert.ok(!major.tones.some((t) => t % 12 === 4), "no major 3rd");
  assert.equal(major.name, "G11");
});

test("sus chords fall back when the scale has no perfect 4th/5th", () => {
  assert.equal(chord(0, "Major", 0, "sus4").name, "Csus4");
  assert.equal(chord(0, "Major", 1, "sus2").name, "Dsus2");
  assert.equal(chord(0, "Major", 3, "sus4").name, "Fsus2"); // F–B is a tritone
});

test("quartal chords are stacked 4ths", () => {
  const am = chord(9, "Minor", 0, "quartal");
  assert.deepEqual(am.tones, [0, 5, 10, 15]);
  assert.equal(am.name, "Am11");
});

test("chord symbols", () => {
  assert.equal(chordSymbol([0, 4, 7]), "");
  assert.equal(chordSymbol([0, 3, 7, 10, 14]), "m9");
  assert.equal(chordSymbol([0, 4, 11, 14]), "maj9");
  assert.equal(chordSymbol([0, 5, 7, 10]), "7sus4");
  assert.equal(chordSymbol([0, 3, 6, 9]), "°7");
  assert.equal(chordSymbol([0, 3, 7, 11]), "m(maj7)");
  assert.equal(chordSymbol([0, 4, 7, 14]), "add9");
});

test("flat keys are spelled with flats", () => {
  assert.equal(chord(5, "Major", 3, "triad").name, "B♭"); // IV in F
  assert.equal(chord(2, "Minor", 5, "triad").name, "B♭"); // VI in D minor
  assert.equal(chord(4, "Major", 2, "triad").name, "G♯m"); // iii in E
});

test("parallel movement keeps the tonic's shape on every root", () => {
  const i = chord(9, "Minor", 0, "eleventh", "parallel");
  const iv = chord(9, "Minor", 3, "eleventh", "parallel");
  const flat3 = chord(9, "Minor", 2, "eleventh", "parallel");
  assert.deepEqual(iv.tones, i.tones);
  assert.equal(iv.name, "Dm11");
  assert.equal(flat3.name, "Cm11"); // not Cmaj9: the shape stays minor
  assert.equal(flat3.numeral, "♭iii11");
});

test("the random walk (styles without real progressions) has no repeats and loops cleanly", () => {
  for (const style of STYLES.filter((s) => !s.harmony.progressions)) {
    for (let seed = 1; seed <= 100; seed++) {
      for (const count of [1, 2, 4, 8]) {
        const steps = generate(SCALES[style.scale], count, style.chord, style.harmony, seeded(seed));
        assert.equal(steps.length, count);
        for (let i = 1; i < count; i++) assert.notEqual(steps[i].degree, steps[i - 1].degree, style.id);
        if (count > 2) assert.notEqual(steps[count - 1].degree, steps[0].degree);
      }
    }
  }
});

test("styles with real progressions play one of them (repeated to fill, maybe with a turnaround)", () => {
  for (const style of STYLES.filter((s) => s.harmony.progressions)) {
    for (const scale of [style.scale, "Minor", "Major"]) {
      const mode = scale === "Major" ? "major" : "minor";
      const pool = style.harmony.progressions![mode];
      for (let seed = 1; seed <= 60; seed++) {
        for (const count of [1, 2, 3, 4, 6, 8]) {
          const steps = generate(SCALES[scale], count, style.chord, style.harmony, mixed(seed));
          assert.equal(steps.length, count, `${style.id} ${count}`);
          if (!pool || steps[0].root === undefined) continue; // no template fits: the random walk
          const got = steps.map((s) => `${s.root}${s.quality}`);
          const matches = pool.some(([, text]) => {
            const p = text.split(" ").map((n) => { const c = parseNumeral(n); return `${c.root}${c.quality}`; });
            return got.every((c, i) => c === p[i % p.length] || (i === count - 1 && count > p.length));
          });
          assert.ok(matches, `${style.id} ${scale} ${count}: ${got.join(" ")}`);
        }
      }
    }
  }
});

test("Good Life: i v ♭vii iv, all minor (B minor: Bm F♯m Am Em)", () => {
  const steps = ["i", "v", "bvii", "iv"].map((n) => ({ degree: 0, seventh: false, ...parseNumeral(n) }));
  assert.deepEqual(steps.map((s) => buildChord(11, SCALES.Minor, s, "triad").name), ["Bm", "F♯m", "Am", "Em"]);
});

test("numerals: flats from the major scale, case is quality", () => {
  assert.deepEqual(parseNumeral("bVII"), { root: 10, quality: "M" });
  assert.deepEqual(parseNumeral("bvi"), { root: 8, quality: "m" });
  assert.deepEqual(parseNumeral("bVII7"), { root: 10, quality: "7" });
  assert.deepEqual(parseNumeral("vsus4"), { root: 7, quality: "sus4" });
  assert.deepEqual(parseNumeral("iii"), { root: 4, quality: "m" });
  assert.throws(() => parseNumeral("x"));
});

test("template chords take the chord type's extension", () => {
  assert.deepEqual(tonesFor("m", "ninth"), [0, 3, 10, 14]);
  assert.deepEqual(tonesFor("M", "seventh"), [0, 4, 7, 11]);
  assert.deepEqual(tonesFor("7", "eleventh"), [0, 10, 14, 17]);
  assert.deepEqual(tonesFor("m", "triad"), [0, 3, 7]);
  const named = (scale: string, n: string) => buildChord(0, SCALES[scale], { degree: 0, seventh: false, ...parseNumeral(n) }, "seventh").name;
  assert.equal(named("Minor", "bVI"), "A♭maj7");
  assert.equal(named("Minor", "bVII"), "B♭7", "♭VII is a dominant 7th in minor");
  assert.equal(named("Major", "V"), "G7", "V is a dominant 7th in major");
  assert.equal(named("Major", "IV"), "Fmaj7");
});

test("rootless voicing leaves the root to the bass", () => {
  const chords = [{ degree: 0, seventh: false, ...parseNumeral("i") }, { degree: 0, seventh: false, ...parseNumeral("iv") }]
    .map((s) => buildChord(9, SCALES.Dorian, s, "ninth"));
  const v = voice(9, chords, { center: 60, mode: "rootless", bass: false });
  v.forEach((notes, i) => {
    assert.equal(notes.length, 3);
    assert.ok(!notes.some((p) => p % 12 === (9 + chords[i].root) % 12), "no root");
  });
});

test("parallel styles open on the tonic", () => {
  const dub = STYLES.find((s) => s.id === "dub-techno")!;
  for (let seed = 1; seed <= 50; seed++) {
    assert.equal(generate(SCALES.Minor, 2, "eleventh", dub.harmony, seeded(seed))[0].degree, 0);
  }
});

test("hypnotic techno: one chord or a parallel move, always opening on i", () => {
  const style = STYLES.find((s) => s.id === "hypnotic")!;
  const seen = new Set<number>();
  for (let seed = 1; seed <= 200; seed++) {
    const steps = generate(SCALES.Phrygian, 2, style.chord, style.harmony, mixed(seed));
    assert.equal(steps[0].root, 0);
    seen.add(steps[1].root!);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [0, 1, 5, 7, 10]);
});

test("works for non-heptatonic scales", () => {
  const pentatonic = [0, 2, 4, 7, 9];
  const steps = generate(pentatonic, 4, "mixed", DIATONIC, seeded(3));
  assert.equal(steps.length, 4);
  for (const s of steps) assert.ok(s.degree >= 0 && s.degree < 5);
});

test("reroll changes only the chosen chord and avoids its neighbours", () => {
  const steps = generate(SCALES.Major, 4, "triad", DIATONIC, seeded(7));
  for (let seed = 1; seed <= 50; seed++) {
    const out = reroll(SCALES.Major, steps, 1, "triad", DIATONIC, seeded(seed));
    assert.equal(out[0], steps[0]);
    assert.equal(out[2], steps[2]);
    assert.notEqual(out[1].degree, steps[1].degree);
    assert.notEqual(out[1].degree, steps[0].degree);
    assert.notEqual(out[1].degree, steps[2].degree);
  }
});

test("reroll works on a one-chord loop", () => {
  const out = reroll(SCALES.Minor, [{ degree: 0, seventh: false }], 0, "eleventh", { movement: "parallel" }, seeded(1));
  assert.notEqual(out[0].degree, 0);
});

const movement = (v: number[][]) =>
  v.slice(1).reduce((s, c, i) => s + c.reduce((t, p, j) => t + Math.abs(p - v[i][j]), 0), 0);

test("smooth voicing moves less than close root-position voicing", () => {
  const cs = [0, 5, 3, 4].map((d) => chord(0, "Major", d, "triad"));
  const smooth = voice(0, cs, { center: 60, mode: "smooth", bass: false });
  const close = voice(0, cs, { center: 60, mode: "close", bass: false });
  assert.ok(movement(smooth) < movement(close), `${movement(smooth)} vs ${movement(close)}`);
  for (const v of smooth) for (const p of v) assert.ok(p >= 48 && p <= 80);
});

test("spread voicings are wider than close ones", () => {
  const cs = [0, 3].map((d) => chord(9, "Minor", d, "ninth"));
  const width = (v: number[][]) => Math.max(...v.map((c) => c[c.length - 1] - c[0]));
  assert.ok(width(voice(9, cs, { center: 60, mode: "spread", bass: false })) > width(voice(9, cs, { center: 60, mode: "close", bass: false })));
});

test("parallel voicing moves the exact same shape", () => {
  const cs = [0, 3, 6, 0].map((d) => chord(9, "Minor", d, "eleventh", "parallel"));
  const vs = voice(9, cs, { center: 60, mode: "smooth", bass: false, parallel: true });
  const shape = (v: number[]) => v.map((p) => p - v[0]);
  for (const v of vs) assert.deepEqual(shape(v), shape(vs[0]));
  for (const v of vs) assert.ok(Math.abs(v.reduce((a, b) => a + b, 0) / v.length - 60) <= 12);
});

test("bass note is the chord root two octaves down", () => {
  const [v] = voice(0, [chord(0, "Major", 4, "triad")], { center: 60, mode: "smooth", bass: true }); // G
  assert.equal(v[0], 43);
});
