import { test } from "node:test";
import assert from "node:assert/strict";
import { RHYTHMS, steps, toNotes } from "../src/rhythm.ts";

const C = [60, 64, 67];
const Am = [57, 60, 64];
const starts = (id: string, beats = 4, pitch = 60) =>
  toNotes([C], beats, false, id).filter((n) => n.pitch === pitch).map((n) => n.startTime);

test("sustain lays chords end to end", () => {
  const notes = toNotes([C, Am], 4, false, "sustain");
  assert.equal(notes.length, 6);
  assert.deepEqual(notes.map((n) => n.startTime), [0, 0, 0, 4, 4, 4]);
  assert.ok(notes.every((n) => n.duration === 4));
});

test("every rhythm keeps notes inside their chord, for every chord length, with any groove", () => {
  for (const r of RHYTHMS) {
    for (const beats of [2, 4, 8, 16]) {
      for (const voicing of [C, [60, 64, 67, 71, 74]]) {
        for (const groove of [{}, { swing: 62 }, { push: true, swing: 58 }]) {
          const notes = toNotes([voicing, voicing, voicing], beats, false, r.id, groove);
          assert.ok(notes.length > 0, r.id);
          for (const n of notes) {
            assert.ok(n.duration > 0, `${r.id}: zero-length note`);
            assert.ok(n.startTime >= 0 && n.startTime + n.duration <= 3 * beats + 1e-9, `${r.id}: outside clip`);
            assert.ok(voicing.includes(n.pitch), `${r.id}: unexpected pitch ${n.pitch}`);
            assert.ok(n.velocity >= 1 && n.velocity <= 127);
          }
          // No voice overlaps itself (a pushed chord must cut off the one before).
          for (const p of voicing) {
            const ns = notes.filter((n) => n.pitch === p).sort((a, b) => a.startTime - b.startTime);
            for (let i = 1; i < ns.length; i++) {
              assert.ok(ns[i - 1].startTime + ns[i - 1].duration <= ns[i].startTime + 1e-9, `${r.id}: overlapping ${p}`);
            }
          }
        }
      }
    }
  }
});

test("step patterns: X/x hit, - holds, . rests", () => {
  const hits = steps("X--.x...........")(4, 3);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].start, 0);
  assert.ok(Math.abs(hits[0].duration - 0.72) < 1e-9);
  assert.ok(hits[0].velocity > hits[1].velocity);
  assert.equal(hits[1].start, 1);
  assert.throws(() => steps("x..."));
});

test("bar patterns repeat each bar and are cut off at the chord end", () => {
  assert.deepEqual(starts("tresillo"), [0, 1.5, 3]);
  assert.deepEqual(starts("tresillo", 8), [0, 1.5, 3, 4, 5.5, 7]);
  assert.deepEqual(starts("tresillo", 2), [0, 1.5]);
  assert.deepEqual(starts("piano-house"), [0, 0.75, 1.5, 2.5, 3.25]);
  assert.deepEqual(starts("dub-dotted"), [0, 0.75, 1.5]);
  assert.deepEqual(starts("house-offbeat"), [0.5, 1.5, 2.5, 3.5]);
});

test("swing delays only the off-16ths", () => {
  const swung = toNotes([C], 4, false, "techno-offbeat-16", { swing: 58 }).filter((n) => n.pitch === 60);
  assert.ok(Math.abs(swung[0].startTime - 0.29) < 1e-9);
  const straight8ths = toNotes([C], 4, false, "eighths", { swing: 62 }).filter((n) => n.pitch === 60);
  assert.deepEqual(straight8ths.map((n) => n.startTime), [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
});

test("push moves each later chord change a 16th early and cuts the previous chord", () => {
  const notes = toNotes([C, Am], 4, false, "sustain", { push: true });
  const c = notes.filter((n) => n.startTime === 0);
  const am = notes.filter((n) => n.startTime > 0);
  assert.ok(am.every((n) => n.startTime === 3.75 && n.duration === 4.25));
  assert.ok(c.every((n) => n.duration === 3.75));
});

test("push leaves the previous chord alone when the next has nothing on its downbeat", () => {
  const notes = toNotes([C, Am], 4, false, "dub-offbeat", { push: true });
  assert.deepEqual([...new Set(notes.map((n) => n.startTime))], [0.5, 2.5, 4.5, 6.5]);
});

test("bass holds the whole chord under any rhythm", () => {
  const notes = toNotes([[36, ...C]], 4, true, "eighths");
  const bass = notes.filter((n) => n.pitch === 36);
  assert.equal(bass.length, 1);
  assert.equal(bass[0].duration, 4);
  assert.equal(notes.filter((n) => n.pitch === 60).length, 8);
});

test("arpeggios walk the chord in order", () => {
  const seq = (id: string) => toNotes([C], 4, false, id).map((n) => n.pitch);
  assert.deepEqual(seq("arp-up-8"), [60, 64, 67, 60, 64, 67, 60, 64]);
  assert.deepEqual(seq("arp-down-8"), [67, 64, 60, 67, 64, 60, 67, 64]);
  assert.deepEqual(seq("arp-updown-8"), [60, 64, 67, 64, 60, 64, 67, 64]);
  assert.deepEqual(seq("alberti-8"), [60, 67, 64, 67, 60, 67, 64, 67]);
  assert.equal(seq("arp-up-16").length, 16);
});

test("strum staggers the notes upward", () => {
  const notes = toNotes([C], 4, false, "strum");
  assert.deepEqual(notes.map((n) => n.pitch), [60, 64, 67]);
  assert.ok(notes[0].startTime < notes[1].startTime && notes[1].startTime < notes[2].startTime);
});

test("unknown rhythm ids fall back to sustain", () => {
  assert.deepEqual(toNotes([C], 4, false, "nope"), toNotes([C], 4, false, "sustain"));
});

test("barOf shows any rhythm as 16 steps", async () => {
  const { barOf } = await import("../src/rhythm.ts");
  assert.equal(barOf("dub-dotted"), "X..x..x.........");
  assert.equal(barOf("sustain"), "x---------------");
  assert.equal(barOf("arp-up-8"), "X-x-X-x-X-x-X-x-");
  assert.equal(barOf("custom:x.x.x.x.x.x.x.x."), "x.x.x.x.x.x.x.x.");
});

test("custom rhythms play their steps; bad ones fall back to sustain", async () => {
  const { customRhythm, isRhythm } = await import("../src/rhythm.ts");
  assert.deepEqual(starts(customRhythm("x...x...x...x...")), [0, 1, 2, 3]);
  assert.ok(isRhythm(customRhythm("x...............")));
  assert.ok(!isRhythm("custom:nope"));
  assert.deepEqual(toNotes([C], 4, false, "custom:nope"), toNotes([C], 4, false, "sustain"));
});
