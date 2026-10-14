import * as fs from "node:fs";
import * as path from "node:path";
import {
  initialize,
  ClipSlot,
  DataModelObject,
  MidiClip,
  MidiTrack,
  TakeLane,
  type ActivationContext,
  type ArrangementSelection,
  type ExtensionContext,
  type Handle,
} from "@ableton-extensions/sdk";

// build.ts inlines this HTML (with the bundled ui/app.ts) as a string.
import dialogHtml from "../ui/interface.html";
import type { Init, Result, Settings } from "./protocol.ts";

type Context = ExtensionContext<"1.0.0">;

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  context.commands.registerCommand("chord-progressions.clipSlot", (arg) =>
    run(() => fromClipSlot(context, arg as Handle)),
  );
  context.commands.registerCommand("chord-progressions.arrangement", (arg) =>
    run(() => fromArrangement(context, arg as ArrangementSelection)),
  );

  context.ui.registerContextMenuAction("ClipSlot", "Generate Chord Progression…", "chord-progressions.clipSlot");
  context.ui.registerContextMenuAction(
    "MidiTrack.ArrangementSelection",
    "Generate Chord Progression…",
    "chord-progressions.arrangement",
  );
}

function run(task: () => Promise<void>) {
  task().catch((err) => console.error("chord-progressions:", err));
}

async function fromClipSlot(context: Context, handle: Handle) {
  const slot = context.getObjectFromHandle(handle, ClipSlot);
  if (!(slot.parent instanceof MidiTrack)) {
    console.warn("chord-progressions: right-click a clip slot on a MIDI track.");
    return;
  }
  if (slot.clip) {
    console.warn("chord-progressions: that slot already has a clip; use an empty slot.");
    return;
  }
  const result = await openDialog(context);
  if (!result) return;
  const clip = await slot.createMidiClip(result.length);
  fill(context, clip, result);
}

async function fromArrangement(context: Context, selection: ArrangementSelection) {
  const lane = selection.selected_lanes
    .map((h) => context.getObjectFromHandle(h, DataModelObject))
    .find((o) => o instanceof MidiTrack || (o instanceof TakeLane && o.parent instanceof MidiTrack));
  if (!lane) {
    console.warn("chord-progressions: select a time range on a MIDI track.");
    return;
  }
  const result = await openDialog(context);
  if (!result) return;
  const target = lane as MidiTrack<"1.0.0"> | TakeLane<"1.0.0">;
  const clip = await target.createMidiClip(selection.time_selection_start, result.length);
  fill(context, clip, result);
}

function fill(context: Context, clip: MidiClip<"1.0.0">, result: Result) {
  context.withinTransaction(() => {
    clip.name = result.name;
    clip.notes = result.notes;
  });
}

async function openDialog(context: Context): Promise<Result | null> {
  const song = context.application.song;
  const init: Init = {
    live: song.scaleMode ? { root: song.rootNote, name: song.scaleName, intervals: song.scaleIntervals } : null,
    tempo: song.tempo,
    saved: loadSettings(context),
  };
  // Escape "<" so the JSON can't close the <script> it's embedded in.
  const json = JSON.stringify(init).replace(/</g, "\\u003c");
  const html = dialogHtml.replace("window.__INIT__ = null;", () => `window.__INIT__ = ${json};`);
  const raw = await context.ui.showModalDialog(`data:text/html,${encodeURIComponent(html)}`, 600, 330);
  if (!raw) return null; // cancelled
  const result = JSON.parse(raw) as Result;
  saveSettings(context, result.settings);
  return result;
}

function settingsFile(context: Context): string | null {
  const dir = context.environment.storageDirectory;
  return dir ? path.join(dir, "settings.json") : null;
}

function loadSettings(context: Context): Settings | null {
  const file = settingsFile(context);
  try {
    return file ? (JSON.parse(fs.readFileSync(file, "utf8")) as Settings) : null;
  } catch {
    return null;
  }
}

function saveSettings(context: Context, settings: Settings) {
  const file = settingsFile(context);
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.warn("chord-progressions: couldn't save settings:", err);
  }
}
