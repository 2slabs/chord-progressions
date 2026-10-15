// Dialog logic. Bundled and inlined into interface.html by build.ts.
import {
  SCALES, ROOT_LABELS, noteNames, buildChord, generate, reroll, rollSeventh, voice,
  type ChordType, type Harmony, type Movement, type Note, type Step, type VoicingMode,
} from "../src/theory.ts";
import { RHYTHMS, barOf, customRhythm, isRhythm, toNotes } from "../src/rhythm.ts";
import { STYLES, styleById, type Style } from "../src/styles.ts";
import { detectLoopKey } from "../src/analysis.ts";
import { harmonize, rerollToFit } from "../src/harmonize.ts";
import type { Cancelled, Init, Result, Settings, SourceOption } from "../src/protocol.ts";
import { applyTheme, closeDialog, fillSelect, radioGroup, slider, toggle } from "./2sl/ui.ts";

declare global {
  interface Window {
    __INIT__: Init | null;
  }
}

const init: Init = window.__INIT__ ?? demoInit();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- state -----------------------------------------------------------------

const scaleKeys = Object.keys(SCALES);
const liveUsable = !!init.live && init.live.intervals.length >= 5;

function fromStyle(style: Style, root: number): Settings {
  return {
    version: 2,
    style: style.id,
    root,
    scale: style.scale,
    count: style.count,
    beatsPerChord: style.beatsPerChord,
    chord: style.chord,
    movement: style.harmony.movement,
    voicing: style.voicing,
    register: style.register,
    bass: style.bass,
    rhythm: style.rhythm,
    swing: style.swing,
    push: style.push,
  };
}

function initialSettings(): Settings {
  const saved = init.saved;
  if (saved?.version === 2) {
    const s = { ...fromStyle(styleById(saved.style), saved.root), ...saved };
    if (s.scale === "live" ? !liveUsable : !SCALES[s.scale]) s.scale = styleById(s.style).scale;
    if (!isRhythm(s.rhythm)) s.rhythm = styleById(s.style).rhythm;
    return s;
  }
  // First run: the first style, in Live's key if Scale Mode is on.
  const s = fromStyle(STYLES[0], liveUsable ? init.live!.root : 9);
  if (liveUsable) s.scale = scaleKeys.includes(init.live!.name) ? init.live!.name : "live";
  return s;
}

let settings = initialSettings();
const intervals = () => (settings.scale === "live" ? init.live!.intervals : SCALES[settings.scale]);
const harmony = (): Harmony => ({ ...styleById(settings.style).harmony, movement: settings.movement });

// ---- following a clip --------------------------------------------------------------

const sources = init.sources ?? [];
let sourceId = sources.some((s) => s.id === init.defaultSource) ? init.defaultSource! : "scratch";
let target = init.defaultTarget ?? "new";
const source = (): SourceOption | null => sources.find((s) => s.id === sourceId) ?? null;
/** How the last harmonisation went, for the hint next to the source. */
let fitInfo = "";

/** Following a clip: its key, unless Live's Scale Mode says otherwise. */
function adoptKey(src: SourceOption) {
  if (liveUsable) return;
  const k = detectLoopKey(src.notes, src.length);
  settings.root = k.root;
  settings.scale = k.scale;
}

/** Chord count: set by the clip's length when following. */
const chordCount = () => {
  const src = source();
  return src ? Math.max(1, Math.round(src.length / settings.beatsPerChord)) : settings.count;
};
/** Clip length in beats. */
const clipLength = () => source()?.length ?? settings.count * settings.beatsPerChord;

function newSteps(): Step[] {
  const src = source();
  if (!src) {
    fitInfo = "";
    return generate(intervals(), settings.count, settings.chord, harmony());
  }
  const h = harmonize(src.notes, src.length, settings.root, intervals(), settings.beatsPerChord, settings.chord, harmony());
  const how = h.score >= 1 ? "fits closely" : h.score >= 0.6 ? "fits" : "loose fit: try changing chords more often";
  fitInfo = `${h.from === "real" ? "a real progression" : "chord by chord"}, ${how}`;
  return h.steps;
}

if (source()) adoptKey(source()!);
let steps: Step[] = newSteps();

function chords() {
  return steps.map((s) => buildChord(settings.root, intervals(), s, settings.chord, settings.movement));
}

function voicings() {
  return voice(settings.root, chords(), {
    center: settings.register,
    mode: settings.voicing,
    bass: settings.bass,
    parallel: settings.movement === "parallel",
  });
}

