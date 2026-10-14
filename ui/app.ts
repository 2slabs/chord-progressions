// Dialog logic. Bundled and inlined into interface.html by build.ts.
import {
  SCALES, ROOT_LABELS, CHORD_TYPES, noteNames, buildChord, generate, reroll, rollSeventh, voice,
  type ChordType, type Harmony, type Movement, type Note, type Step, type VoicingMode,
} from "../src/theory.ts";
import { RHYTHMS, toNotes } from "../src/rhythm.ts";
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
    if (!RHYTHMS.some((r) => r.id === s.rhythm)) s.rhythm = styleById(s.style).rhythm;
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

function fillSelect(el: HTMLSelectElement, options: [string, string][], value: string) {
  el.innerHTML = "";
  for (const [v, label] of options) el.add(new Option(label, v, false, v === value));
}

function select(id: string, options: [string, string][] | null, get: () => string, set: (v: string) => void) {
  const el = $<HTMLSelectElement>(id);
  if (options) fillSelect(el, options, get());
  el.onchange = () => set(el.value);
  return () => (el.value = get());
}

function segmented(id: string, get: () => string, set: (v: string) => void) {
  const group = $(id);
  const sync = () => group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === get())));
  group.querySelectorAll("button").forEach((b) => {
    b.onclick = () => { set(b.dataset.v!); sync(); };
  });
  return sync;
}

/** Re-sync every control from `settings` (after a style change). */
const syncs: (() => void)[] = [];

function setupControls() {
  syncs.push(
    select("style", STYLES.map((s) => [s.id, s.label]), () => settings.style, (v) => {
      settings = fromStyle(styleById(v), settings.root);
      syncs.forEach((f) => f());
      regenerate();
    }),
    select("root", ROOT_LABELS.map((l, i) => [String(i), l]), () => String(settings.root), (v) => {
      settings.root = Number(v);
      changed(); // same degrees, transposed
    }),
    select("scale", null, () => settings.scale, (v) => {
      const next = v === "live" ? init.live!.intervals : SCALES[v];
      const sameSize = next.length === intervals().length;
      settings.scale = v;
      if (sameSize) changed();
      else regenerate();
    }),
    select("count", [1, 2, 3, 4, 6, 8].map((n) => [String(n), String(n)]), () => String(settings.count), (v) => {
      settings.count = Number(v);
      regenerate();
    }),
    select("length", null, () => String(settings.beatsPerChord), (v) => {
      settings.beatsPerChord = Number(v);
      changed();
    }),
    select("chord", CHORD_TYPES, () => settings.chord, (v) => {
      settings.chord = v as ChordType;
      steps = steps.map((s) => ({ ...s, seventh: rollSeventh(settings.chord, Math.random) }));
      changed();
    }),
    segmented("movement", () => settings.movement, (v) => {
      settings.movement = v as Movement;
      changed();
    }),
    segmented("voicing", () => settings.voicing, (v) => {
      settings.voicing = v as VoicingMode;
      changed();
    }),
    segmented("register", () => String(settings.register), (v) => {
      settings.register = Number(v);
      changed();
    }),
    segmented("bass", () => String(settings.bass), (v) => {
      settings.bass = v === "true";
      changed();
    }),
    select("rhythm", null, () => settings.rhythm, (v) => {
      settings.rhythm = v;
      changed();
    }),
    select("swing", null, () => String(settings.swing), (v) => {
      settings.swing = Number(v);
      changed();
    }),
    segmented("push", () => String(settings.push), (v) => {
      settings.push = v === "true";
      changed();
    }),
  );

  const scaleOptions: [string, string][] = scaleKeys.map((k) => [k, k]);
  if (liveUsable && !scaleKeys.includes(init.live!.name)) scaleOptions.push(["live", `${init.live!.name} (Live)`]);
  fillSelect($("scale"), scaleOptions, settings.scale);

  const rhythm = $<HTMLSelectElement>("rhythm");
  for (const group of new Set(RHYTHMS.map((r) => r.group))) {
    const og = document.createElement("optgroup");
    og.label = group;
    for (const r of RHYTHMS.filter((r) => r.group === group)) og.append(new Option(r.label, r.id));
    rhythm.append(og);
  }
  syncs.forEach((f) => f());

  $("generate").onclick = regenerate;
  $("play").onclick = togglePreview;
  $("cancel").onclick = () => closeWith("");
  $("insert").onclick = insert;

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLSelectElement && e.key !== "Escape") return;
    if (e.key === "Enter") insert();
    else if (e.key === "Escape") closeWith("");
    else if (e.key === " ") { e.preventDefault(); togglePreview(); }
    else if (e.key === "g" || e.key === "G") regenerate();
  });
}

