// Dialog logic. Bundled and inlined into interface.html by build.ts.
import {
  SCALES, ROOT_LABELS, noteNames, buildChord, generate, reroll, rollSeventh, voice,
  type ChordType, type Harmony, type Movement, type Note, type Step, type VoicingMode,
} from "../src/theory.ts";
import { RHYTHMS, barOf, customRhythm, isRhythm, toNotes } from "../src/rhythm.ts";
import { STYLES, styleById, type Style } from "../src/styles.ts";
import type { Init, Result, Settings } from "../src/protocol.ts";

declare global {
  interface Window {
    __INIT__: Init | null;
    webkit?: { messageHandlers?: { live?: { postMessage(m: unknown): void } } };
    chrome?: { webview?: { postMessage(m: unknown): void } };
  }
}

const init: Init = window.__INIT__ ?? { live: null, tempo: 122, saved: null };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function closeWith(result: string) {
  const message = { method: "close_and_send", params: [result] };
  if (window.webkit?.messageHandlers?.live) window.webkit.messageHandlers.live.postMessage(message);
  else if (window.chrome?.webview) window.chrome.webview.postMessage(message);
  else console.log("close_and_send", result); // running in a normal browser via `npm run ui`
}

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
let steps: Step[] = generate(intervals(), settings.count, settings.chord, harmony());

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
  return toNotes(voicings(), settings.beatsPerChord, settings.bass, settings.rhythm, {
    swing: settings.swing,
    push: settings.push,
  });
}

// ---- controls ----------------------------------------------------------------

const CHORD_LABELS: [ChordType, string][] = [
  ["triad", "triad"], ["mixed", "triad+7"], ["seventh", "7th"], ["ninth", "9th"],
  ["eleventh", "11th"], ["sus2", "sus2"], ["sus4", "sus4"], ["quartal", "4ths"],
];
const LENGTHS: [string, string][] = [["2", "2 beats"], ["4", "1 bar"], ["8", "2 bars"], ["16", "4 bars"]];
const SWING_PRESETS = [54, 58, 62, 66, 71];

/** Re-sync every control from `settings` (after a style change). */
const syncs: (() => void)[] = [];

/** A row of outlined choices; the current one is inverted. */
function chips(id: string, options: [string, string][], get: () => string, set: (v: string) => void) {
  const group = $(id);
  group.innerHTML = "";
  for (const [value, label] of options) {
    const b = document.createElement("button");
    b.dataset.v = value;
    b.textContent = label;
    b.onclick = () => { set(value); sync(); };
    group.append(b);
  }
  const sync = () => group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === get())));
  syncs.push(sync);
}

function dropdown(id: string, get: () => string, set: (v: string) => void) {
  const el = $<HTMLSelectElement>(id);
  el.onchange = () => set(el.value);
  syncs.push(() => (el.value = get()));
}

