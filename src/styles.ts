// Genre presets. A style sets every control's starting value and how chords move;
// the user can still change any control afterwards.
import type { ChordType, Harmony, VoicingMode } from "./theory.ts";

export interface Style {
  id: string;
  label: string;
  /** One line shown in the dialog. */
  blurb: string;
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

export const STYLES: Style[] = [
  {
    id: "dub-techno",
    label: "Dub Techno",
    blurb: "One minor 11 shape shifted to new roots, long sparse stabs – leave space for the delay.",
    scale: "Minor",
    chord: "eleventh",
    // Degrees: –, ii, ♭III, iv, v, ♭VI, ♭VII
    harmony: { movement: "parallel", roots: [0, 0, 12, 34, 22, 14, 26], transitions: DETROIT },
    count: 2,
    beatsPerChord: 8,
    rhythm: "dub-dotted",
    voicing: "smooth",
    register: 60,
    bass: false,
    swing: 50,
    push: false,
  },
  {
    id: "deep-house",
    label: "Deep House",
    blurb: "Minor 9ths in Dorian, i–iv and i–♭VII–♭VI movement, swung stabs that land early.",
    scale: "Dorian",
    chord: "ninth",
    harmony: { movement: "diatonic", transitions: DEEP_HOUSE, tonicStart: 0.85 },
    count: 4,
    beatsPerChord: 4,
    rhythm: "house-stab",
    voicing: "smooth",
    register: 60,
    bass: false,
    swing: 58,
    push: true,
  },
  {
    id: "classic-house",
    label: "Classic House",
    blurb: "Piano-house 7ths with functional movement and the 3-3-4 piano riff.",
    scale: "Major",
    chord: "seventh",
    harmony: { movement: "diatonic", transitions: CLASSIC_HOUSE },
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
    blurb: "Minor 9th pads sliding between i, ♭VI, ♭VII and ♭III, held or pulsing.",
    scale: "Minor",
    chord: "ninth",
    harmony: { movement: "diatonic", transitions: DETROIT, tonicStart: 0.9 },
    count: 4,
    beatsPerChord: 8,
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
    blurb: "One or two quartal stabs in Phrygian, ♭II moves, syncopated 16ths.",
    scale: "Phrygian",
    chord: "quartal",
    // Degrees: –, ♭II, ♭III, iv, v, ♭VI, ♭VII
    harmony: { movement: "parallel", roots: [0, 34, 8, 16, 12, 8, 22], transitions: DEEP_HOUSE },
    count: 2,
    beatsPerChord: 8,
    rhythm: "techno-332",
    voicing: "close",
    register: 60,
    bass: false,
    swing: 50,
    push: false,
  },
  {
    id: "functional",
    label: "Functional (pop)",
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