function notes(): Note[] {
  const length = clipLength();
  return toNotes(voicings(), settings.beatsPerChord, settings.bass, settings.rhythm, {
    swing: settings.swing,
    push: settings.push,
  })
    .filter((n) => n.startTime < length - 1e-9)
    .map((n) => ({ ...n, duration: Math.min(n.duration, length - n.startTime) }));
}

// ---- controls ----------------------------------------------------------------
// Per 2sl-ui (and Ableton's extension design guide): radio chips for ≤ 5 options,
// selects for more, toggles for on/off, a slider for continuous ranges.

const CHORD_LABELS: [ChordType, string][] = [
  ["triad", "triads"], ["mixed", "triads + 7ths"], ["seventh", "7ths"], ["ninth", "9ths"],
  ["eleventh", "11ths"], ["sus2", "sus2"], ["sus4", "sus4"], ["quartal", "quartal (4ths)"],
];
const LENGTHS: [string, string][] = [["2", "2 beats"], ["4", "1 bar"], ["8", "2 bars"], ["16", "4 bars"]];
const SWING_PRESETS = [54, 58, 62, 66, 71];

/** Re-sync every control from `settings` (after a style change). */
const syncs: (() => void)[] = [];

function dropdown(id: string, options: { value: string; label: string; group?: string }[] | null, get: () => string, set: (v: string) => void) {
  const el = $<HTMLSelectElement>(id);
  if (options) fillSelect(el, options);
  el.classList.add("ui-select");
  el.onchange = () => set(el.value);
  syncs.push(() => (el.value = get()));
}

function setupControls() {
  // what to follow
  const sourceEl = $<HTMLSelectElement>("source");
  fillSelect(sourceEl, [...sources.map((s) => ({ value: s.id, label: s.label })), { value: "scratch", label: "nothing (from scratch)" }]);
  sourceEl.classList.add("ui-select");
  sourceEl.disabled = !sources.length;
  sourceEl.onchange = () => {
    sourceId = sourceEl.value;
    if (source()) adoptKey(source()!);
    syncs.forEach((f) => f());
    regenerate();
  };
  syncs.push(() => (sourceEl.value = sourceId));

  // where the clip goes
  if (init.targets) {
    dropdown("target", init.targets.map((t) => ({ value: t.id, label: t.disabled ? `${t.label} (${t.disabled})` : t.label })), () => target, (v) => (target = v));
    for (const o of $<HTMLSelectElement>("target").options) o.disabled = !!init.targets.find((t) => t.id === o.value)?.disabled;
  } else {
    $("target").classList.add("hidden");
  }
  $("where").textContent = init.where ?? "";
  $("into-row").classList.toggle("hidden", !init.targets && !init.where);

  dropdown("style", STYLES.map((s) => ({ value: s.id, label: s.label.toLowerCase() })), () => settings.style, (v) => {
    settings = { ...fromStyle(styleById(v), settings.root), theme: settings.theme };
    syncs.forEach((f) => f());
    regenerate();
  });

  dropdown("root", ROOT_LABELS.map((label, i) => ({ value: String(i), label })), () => String(settings.root), (v) => {
    settings.root = Number(v);
    if (source()) regenerate(); // a new key needs chords that fit the clip
    else changed(); // same degrees, transposed
  });

  const scales = scaleKeys.map((k) => ({ value: k, label: k.toLowerCase() }));
  if (liveUsable && !scaleKeys.includes(init.live!.name)) scales.push({ value: "live", label: `${init.live!.name.toLowerCase()} (live)` });
  dropdown("scale", scales, () => settings.scale, (v) => {
    const sameSize = (v === "live" ? init.live!.intervals : SCALES[v]).length === intervals().length;
    settings.scale = v;
    if (sameSize && !source()) changed();
    else regenerate();
  });

  const countEl = $<HTMLSelectElement>("count");
  dropdown("count", [1, 2, 3, 4, 6, 8].map((n) => ({ value: String(n), label: `${n} chord${n === 1 ? "" : "s"}` })), () => String(settings.count), (v) => {
    settings.count = Number(v);
    regenerate();
  });
  // Following a clip, its length sets the count (shown, but not editable).
  syncs.push(() => {
    const n = chordCount();
    countEl.disabled = !!source();
    if (source()) {
      if (![...countEl.options].some((o) => o.value === String(n))) countEl.append(new Option(`${n} chords`, String(n)));
      countEl.value = String(n);
      countEl.title = "set by the clip's length: change how often chords change instead";
    } else countEl.title = "";
  });
  dropdown("chord", CHORD_LABELS.map(([value, label]) => ({ value, label })), () => settings.chord, (v) => {
    settings.chord = v as ChordType;
    steps = steps.map((s) => ({ ...s, seventh: rollSeventh(settings.chord, Math.random) }));
    changed();
  });

  syncs.push(
    radioGroup($("length"), LENGTHS, () => String(settings.beatsPerChord), (v) => {
      settings.beatsPerChord = Number(v);
      if (source()) regenerate(); // new windows over the clip
      else changed();
    }),
    toggle($("hear-source"), () => settings.hearSource ?? true, (on) => {
      settings.hearSource = on;
      restartPreview();
    }),
    radioGroup($("movement"), [["diatonic", "diatonic"], ["parallel", "parallel"]], () => settings.movement, (v) => {
      settings.movement = v as Movement;
      changed();
    }),
    radioGroup($("voicing"), [["smooth", "smooth"], ["close", "close"], ["spread", "spread"], ["rootless", "rootless"]], () => settings.voicing, (v) => {
      settings.voicing = v as VoicingMode;
      changed();
    }),
    radioGroup($("register"), [["48", "low"], ["60", "mid"], ["72", "high"]], () => String(settings.register), (v) => {
      settings.register = Number(v);
      changed();
    }),
    toggle($("bass"), () => settings.bass, (on) => {
      settings.bass = on;
      changed();
    }),
    toggle($("push"), () => settings.push, (on) => {
      settings.push = on;
      changed();
    }),
    radioGroup($("theme"), [["dark", "dark"], ["light", "light"]], () => settings.theme ?? "dark", (v) => {
      settings.theme = v as "dark" | "light";
      applyTheme(settings.theme);
    }),
    slider(
      $("swing"),
      $("swing-presets"),
      { min: 50, max: 75, marks: SWING_PRESETS, valueEl: $("swing-value"), format: (v) => (v === 50 ? "straight" : `${v}%`) },
      () => settings.swing,
      (v, final) => {
        settings.swing = v;
        if (final) changed();
      },
    ),
  );

  // rhythm: grouped select, plus "custom" once the step grid has been edited
  const rhythm = $<HTMLSelectElement>("rhythm");
  fillSelect(rhythm, RHYTHMS.map((r) => ({ value: r.id, label: r.label.toLowerCase(), group: r.group.toLowerCase() })));
  const custom = new Option("custom (drawn)", "");
  rhythm.append(custom);
  rhythm.onchange = () => {
    if (rhythm.value) settings.rhythm = rhythm.value;
    changed();
  };
  syncs.push(() => {
    const isCustom = settings.rhythm.startsWith("custom:");
    custom.disabled = !isCustom;
    custom.value = isCustom ? settings.rhythm : "";
    rhythm.value = settings.rhythm;
  });

  syncs.forEach((f) => f());

  $("generate").onclick = regenerate;
  $("play").onclick = togglePreview;
  $("cancel").onclick = cancel;
  $("insert").onclick = insert;

  document.addEventListener("keydown", (e) => {
    if ((e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) && e.key !== "Escape") return;
    if (e.key === "Enter") insert();
    else if (e.key === "Escape") cancel();
    else if (e.key === " ") { e.preventDefault(); togglePreview(); }
    else if (e.key === "g" || e.key === "G") regenerate();
  });
}