function setupControls() {
  // style chips, each with its pad colour
  chips("style", STYLES.map((s) => [s.id, s.label.toLowerCase()]), () => settings.style, (v) => {
    settings = fromStyle(styleById(v), settings.root);
    syncs.forEach((f) => f());
    regenerate();
  });
  $("style").querySelectorAll("button").forEach((b) => {
    const swatch = document.createElement("i");
    swatch.style.background = hueVar(styleById(b.dataset.v!).hue);
    b.prepend(swatch);
  });

  for (const [i, label] of ROOT_LABELS.entries()) $<HTMLSelectElement>("root").add(new Option(label, String(i)));
  dropdown("root", () => String(settings.root), (v) => {
    settings.root = Number(v);
    changed(); // same degrees, transposed
  });

  for (const k of scaleKeys) $<HTMLSelectElement>("scale").add(new Option(k.toLowerCase(), k));
  if (liveUsable && !scaleKeys.includes(init.live!.name)) $<HTMLSelectElement>("scale").add(new Option(`${init.live!.name.toLowerCase()} (live)`, "live"));
  dropdown("scale", () => settings.scale, (v) => {
    const sameSize = (v === "live" ? init.live!.intervals : SCALES[v]).length === intervals().length;
    settings.scale = v;
    if (sameSize) changed();
    else regenerate();
  });

  chips("count", ["1", "2", "3", "4", "6", "8"].map((n) => [n, n]), () => String(settings.count), (v) => {
    settings.count = Number(v);
    regenerate();
  });
  chips("chord", CHORD_LABELS, () => settings.chord, (v) => {
    settings.chord = v as ChordType;
    steps = steps.map((s) => ({ ...s, seventh: rollSeventh(settings.chord, Math.random) }));
    changed();
  });
  chips("length", LENGTHS, () => String(settings.beatsPerChord), (v) => {
    settings.beatsPerChord = Number(v);
    changed();
  });
  chips("movement", [["diatonic", "diatonic"], ["parallel", "parallel"]], () => settings.movement, (v) => {
    settings.movement = v as Movement;
    changed();
  });
  chips("voicing", [["smooth", "smooth"], ["close", "close"], ["spread", "spread"]], () => settings.voicing, (v) => {
    settings.voicing = v as VoicingMode;
    changed();
  });
  chips("register", [["48", "low"], ["60", "mid"], ["72", "high"]], () => String(settings.register), (v) => {
    settings.register = Number(v);
    changed();
  });
  chips("bass", [["true", "on"], ["false", "off"]], () => String(settings.bass), (v) => {
    settings.bass = v === "true";
    changed();
  });
  chips("push", [["false", "off"], ["true", "on"]], () => String(settings.push), (v) => {
    settings.push = v === "true";
    changed();
  });

  // rhythm: grouped dropdown, plus "custom" once the step grid has been edited
  const rhythm = $<HTMLSelectElement>("rhythm");
  for (const group of new Set(RHYTHMS.map((r) => r.group))) {
    const og = document.createElement("optgroup");
    og.label = group.toLowerCase();
    for (const r of RHYTHMS.filter((r) => r.group === group)) og.append(new Option(r.label.toLowerCase(), r.id));
    rhythm.append(og);
  }
  const custom = new Option("custom (drawn)", "");
  rhythm.append(custom);
  rhythm.onchange = () => {
    if (rhythm.value) settings.rhythm = rhythm.value;
    changed();
  };
  syncs.push(() => {
    const isCustom = settings.rhythm.startsWith("custom:");
    custom.hidden = !isCustom;
    custom.value = isCustom ? settings.rhythm : "";
    rhythm.value = settings.rhythm;
  });

  // swing: a slider with the standard values marked and clickable
  const swing = $<HTMLInputElement>("swing");
  swing.oninput = () => {
    settings.swing = Number(swing.value);
    syncSwing();
  };
  swing.onchange = () => changed();
  const ticks = $("swing-ticks");
  const presets = $("swing-presets");
  for (const v of SWING_PRESETS) {
    const t = document.createElement("span");
    t.style.left = `calc(${((v - 50) / 25) * 100}% - ${((v - 50) / 25) * 8 - 4}px)`; // align with the thumb's centre
    ticks.append(t);
    const b = document.createElement("button");
    b.textContent = String(v);
    b.title = `${v}% swing`;
    b.dataset.v = String(v);
    b.onclick = () => {
      settings.swing = v;
      syncSwing();
      changed();
    };
    presets.append(b);
  }
  const syncSwing = () => {
    swing.value = String(settings.swing);
    $("swing-value").textContent = settings.swing === 50 ? "straight" : `${settings.swing}%`;
    presets.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.v) === settings.swing)));
  };
  syncs.push(syncSwing);

  syncs.forEach((f) => f());

  $("generate").onclick = regenerate;
  $("play").onclick = togglePreview;
  $("cancel").onclick = () => closeWith("");
  $("insert").onclick = insert;

  document.addEventListener("keydown", (e) => {
    if ((e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) && e.key !== "Escape") return;
    if (e.key === "Enter") insert();
    else if (e.key === "Escape") closeWith("");
    else if (e.key === " ") { e.preventDefault(); togglePreview(); }
    else if (e.key === "g" || e.key === "G") regenerate();
  });
}

function hueVar(hue: Style["hue"]) {
  return hue === "ink" || hue === "unlit" ? `var(--${hue})` : `var(--hue-${hue})`;
}

// ---- rendering -----------------------------------------------------------------

function regenerate() {
  stopPreview();
  steps = generate(intervals(), settings.count, settings.chord, harmony());
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
  const style = styleById(settings.style);
  document.documentElement.style.setProperty("--hue", hueVar(style.hue));
  $("blurb").textContent = style.blurb.toLowerCase();

  const bars = (settings.count * settings.beatsPerChord) / 4;
  $("status").innerHTML = "<b></b><span></span>";
  $("status").querySelector("b")!.textContent = keyName();
  $("status").querySelector("span")!.textContent = `${bars} bar${bars === 1 ? "" : "s"}`;
  $("tempo").textContent = `${Math.round(init.tempo * 100) / 100} bpm`;

  renderSteps();

  const list = chords();
  const cards = $("cards");
  cards.style.gridTemplateColumns = `repeat(${Math.min(list.length, 4)}, minmax(0, 1fr))`;
  cards.innerHTML = "";
  list.forEach((chord, i) => {
    const pad = document.createElement("div");
    pad.className = "pad";
    pad.innerHTML = `<span class="top"><span class="index"></span><span class="name"></span></span>
      <span class="numeral"></span><button class="reroll" title="re-roll this chord">↻</button>`;
    pad.querySelector(".index")!.textContent = String(i + 1);
    pad.querySelector(".numeral")!.textContent = chord.numeral;
    pad.querySelector(".name")!.textContent = chord.name;
    pad.onclick = () => audition(i);
    pad.querySelector<HTMLButtonElement>(".reroll")!.onclick = (e) => {
      e.stopPropagation();
      steps = reroll(intervals(), steps, i, settings.chord, harmony());
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

function insert() {
  stopPreview();
  const list = chords();
  const result: Result = {
    name: `${keyName()} · ${list.map((c) => c.numeral).join("–")}`,
    length: settings.count * settings.beatsPerChord,
    notes: notes(),
    settings,
  };
  closeWith(JSON.stringify(result));
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
  const total = steps.length * settings.beatsPerChord;
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
  document.querySelectorAll(".pad").forEach((c, j) => c.classList.toggle("playing", j === i));
}

// Wait for the pixel font so nothing renders in the fallback first.
void document.fonts.ready.then(() => {
  setupControls();
  render();
});
