// Dialog logic. Bundled and inlined into interface.html by build.ts.
import {
  SCALES, ROOT_LABELS, noteNames, buildChord, generate, reroll, rollSeventh, voice, toNotes,
  type Step, type SeventhMode,
} from "../src/theory.ts";
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
    notes: toNotes(voicings(), settings.beatsPerChord, settings.bass),
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

function playChord(ac: AudioContext, out: AudioNode, pitches: number[], start: number, dur: number) {
  for (const p of pitches) {
    const gain = ac.createGain();
    const peak = 0.12 / Math.sqrt(pitches.length);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(peak * 0.5, start + 0.4);
    gain.gain.setValueAtTime(peak * 0.5, start + Math.max(0.4, dur - 0.08));
    gain.gain.linearRampToValueAtTime(0, start + dur);
    gain.connect(out);
    for (const [type, detune] of [["triangle", 0], ["sawtooth", 7]] as const) {
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.value = hz(p);
      osc.detune.value = detune;
      const g = ac.createGain();
      g.gain.value = type === "sawtooth" ? 0.35 : 1;
      osc.connect(g).connect(gain);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    }
  }
}

function output(ac: AudioContext) {
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  const master = ac.createGain();
  filter.connect(master).connect(ac.destination);
  return { filter, master };
}

function audition(i: number) {
  stopPreview();
  const ac = ctx();
  const { filter, master } = output(ac);
  playChord(ac, filter, voicings()[i], ac.currentTime + 0.01, 1.2);
  highlight(i);
  const timer = setTimeout(() => highlight(-1), 1200);
  playing = { stop: () => { clearTimeout(timer); master.gain.setTargetAtTime(0, ac.currentTime, 0.02); highlight(-1); } };
}

function togglePreview() {
  if (playing) return stopPreview();
  const ac = ctx();
  const { filter, master } = output(ac);
  const secondsPerChord = (settings.beatsPerChord * 60) / init.tempo;
  const t0 = ac.currentTime + 0.05;
  const timers: ReturnType<typeof setTimeout>[] = [];
  voicings().forEach((v, i) => {
    playChord(ac, filter, v, t0 + i * secondsPerChord, secondsPerChord);
    timers.push(setTimeout(() => highlight(i), (0.05 + i * secondsPerChord) * 1000));
  });
  timers.push(setTimeout(stopPreview, (0.05 + steps.length * secondsPerChord) * 1000));
  $("play").firstChild!.textContent = "Stop";
  playing = {
    stop: () => {
      timers.forEach(clearTimeout);
      master.gain.setTargetAtTime(0, ac.currentTime, 0.02);
      highlight(-1);
      $("play").firstChild!.textContent = "Preview";
    },
  };
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