// ---- rendering -----------------------------------------------------------------

function regenerate() {
  stopPreview();
  steps = generate(intervals(), settings.count, settings.chord, harmony());
  render();
}

/** A setting changed that doesn't need new chords: redraw, and restart a running preview. */
function changed() {
  render();
  restartPreview();
}

function keyName() {
  const scaleName = settings.scale === "live" ? init.live!.name : settings.scale;
  return `${noteNames(settings.root, intervals())[settings.root]} ${scaleName}`;
}

function render() {
  const list = chords();
  const cards = $("cards");
  cards.style.gridTemplateColumns = `repeat(${Math.min(list.length, 4)}, 1fr)`;
  cards.innerHTML = "";
  list.forEach((chord, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<button class="reroll" title="Re-roll this chord">↻</button>
      <div class="numeral"></div><div class="name"></div>`;
    card.querySelector(".numeral")!.textContent = chord.numeral;
    card.querySelector(".name")!.textContent = chord.name;
    card.onclick = () => audition(i);
    card.querySelector<HTMLButtonElement>(".reroll")!.onclick = (e) => {
      e.stopPropagation();
      steps = reroll(intervals(), steps, i, settings.chord, harmony());
      render();
      audition(i);
    };
    cards.appendChild(card);
  });
  const bars = (settings.count * settings.beatsPerChord) / 4;
  const hint = $("hint");
  hint.innerHTML = "<b></b> · <span></span>";
  hint.querySelector("b")!.textContent = `${keyName()}, ${bars} bar${bars === 1 ? "" : "s"}`;
  hint.querySelector("span")!.textContent = styleById(settings.style).blurb;
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

/** Play `list` (times in beats, offset by `fromBeat`) at the Set's tempo. */
function schedule(list: Note[], fromBeat: number) {
  const ac = ctx();
  const spb = 60 / init.tempo;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  const master = ac.createGain();
  master.connect(ac.destination);
  filter.connect(master);
  if (styleById(settings.style).id === "dub-techno" || settings.rhythm.startsWith("dub")) delay(ac, filter, master, spb);
  const lead = 0.05 + 0.25 * spb; // room for a pushed first chord
  const t0 = ac.currentTime + lead;
  for (const n of list) playNote(ac, filter, n, t0 + (n.startTime - fromBeat) * spb, n.duration * spb);
  return { lead, spb, stop: () => master.gain.setTargetAtTime(0, ac.currentTime, 0.03) };
}

function audition(i: number) {
  stopPreview();
  const from = i * settings.beatsPerChord;
  const beats = Math.min(settings.beatsPerChord, 4); // don't make people sit through 4 bars
  const list = notes()
    .filter((n) => n.startTime >= from - 0.25 - 1e-9 && n.startTime < from + beats)
    .map((n) => ({ ...n, duration: Math.min(n.duration, from + beats - n.startTime) }));
  const player = schedule(list, from);
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
  const player = schedule(notes(), 0);
  const secondsPerChord = settings.beatsPerChord * player.spb;
  const timers = steps.map((_, i) => setTimeout(() => highlight(i), (player.lead + i * secondsPerChord) * 1000));
  timers.push(setTimeout(stopPreview, (player.lead + steps.length * secondsPerChord) * 1000 + 600));
  $("play").firstChild!.textContent = "Stop";
  playing = {
    full: true,
    stop: () => {
      timers.forEach(clearTimeout);
      player.stop();
      highlight(-1);
      $("play").firstChild!.textContent = "Preview";
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
  document.querySelectorAll(".card").forEach((c, j) => c.classList.toggle("playing", j === i));
}

setupControls();
render();
