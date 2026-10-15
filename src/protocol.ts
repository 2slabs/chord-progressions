// Data passed between the extension and the dialog.
import type { SourceNote } from "./analysis.ts";
import type { ChordType, Movement, Note, VoicingMode } from "./theory.ts";

/** A clip the chords can follow (a bassline, a melody, chords to restyle). Notes relative to its start. */
export interface SourceOption {
  id: string;
  label: string;
  notes: SourceNote[];
  length: number;
}

/** Somewhere the chord clip can go (only when started from a clip). */
export interface TargetOption {
  id: string;
  label: string;
  /** Why it can't be used, shown greyed out. */
  disabled?: string;
}

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
  /** Play the followed clip under the preview. */
  hearSource?: boolean;
}

export interface Init {
  /** Where the dialog was opened from. */
  mode?: "clip" | "slot" | "arrangement";
  /** Clips the chords can follow. */
  sources?: SourceOption[];
  /** A source id, or "scratch". */
  defaultSource?: string;
  /** Choices of destination, or null when the clip goes where the user clicked. */
  targets?: TargetOption[] | null;
  defaultTarget?: string;
  /** Plain description of where the clip will go, e.g. "Keys, scene 3". */
  where?: string;
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
  /** A TargetOption id, when targets were offered. */
  target?: string;
  settings: Settings;
}
