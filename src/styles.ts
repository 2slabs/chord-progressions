// Genre presets. A style sets every control's starting value and how chords move;
// the user can still change any control afterwards.
import type { ChordType, Harmony, VoicingMode } from "./theory.ts";

export interface Style {
  id: string;
  label: string;
  /** One line shown in the dialog. */
  blurb: string;
  /** Launchpad-style pad colour for the chord pads (a CSS colour token in the dialog). */
  hue: "blue" | "green" | "orange" | "red" | "ink" | "unlit";
  scale: string;
  chord: ChordType;
  harmony: Harmony;
  count: number;
  beatsPerChord: number;
  rhythm: string;
  voicing: VoicingMode;
  register: number;
  bass: boolean;
  /** 16th swing, 50 = straight. */
  swing: number;
  /** Chord changes land a 16th early. */
  push: boolean;
}

// Diatonic matrices are indexed by scale degree: in Minor/Dorian that's
//   i  ii  ♭III  iv  v  ♭VI(VI)  ♭VII

// Deep house: i–iv vamps, i–♭VII–♭VI, ii–v in Dorian. Little use of the leading tone.
const DEEP_HOUSE: number[][] = [
  [0, 6, 14, 36, 10, 14, 20],
  [20, 0, 8, 10, 40, 10, 12],
  [15, 4, 0, 25, 10, 30, 16],
  [38, 5, 10, 0, 22, 10, 15],
  [40, 4, 10, 22, 0, 14, 10],
  [20, 4, 14, 16, 8, 0, 38],
  [42, 4, 20, 12, 4, 18, 0],
];

// Detroit: minor pads sliding between i, ♭VI, ♭VII and ♭III.
const DETROIT: number[][] = [
  [0, 2, 20, 18, 6, 27, 27],
  [25, 0, 10, 10, 25, 15, 15],
  [20, 2, 0, 15, 5, 30, 28],
  [30, 2, 15, 0, 13, 18, 22],
  [35, 2, 10, 20, 0, 18, 15],
  [25, 2, 16, 14, 4, 0, 39],
  [40, 2, 25, 10, 4, 19, 0],
];

// Classic house: I–vi–IV–V / vi–IV–I–V loops and ii–V turnarounds.
const CLASSIC_HOUSE: number[][] = [
  [0, 14, 4, 30, 22, 30, 0],
  [12, 0, 4, 10, 54, 14, 6],
  [8, 8, 0, 30, 4, 50, 0],
  [30, 12, 4, 0, 34, 20, 0],
  [44, 4, 4, 18, 0, 30, 0],
  [10, 20, 8, 42, 20, 0, 0],
  [60, 0, 20, 0, 0, 20, 0],
];

// Real progressions, from transcriptions and analyses (RESEARCH.md has the sources).
// Numerals are relative to the tonic, flats from the major scale; case = quality.

// Dub techno: harmony is mostly static (one tonal centre, a few minor stabs shifted by
// chord memory). A one-chord loop repeats; two-chord loops move to iv, ♭VII, v or ♭VI.
const DUB_PROGRESSIONS: Harmony["progressions"] = {
  minor: [[4, "i"], [3, "i iv"], [3, "i bvii"], [2, "i v"], [1, "i bvi"]],
};

// Deep house: mostly two minor 7ths (Kerri Chandler: D♯m7–G♯m7, Cm7–Gm7, Cm–A♯m,
// D♯m–Bm; Disclosure i7–v7), plus Masters at Work's i7–♭IIImaj7–v7, Mr Fingers'
// i–♭VImaj7–♭VII, Modjo's ♭VI–iv–i–v and the "Levelling Up" 8-bar loop with its bar-8 change.
const DEEP_PROGRESSIONS: Harmony["progressions"] = {
  minor: [
    [4, "i iv"], [4, "i v"], [3, "i bvii"], [2, "i bvi"], [2, "v bVI"], [1, "iv v"],
    [3, "i bIII v"], [3, "i bVI bVII"], [2, "i v iv"], [1, "i v vi"],
    [2, "bVI iv i v"], [1, "i iv bVI iv"], [1, "v bVI iv bVII7"], [1, "i bVII bVI bVII"], [1, "i v bvii iv"],
    [2, "i i v v i i v iii"],
  ],
  major: [[2, "ii iii"], [2, "IV iii"], [1, "ii V I vi"], [1, "I vi IV ii"]],
};

// Classic house: Frankie Knuckles' Imaj7–IVmaj7, Marshall Jefferson's ♭III–iv–i, Crystal
// Waters' i7–v7sus4, MK's iv–♭VI–♭VII, Armand Van Helden's i7–IV–♭VII, Stardust's v7–♭VI7.
const CLASSIC_PROGRESSIONS: Harmony["progressions"] = {
  major: [[4, "I IV"], [2, "ii V I vi"], [2, "I iii V"], [1, "iii vi IV I"], [1, "I vi V iii"], [1, "vi IV I V"]],
  minor: [
    [3, "bIII iv i"], [3, "i vsus4"], [3, "iv bVI bVII"], [2, "i IV bVII7"], [2, "v bVI"], [1, "bVI bIII bVI bVII7"],
  ],
};