function hueVar(hue: Style["hue"]) {
  return hue === "unlit" ? "var(--hue-grey)" : `var(--hue-${hue})`;
}

// ---- rendering -----------------------------------------------------------------

function regenerate() {
  stopPreview();
  steps = newSteps();
  syncs.forEach((f) => f());
  render();
}

/** A setting changed that doesn't need new chords: redraw, and restart a running preview. */
function changed() {
  syncs.forEach((f) => f());
  render();
  restartPreview();
}

function keyName() {
  const scaleName = settings.scale === "live" ? init.live!.name : settings.scale;
  return `${noteNames(settings.root, intervals())[settings.root]} ${scaleName.toLowerCase()}`;
}

function render() {
  applyTheme(settings.theme ?? "dark");
  const style = styleById(settings.style);
  document.documentElement.style.setProperty("--hue", hueVar(style.hue));
  $("blurb").textContent = style.blurb.toLowerCase();

  const bars = Math.round((clipLength() / 4) * 100) / 100;
  const src = source();
  $("status").innerHTML = "<b></b><span></span><span></span>";
  const parts = $("status").querySelectorAll("b, span");
  parts[0].textContent = keyName();
  parts[1].textContent = `${bars} bar${bars === 1 ? "" : "s"}`;
  parts[2].textContent = src ? `following ${src.label}` : "";
  $("fit").textContent = fitInfo;
  $<HTMLButtonElement>("hear-source").disabled = !src;
  $("tempo").textContent = `${Math.round(init.tempo * 100) / 100} bpm`;

  renderSteps();

  const list = chords();
  const cards = $("cards");
  cards.style.gridTemplateColumns = `repeat(${Math.min(list.length, 4)}, minmax(0, 1fr))`;
  cards.innerHTML = "";
  list.forEach((chord, i) => {
    const pad = document.createElement("div");
    pad.className = "ui-pad";
    pad.innerHTML = `<span><span class="dim index"></span>&nbsp; <span class="name"></span></span>
      <span class="big"></span><button class="corner" title="re-roll this chord">↻</button>`;
    pad.querySelector(".index")!.textContent = String(i + 1);
    pad.querySelector(".name")!.textContent = chord.name;
    pad.querySelector(".big")!.textContent = chord.numeral;
    pad.onclick = () => audition(i);
    pad.querySelector<HTMLButtonElement>(".corner")!.onclick = (e) => {
      e.stopPropagation();
      const src = source();
      steps = src
        ? rerollToFit(src.notes, src.length, settings.root, intervals(), settings.beatsPerChord, settings.chord, harmony(), steps, i)
        : reroll(intervals(), steps, i, settings.chord, harmony());
      render();
      audition(i);
    };
    cards.appendChild(pad);
  });
}

