# What the chord engine is based on

The progressions, chord qualities, voicings and stab rhythms in `src/styles.ts`, `src/theory.ts` and `src/rhythm.ts` come from transcriptions and analyses of real tracks. This file lists the sources and what was taken from each.

## How it works now

Each genre style has a weighted list of **real progressions** written as roman numerals: case gives the quality, and flats are counted from the major scale (`i v bvii iv`). Two consequences:

- **Quality is part of the progression.** These genres often ignore what the key "should" give. Inner City's "Good Life" is four minor chords, i–v–♭vii–iv (Bm F♯m Am Em in B minor). Kerri Chandler moves Cm to A♯m and D♯m to Bm. If the major versions are swapped in, the track "loses a lot of its character" ([Mode Audio](https://modeaudio.com/magazine/production-secrets-parallel-chords)). The Chord control sets how far each chord is extended (7th, 9th, 11th). A major chord takes the 7th that's in the key (V7, ♭VII7, but ♭VImaj7).
- **Loops repeat.** A two-chord loop fills four or eight chords by repeating. When it does, there's a 40% chance the last chord changes, like the "different chord in the eighth bar" move in Attack's stab tutorial.

Functional (pop) keeps the old random walk over scale degrees. It's also the fallback when no real progression fits the chord count.

## Sources

**Attack Magazine, "Passing Notes" (music theory for dance producers)**
- [Kerri Chandler Chords](https://www.attackmagazine.com/technique/passing-notes/kerri-chandler-chords/) and [Part 2](https://www.attackmagazine.com/technique/passing-notes/kerri-chandler-chords-part2/), ten-plus tracks:
  - Mostly two-chord loops of minor 7ths: D♯m7→G♯m7 ("The Way It Goes"), D♯m7(11)→Bm(13) ("The Sound Is Yours"), G♯m7→D♯m/F♯ ("Atmosphere"), Cm→A♯m ("Checkmate").
  - Parallel minor 7ths: G♯m7–D♯m7–C♯m7 ("Come Home").
  - Cm7–Gm7–Am7 over a pedal bass ("Mommy What's a Record").
  - Chained ii–Vs in "Rain".
  - Habits:
    - third-inversion 7ths (the 7th at the bottom);
    - **roots left out of stabs because the bass plays them**;
    - fifths swapped for 11ths or 13ths;
    - the next chord arriving a 16th early;
    - stabs and bass alternating rather than hitting together.
- [Deep House Chords](https://www.attackmagazine.com/technique/passing-notes/passing-notes-deep-house-chords/): Masters at Work, "To Be In Love", is Fm7–A♭maj7–Cm7 (i–♭IIImaj7–v), F Dorian. Keep the 7th when thinning a chord.
- [Further Chords](https://www.attackmagazine.com/technique/passing-notes/further-deep-house-techno-chords/): the sampled minor 9 of Kerri Chandler's "Where Is Love?" and Theo Parrish's "Ebonics".
- [Levelling Up Your Chord Stabs](https://www.attackmagazine.com/technique/passing-notes/levelling-up-your-chord-stabs/):
  - An 8-bar loop, Cm7 Cm7 Gm7 Gm7 Cm7 Cm7 Gm7 Em7. It's in the deep house list, and it's where the turnaround rule comes from.
  - Stabs "leave out notes occupied by the main drum hits" and favour off-beat 16ths, some held and most short. That's the new **deep stab** rhythm.
  - 9ths sit at different heights in different chords.
- [The Theory of Techno Parallel Chord Stabs](https://www.attackmagazine.com/technique/tutorials/the-theory-of-techno-parallel-chord-stabs/): one shape moved around, even out of key (UR's "Timeline"). The stabs are single 16ths off the downbeat. This is why hypnotic techno uses the parallel move.
- [Basic Channel-Style Dub Techno](https://www.attackmagazine.com/technique/beat-dissected/basic-channel-style-dub-techno/) and [Old-School House Chords](https://www.attackmagazine.com/technique/synth-secrets/old-school-house-chords/): a single minor chord stab, pitched or chord-memory'd, with the movement coming from delay and filter.
- [Ostinatos and Acid House Riffs](https://www.attackmagazine.com/technique/passing-notes/ostinatos-and-acid-house-riffs/): "Can You Feel It" uses minor and major 7ths from natural A minor.

**Hooktheory TheoryTab** (crowd-sourced, per-section roman-numeral analyses), read for 169 songs by house and techno artists. The useful ones:

| track | analysis | used as |
|---|---|---|
| Mr Fingers, "Can You Feel It" | i(add9) ♭VImaj7 ♭VII(add9) | deep `i bVI bVII` |
| Inner City, "Good Life" | i v ♭vii iv, all minor | detroit `i v bvii iv` |
| Frankie Knuckles, "The Whistle Song" | Imaj7 IVmaj7 | classic `I IV` |
| Marshall Jefferson, "Ride the Rhythm" | ♭III iv i | classic `bIII iv i` |
| Crystal Waters, "100% Pure Love" | i7 i11sus2 / i7 v7sus4 | classic `i vsus4` |
| Crystal Waters, "Gypsy Woman" | v7 ♭VI7 iv7 ♭VII7 … | deep `v bVI iv bVII7` |
| MK, "17" | iv ♭VI ♭VII | classic `iv bVI bVII` |
| Armand Van Helden, "You Don't Know Me" | i7 IV ♭VII11 | classic `i IV bVII7` |
| Stardust, "Music Sounds Better With You" | v7 ♭VI7 | deep/classic `v bVI` |
| Modjo, "Lady" / "Music Takes You Back" | i9 i7 ♭VII ♭VI / ♭VI7 iv7 i7 v7 | deep `bVI iv i v`, `i bVII bVI bVII` |
| Disclosure, "Holding On" / "Ultimatum" | i7 v7 iv7 / i7 iv7 ♭VI9 iv7 | deep `i v iv`, `i iv bVI iv` |
| Galaxy 2 Galaxy, "Hi-Tech Jazz" | IVmaj7 iii7 … | detroit (major) `IV iii` |
| Los Hermanos, "O Vencedor" / "O Vento" | ii7 iii7 / Imaj7 vi IVmaj7 ii | detroit (major) |
| Bob Sinclar, MK "Dior" | I iii V / iii vi IV I | classic (major) |

**Mode Audio, [Parallel Chords](https://modeaudio.com/magazine/production-secrets-parallel-chords)**: why house and techno keep minor chords minor. Early producers pitched a single chord sample around, so every chord had the same shape.

## Gaps

- **Dub techno and hypnotic techno**: no transcriptions found. The sources describe static harmony on one tonal centre and parallel stabs, and the progressions follow that description (`i`, `i iv`, `i bvii`, `i v`).
- **Hypnotic ♭II**: comes from general Phrygian practice, not from a specific track.
- **Detroit minor**: beyond Good Life, the minor loops (`i iv v`, `i bvi bvii`) are chord-memory variations, not transcriptions.
- **Next step**: transcribe a few reference tracks per genre and add them here.
