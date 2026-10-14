import { test } from "node:test";
import assert from "node:assert/strict";
import { RHYTHMS, toNotes } from "../src/rhythm.ts";

const C = [60, 64, 67];
const Am = [57, 60, 64];
const withBass = (v: number[], bass: number) => [bass, ...v];

test("sustain lays chords end to end", () => {
  const notes = toNotes([C, Am], 4, false, "sustain");
  assert.equal(notes.length, 6);
  assert.deepEqual(notes.map((n) => n.startTime), [0, 0, 0, 4, 4, 4]);
  assert.ok(notes.every((n) => n.duration === 4));
});

test("every rhythm keeps notes inside their chord, for every chord length", () => {
  for (const r of RHYTHMS) {
    for (const beats of [2, 4, 8]) {
      for (const voicing of [C, [60, 64, 67, 71]]) {
        const notes = toNotes([voicing, voicing], beats, false, r.id);
        assert.ok(notes.length > 0, r.id);
        for (const n of notes) {
          const chordStart = n.startTime >= beats ? beats : 0;
          assert.ok(n.duration > 0, `${r.id}: zero-length note`);
          assert.ok(n.startTime + n.duration <= chordStart + beats + 1e-9, `${r.id} @${beats}: note runs past chord`);
          assert.ok(voicing.includes(n.pitch), `${r.id}: unexpected pitch ${n.pitch}`);
          assert.ok(n.velocity >= 1 && n.velocity <= 127);
        }
      }
    }
  }
});

test("bass holds the whole chord under any rhythm", () => {
  const notes = toNotes([withBass(C, 36)], 4, true, "eighths");
  const bass = notes.filter((n) => n.pitch === 36);
  assert.equal(bass.length, 1);
  assert.equal(bass[0].duration, 4);
  assert.equal(notes.filter((n) => n.pitch === 60).length, 8);
});

test("quarters hit every beat with the downbeat accented", () => {
  const top = toNotes([C], 4, false, "quarters").filter((n) => n.pitch === 67);
  assert.deepEqual(top.map((n) => n.startTime), [0, 1, 2, 3]);
  assert.ok(top[0].velocity > top[1].velocity);
});

test("offbeats land between the beats", () => {
  const starts = toNotes([C], 4, false, "offbeats").filter((n) => n.pitch === 60).map((n) => n.startTime);
  assert.deepEqual(starts, [0.5, 1.5, 2.5, 3.5]);
});

test("3-3-2 repeats each bar and is cut off at the chord end", () => {
  const starts = (beats: number) => toNotes([C], beats, false, "tresillo").filter((n) => n.pitch === 60).map((n) => n.startTime);
  assert.deepEqual(starts(4), [0, 1.5, 3]);
  assert.deepEqual(starts(8), [0, 1.5, 3, 4, 5.5, 7]);
  assert.deepEqual(starts(2), [0, 1.5]);
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
  assert.ok(notes.every((n) => n.startTime + n.duration === 4));
});

test("unknown rhythm ids fall back to sustain", () => {
  assert.deepEqual(toNotes([C], 4, false, "nope"), toNotes([C], 4, false, "sustain"));
});