/** One bar of the rhythm as 16 pads. Clicking cycles rest → hit → accent and makes it custom. */
function renderSteps() {
  const grid = $("steps");
  const bar = barOf(settings.rhythm);
  grid.innerHTML = "";
  for (let beat = 1; beat <= 4; beat++) {
    const label = document.createElement("span");
    label.className = "beat";
    label.style.gridColumn = `${(beat - 1) * 4 + 1} / span 4`;
    label.textContent = String(beat);
    grid.append(label);
  }
  [...bar].forEach((c, i) => {
    const b = document.createElement("button");
    b.className = c === "X" ? "X" : c === "x" ? "x" : c === "-" ? "hold" : "";
    b.title = `step ${i + 1}`;
    b.onclick = () => {
      const next = c === "." ? "x" : c === "x" ? "X" : c === "X" ? "." : "x"; // a hold becomes its own hit
      const cells = [...bar];
      cells[i] = next;
      // A rest or new hit ends whatever was held into this step.
      for (let k = i + 1; k < 16 && cells[k] === "-" && next === "."; k++) cells[k] = ".";
      settings.rhythm = customRhythm(cells.join(""));
      changed();
    };
    grid.append(b);
  });
}

function cancel() {
  stopPreview();
  const message: Cancelled = { cancelled: true, settings };
  closeDialog(JSON.stringify(message));
}

function insert() {
  stopPreview();
  const list = chords();
  const result: Result = {
    name: `${keyName()} · ${list.map((c) => c.numeral).join("–")}`,
    length: clipLength(),
    notes: notes(),
    target: init.targets ? target : undefined,
    settings,
  };
  closeDialog(JSON.stringify(result));
}

// ---- preview synth -------------------------------------------------------------

let audio: AudioContext | null = null;
let playing: { stop(): void; full: boolean } | null = null;

