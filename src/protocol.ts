// Data passed between the extension and the dialog.
import type { Note, SeventhMode } from "./theory.ts";

export interface Settings {
  root: number;
  /** A key of SCALES, or "live" for Live's current scale. */
  scale: string;
  count: number;
  beatsPerChord: number;
  sevenths: SeventhMode;
  smooth: boolean;
  register: number;
  bass: boolean;
}

export interface Init {
  /** Live's current scale, when Scale Mode is on. */
  live: { root: number; name: string; intervals: number[] } | null;
  tempo: number;
  /** Settings from the last time the dialog was confirmed. */
  saved: Settings | null;
}

export interface Result {
  name: string;
  /** Clip length in beats. */
  length: number;
  notes: Note[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  root: 0,
  scale: "Major",
  count: 4,
  beatsPerChord: 4,
  sevenths: "none",
  smooth: true,
  register: 60,
  bass: true,
};
