// Dialog logic. Bundled and inlined into interface.html by build.ts.
import {
  SCALES, ROOT_LABELS, noteNames, buildChord, generate, reroll, rollSeventh, voice,
  type Note, type Step, type SeventhMode,
} from "../src/theory.ts";
import { RHYTHMS, toNotes } from "../src/rhythm.ts";
import { DEFAULT_SETTINGS, type Init, type Result, type Settings } from "../src/protocol.ts";

declare global {
  interface Window {
    __INIT__: Init | null;
    webkit?: { messageHandlers?: { live?: { postMessage(m: unknown): void } } };
    chrome?: { webview?: { postMessage(m: unknown): void } };
  }
}

const init: Init = window.__INIT__ ?? { live: null, tempo: 120, saved: null };
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

function initialSettings(): Settings {
  if (init.saved) {
    const s = { ...DEFAULT_SETTINGS, ...init.saved };
    if (s.scale === "live" && !liveUsable) s.scale = "Major";
    if (s.scale !== "live" && !SCALES[s.scale]) s.scale = "Major";
    if (!RHYTHMS.some((r) => r.id === s.rhythm)) s.rhythm = DEFAULT_SETTINGS.rhythm;
    return s;
  }
  // First run: follow Live's Scale Mode if it's on.
  if (init.live && liveUsable) {
    const named = scaleKeys.find((k) => k === init.live!.name);
    return { ...DEFAULT_SETTINGS, root: init.live.root, scale: named ?? "live" };
  }
  return { ...DEFAULT_SETTINGS };
}

let settings = initialSettings();
const intervals = () => (settings.scale === "live" ? init.live!.intervals : SCALES[settings.scale]);
let steps: Step[] = generate(settings.root, intervals(), settings.count, settings.sevenths);

function chords() {
  return steps.map((s) => buildChord(settings.root, intervals(), s.degree, s.seventh));
}

function voicings() {
  return voice(settings.root, chords(), { center: settings.register, smooth: settings.smooth, bass: settings.bass });
}

function notes(): Note[] {
  return toNotes(voicings(), settings.beatsPerChord, settings.bass, settings.rhythm);
}

// ---- controls ----------------------------------------------------------------

function fillSelect(el: HTMLSelectElement, options: [string, string][], value: string) {
  el.innerHTML = "";
  for (const [v, label] of options) el.add(new Option(label, v, false, v === value));
}

function setupControls() {
  fillSelect($("root"), ROOT_LABELS.map((l, i) => [String(i), l]), String(settings.root));
  const scaleOptions: [string, string][] = scaleKeys.map((k) => [k, k]);
  if (liveUsable && !scaleKeys.includes(init.live!.name)) scaleOptions.push(["live", `${init.live!.name} (Live)`]);
  fillSelect($("scale"), scaleOptions, settings.scale);
  fillSelect($("count"), [2, 3, 4, 5, 6, 8].map((n) => [String(n), String(n)]), String(settings.count));
  $<HTMLSelectElement>("length").value = String(settings.beatsPerChord);
  const rhythm = $<HTMLSelectElement>("rhythm");
  for (const group of new Set(RHYTHMS.map((r) => r.group))) {
    const og = document.createElement("optgroup");
    og.label = group;
    for (const r of RHYTHMS.filter((r) => r.group === group)) og.append(new Option(r.label, r.id, false, r.id === settings.rhythm));
    rhythm.append(og);
  }
  rhythm.onchange = () => {
    settings.rhythm = rhythm.value;
    restartPreview();
  };

  $<HTMLSelectElement>("root").onchange = (e) => {
    settings.root = Number((e.target as HTMLSelectElement).value);
    render(); // keep the same degrees, just transposed
  };
  $<HTMLSelectElement>("scale").onchange = (e) => {
    const next = (e.target as HTMLSelectElement).value;
    const sameSize = (next === "live" ? init.live!.intervals : SCALES[next]).length === intervals().length;
    settings.scale = next;
    if (!sameSize) regenerate();
    else render();
  };
  $<HTMLSelectElement>("count").onchange = (e) => {
    settings.count = Number((e.target as HTMLSelectElement).value);
    regenerate();
  };
  $<HTMLSelectElement>("length").onchange = (e) => {
    settings.beatsPerChord = Number((e.target as HTMLSelectElement).value);
    render();
    restartPreview();
  };

  segmented("sevenths", () => settings.sevenths, (v) => {
    settings.sevenths = v as SeventhMode;
    steps = steps.map((s) => ({ ...s, seventh: rollSeventh(settings.sevenths, Math.random) }));
  });
  segmented("smooth", () => String(settings.smooth), (v) => (settings.smooth = v === "true"));
  segmented("register", () => String(settings.register), (v) => (settings.register = Number(v)));
  segmented("bass", () => String(settings.bass), (v) => (settings.bass = v === "true"));

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

function segmented(id: string, get: () => string, set: (v: string) => void) {
  const group = $(id);
  const sync = () => group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === get())));
  group.querySelectorAll("button").forEach((b) => {
    b.onclick = () => { set(b.dataset.v!); sync(); render(); };
  });
  sync();
}

