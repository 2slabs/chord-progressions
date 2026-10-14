// Data passed between the extension and the dialog.
import type { ChordType, Movement, Note, VoicingMode } from "./theory.ts";

export interface Settings {
  /** Bumped when the shape changes, so stale saved settings are ignored. */
  version: 2;
  /** A STYLES id. */
  style: string;
  root: number;
  /** A key of SCALES, or "live" for Live's current scale. */
  scale: string;
  count: number;
  beatsPerChord: number;
  chord: ChordType;
  movement: Movement;
  voicing: VoicingMode;
  register: number;
  bass: boolean;
  /** A RHYTHMS id. */
  rhythm: string;
  swing: number;
  push: boolean;
  /** Dialog theme; dark matches Live's default. */
  theme?: "dark" | "light";
}

export interface Init {
  /** Live's current scale, when Scale Mode is on. */
  live: { root: number; name: string; intervals: number[] } | null;
  tempo: number;
  /** Settings from the last time the dialog was confirmed. */
  saved: Settings | null;
}

/** Sent when the dialog is cancelled, so settings like the theme still stick. */
export interface Cancelled {
  cancelled: true;
  settings: Settings;
}

export interface Result {
  name: string;
  /** Clip length in beats. */
  length: number;
  notes: Note[];
  settings: Settings;
}