function ctx(): AudioContext {
  audio ??= new AudioContext();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

const hz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

function playNote(ac: AudioContext, out: AudioNode, note: Note, start: number, dur: number) {
  const peak = 0.07 * (note.velocity / 100);
  const attack = Math.min(0.008, dur / 4);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(peak * 0.5, start + Math.max(attack + 0.01, Math.min(0.35, dur * 0.6)));
  gain.gain.linearRampToValueAtTime(0, start + dur + 0.03);
  gain.connect(out);
  for (const [type, detune] of [["triangle", 0], ["sawtooth", 7]] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = hz(note.pitch);
    osc.detune.value = detune;
    const g = ac.createGain();
    g.gain.value = type === "sawtooth" ? 0.35 : 1;
    osc.connect(g).connect(gain);
    osc.start(start);
    osc.stop(start + dur + 0.08);
  }
}

/** A dotted-8th feedback delay, so dub stabs sound like dub stabs. */
function delay(ac: AudioContext, input: AudioNode, out: AudioNode, spb: number) {
  const d = ac.createDelay(2);
  d.delayTime.value = spb * 0.75;
  const fb = ac.createGain();
  fb.gain.value = 0.42;
  const tone = ac.createBiquadFilter();
  tone.type = "bandpass";
  tone.frequency.value = 900;
  tone.Q.value = 0.6;
  const wet = ac.createGain();
  wet.gain.value = 0.5;
  input.connect(d);
  d.connect(tone).connect(fb).connect(d);
  tone.connect(wet).connect(out);
}

/** Play `list` (times in beats, offset by `fromBeat`) at the Set's tempo, with a moving step cursor. */
function schedule(list: Note[], fromBeat: number, beats: number) {
  const ac = ctx();
  const spb = 60 / init.tempo;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  const master = ac.createGain();
  master.connect(ac.destination);
  filter.connect(master);
  if (settings.style === "dub-techno" || settings.rhythm.startsWith("dub")) delay(ac, filter, master, spb);
  const lead = 0.05 + 0.25 * spb; // room for a pushed first chord
  const t0 = ac.currentTime + lead;
  for (const n of list) playNote(ac, filter, n, t0 + (n.startTime - fromBeat) * spb, n.duration * spb);
  const src = source();
  if (src && (settings.hearSource ?? true)) {
    const under = ac.createGain();
    under.gain.value = 0.9;
    under.connect(master);
    for (const n of src.notes) {
      if (n.startTime < fromBeat - 1e-9 || n.startTime >= fromBeat + beats) continue;
      playNote(ac, under, n, t0 + (n.startTime - fromBeat) * spb, Math.min(n.duration, fromBeat + beats - n.startTime) * spb);
    }
  }

  const cells = [...$("steps").querySelectorAll("button")];
  let frame = 0;
  const tick = () => {
    const beat = (ac.currentTime - t0) / spb;
    const step = beat >= 0 && beat < beats ? Math.floor((fromBeat + beat) * 4) % 16 : -1;
    cells.forEach((c, i) => c.classList.toggle("now", i === step));
    frame = requestAnimationFrame(tick);
  };
  tick();
  return {
    lead,
    spb,
    stop: () => {
      cancelAnimationFrame(frame);
      cells.forEach((c) => c.classList.remove("now"));
      master.gain.setTargetAtTime(0, ac.currentTime, 0.03);
    },
  };
}

function audition(i: number) {
  stopPreview();
  const from = i * settings.beatsPerChord;
  const beats = Math.min(settings.beatsPerChord, 4); // don't make people sit through 4 bars
  const list = notes()
    .filter((n) => n.startTime >= from - 0.25 - 1e-9 && n.startTime < from + beats)
    .map((n) => ({ ...n, duration: Math.min(n.duration, from + beats - n.startTime) }));
  const player = schedule(list, from, beats);
  highlight(i);
  const timer = setTimeout(stopPreview, (player.lead + beats * player.spb) * 1000 + 600);
  playing = { full: false, stop: () => { clearTimeout(timer); player.stop(); highlight(-1); } };
}

function togglePreview() {
  if (playing?.full) return stopPreview();
  stopPreview();
  startPreview();
}

function startPreview() {
  const total = clipLength();
  const player = schedule(notes(), 0, total);
  const secondsPerChord = settings.beatsPerChord * player.spb;
  const timers = steps.map((_, i) => setTimeout(() => highlight(i), (player.lead + i * secondsPerChord) * 1000));
  timers.push(setTimeout(stopPreview, (player.lead + total * player.spb) * 1000 + 600));
  $("play").querySelector("span")!.textContent = "stop";
  playing = {
    full: true,
    stop: () => {
      timers.forEach(clearTimeout);
      player.stop();
      highlight(-1);
      $("play").querySelector("span")!.textContent = "preview";
    },
  };
}

/** If the full preview is playing, restart it so a change is heard right away. */
function restartPreview() {
  if (!playing?.full) return;
  stopPreview();
  startPreview();
}

function stopPreview() {
  playing?.stop();
  playing = null;
}

function highlight(i: number) {
  document.querySelectorAll(".ui-pad").forEach((c, j) => c.classList.toggle("playing", j === i));
}

// Outside Live (npm run ui): a sample bassline to follow, in A minor (A A F G).
function demoInit(): Init {
  const bass = [45, 45, 41, 43].flatMap((r, bar) =>
    [0, 1.5, 2.5, 3.5].map((o, k) => ({ pitch: k === 2 ? r + 12 : r, startTime: bar * 4 + o, duration: 0.4, velocity: k === 0 ? 110 : 90 })));
  return {
    live: null, tempo: 122, saved: null, mode: "clip",
    sources: [{ id: "clip", label: "Bass · riff", notes: bass, length: 16 }],
    defaultSource: "clip",
    targets: [{ id: "new", label: "new track: chords" }, { id: "2", label: "Keys" }],
    defaultTarget: "new",
    where: "scene 1",
  };
}

// Wait for the pixel font so nothing renders in the fallback first.
void document.fonts.ready.then(() => {
  setupControls();
  render();
});