function keyName() {
  const scaleName = settings.scale === "live" ? init.live!.name : settings.scale;
  return `${noteNames(settings.root, intervals())[settings.root]} ${scaleName}`;
}

// ---- rendering -----------------------------------------------------------------

function regenerate() {
  stopPreview();
  steps = generate(settings.root, intervals(), settings.count, settings.sevenths);
  render();
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
      steps = reroll(settings.root, intervals(), steps, i, settings.sevenths);
      render();
      audition(i);
    };
    cards.appendChild(card);
  });
  const bars = (settings.count * settings.beatsPerChord) / 4;
  $("hint").textContent =
    `${keyName()} · ${bars} bar${bars === 1 ? "" : "s"} · ` +
    `click a chord to hear it, ↻ to re-roll it`;
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
let playing: { stop(): void } | null = null;

function ctx(): AudioContext {
  audio ??= new AudioContext();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

const hz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

function playNote(ac: AudioContext, out: AudioNode, note: Note, start: number, dur: number) {
  const peak = 0.07 * (note.velocity / 100);
  const attack = Math.min(0.01, dur / 4);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(peak * 0.55, start + Math.max(attack + 0.01, Math.min(0.35, dur * 0.6)));
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

/** Play `list` (times in beats, offset by `fromBeat`) at the Set's tempo. Returns a stopper. */
function schedule(list: Note[], fromBeat: number) {
  const ac = ctx();
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  const master = ac.createGain();
  filter.connect(master).connect(ac.destination);
  const spb = 60 / init.tempo;
  const t0 = ac.currentTime + 0.05;
  for (const n of list) playNote(ac, filter, n, t0 + (n.startTime - fromBeat) * spb, n.duration * spb);
  return { t0: 0.05, spb, stop: () => master.gain.setTargetAtTime(0, ac.currentTime, 0.02) };
}

function audition(i: number) {
  stopPreview();
  const from = i * settings.beatsPerChord;
  const beats = Math.min(settings.beatsPerChord, 4); // don't make people sit through 2 bars
  const list = notes()
    .filter((n) => n.startTime >= from - 1e-9 && n.startTime < from + beats)
    .map((n) => ({ ...n, duration: Math.min(n.duration, from + beats - n.startTime) }));
  const player = schedule(list, from);
  highlight(i);
  const timer = setTimeout(stopPreview, (player.t0 + beats * player.spb) * 1000 + 100);
  playing = { stop: () => { clearTimeout(timer); player.stop(); highlight(-1); } };
}

function togglePreview() {
  if (playing) return stopPreview();
  startPreview();
}

function startPreview() {
  const player = schedule(notes(), 0);
  const secondsPerChord = settings.beatsPerChord * player.spb;
  const timers = steps.map((_, i) => setTimeout(() => highlight(i), (player.t0 + i * secondsPerChord) * 1000));
  timers.push(setTimeout(stopPreview, (player.t0 + steps.length * secondsPerChord) * 1000 + 100));
  $("play").firstChild!.textContent = "Stop";
  playing = {
    stop: () => {
      timers.forEach(clearTimeout);
      player.stop();
      highlight(-1);
      $("play").firstChild!.textContent = "Preview";
    },
  };
}

/** If the full preview is playing, restart it so a settings change is heard right away. */
function restartPreview() {
  if (!playing || $("play").firstChild!.textContent !== "Stop") return;
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