// Detroit: chord-memory minors (Inner City's "Good Life" is Bm–F♯m–Am–Em, i–v–♭vii–iv, all
// minor) and the jazzier major side (Galaxy 2 Galaxy's IVmaj7–iii7, Los Hermanos' ii7–iii7).
const DETROIT_PROGRESSIONS: Harmony["progressions"] = {
  minor: [[4, "i v bvii iv"], [2, "i iv"], [2, "i bvii"], [2, "i iv v"], [1, "i bvi bvii"]],
  major: [[3, "IV iii"], [3, "ii iii"], [2, "I vi IV ii"], [1, "V IV"]],
};

// Hypnotic techno: one chord, or the same shape moved (parallel stabs, as in UR's "Timeline").
const HYPNOTIC_PROGRESSIONS: Harmony["progressions"] = {
  minor: [[4, "i"], [2, "i bII"], [2, "i bvii"], [1, "i iv"], [1, "i v"]],
};

export const STYLES: Style[] = [
  {
    id: "dub-techno",
    label: "Dub Techno",
    hue: "blue",
    blurb: "Mostly one minor 7th stab, sometimes shifted to iv or ♭VII; short, sparse hits that leave space for the delay.",
    scale: "Minor",
    chord: "seventh",
    harmony: { movement: "parallel", roots: [0, 0, 12, 34, 22, 14, 26], transitions: DETROIT, progressions: DUB_PROGRESSIONS },
    count: 2,
    beatsPerChord: 8,
    rhythm: "dub-dotted",
    voicing: "close",
    register: 60,
    bass: false,
    swing: 50,
    push: false,
  },
  {
    id: "deep-house",
    label: "Deep House",
    hue: "green",
    blurb: "Two-chord minor 9th loops with the root left to the bass, stabs off the kick that land a 16th early.",
    scale: "Dorian",
    chord: "ninth",
    harmony: {
      movement: "diatonic", transitions: DEEP_HOUSE, tonicStart: 0.85, progressions: DEEP_PROGRESSIONS,
      turnarounds: { minor: ["iii", "bvi", "v", "bVII", "iv"], major: ["V", "vi"] },
    },
    count: 2,
    beatsPerChord: 4,
    rhythm: "deep-stab",
    voicing: "rootless",
    register: 60,
    bass: false,
    swing: 58,
    push: true,
  },
  {
    id: "classic-house",
    label: "Classic House",
    hue: "orange",
    blurb: "Piano-house 7ths: Imaj7–IVmaj7 vamps and Chicago minor loops, the 3-3-4 piano riff.",
    scale: "Major",
    chord: "seventh",
    harmony: {
      movement: "diatonic", transitions: CLASSIC_HOUSE, progressions: CLASSIC_PROGRESSIONS,
      turnarounds: { major: ["V", "ii", "IV"], minor: ["bVII7", "v"] },
    },
    count: 4,
    beatsPerChord: 4,
    rhythm: "piano-house",
    voicing: "smooth",
    register: 60,
    bass: false,
    swing: 54,
    push: true,
  },
  {
    id: "detroit",
    label: "Detroit Techno",
    hue: "red",
    blurb: "Chord-memory minors (i–v–♭vii–iv, all minor), wide 9th pads, held or pulsing.",
    scale: "Minor",
    chord: "ninth",
    harmony: { movement: "diatonic", transitions: DETROIT, tonicStart: 0.9, progressions: DETROIT_PROGRESSIONS },
    count: 4,
    beatsPerChord: 4,
    rhythm: "sustain",
    voicing: "spread",
    register: 60,
    bass: false,
    swing: 50,
    push: false,
  },
  {
    id: "hypnotic",
    label: "Hypnotic Techno",
    hue: "ink",
    blurb: "One minor stab, or the same shape moved to ♭II or ♭VII; single 16th hits off the beat.",
    scale: "Phrygian",
    chord: "triad",
    // Degrees: –, ♭II, ♭III, iv, v, ♭VI, ♭VII
    harmony: { movement: "parallel", roots: [0, 34, 8, 16, 12, 8, 22], transitions: DEEP_HOUSE, progressions: HYPNOTIC_PROGRESSIONS },
    count: 2,
    beatsPerChord: 8,
    rhythm: "techno-stab",
    voicing: "close",
    register: 60,
    bass: false,
    swing: 50,
    push: false,
  },
  {
    id: "functional",
    label: "Functional (pop)",
    hue: "unlit",
    blurb: "Classic tonic–predominant–dominant movement with triads.",
    scale: "Major",
    chord: "triad",
    harmony: { movement: "diatonic" },
    count: 4,
    beatsPerChord: 4,
    rhythm: "sustain",
    voicing: "smooth",
    register: 60,
    bass: true,
    swing: 50,
    push: false,
  },
];

export const styleById = (id: string) => STYLES.find((s) => s.id === id) ?? STYLES[0];
