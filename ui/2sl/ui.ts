// 2sl-ui behaviour helpers. DOM-only, no framework. Pair with tokens.css + components.css.
// Each control helper returns a `sync()` that re-reads state; call it after state changes elsewhere.

export type Theme = "dark" | "light";

/** Set the theme on <html>. Dark sits next to Live; light is the 2sl.to look. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/**
 * A radio group of chips (≤ 5 short options). Fills `group` with buttons.
 * Options are [value, label] or [value, label, swatchColour].
 */
export function radioGroup(
  group: HTMLElement,
  options: ([string, string] | [string, string, string])[],
  get: () => string,
  set: (value: string) => void,
): () => void {
  group.classList.add("ui-chips");
  group.setAttribute("role", "radiogroup");
  group.innerHTML = "";
  for (const [value, label, swatch] of options) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.value = value;
    if (swatch) {
      const i = document.createElement("i");
      i.style.background = swatch;
      b.append(i);
    }
    b.append(label);
    b.onclick = () => {
      set(value);
      sync();
    };
    group.append(b);
  }
  const sync = () =>
    group.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === get())));
  sync();
  return sync;
}

/** An on/off switch on a <button class="ui-toggle">. Use for anything that is on or off. */
export function toggle(button: HTMLButtonElement, get: () => boolean, set: (on: boolean) => void): () => void {
  button.classList.add("ui-toggle");
  button.type = "button";
  button.setAttribute("role", "switch");
  button.onclick = () => {
    set(!get());
    sync();
  };
  const sync = () => button.setAttribute("aria-checked", String(get()));
  sync();
  return sync;
}

/** Fill a <select class="ui-select"> with options, optionally grouped. */
export function fillSelect(select: HTMLSelectElement, options: { value: string; label: string; group?: string }[]) {
  select.classList.add("ui-select");
  select.innerHTML = "";
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const o of options) {
    const option = new Option(o.label, o.value);
    if (!o.group) {
      select.append(option);
      continue;
    }
    let og = groups.get(o.group);
    if (!og) {
      og = document.createElement("optgroup");
      og.label = o.group;
      groups.set(o.group, og);
      select.append(og);
    }
    og.append(option);
  }
}

/**
 * A slider (.ui-slider wrapping an <input type="range">) with tick marks and
 * clickable presets for standard values.
 */
export function slider(
  wrap: HTMLElement,
  presets: HTMLElement | null,
  opts: { min: number; max: number; step?: number; marks?: number[]; format?: (v: number) => string; valueEl?: HTMLElement },
  get: () => number,
  set: (v: number, final: boolean) => void,
): () => void {
  wrap.classList.add("ui-slider");
  const input = wrap.querySelector("input") ?? wrap.appendChild(document.createElement("input"));
  input.type = "range";
  input.min = String(opts.min);
  input.max = String(opts.max);
  input.step = String(opts.step ?? 1);
  const ticks = document.createElement("span");
  ticks.className = "ticks";
  wrap.prepend(ticks);
  const span = opts.max - opts.min;
  for (const m of opts.marks ?? []) {
    const t = document.createElement("span");
    const f = (m - opts.min) / span;
    t.style.left = `calc(${f * 100}% - ${f * 8 - 4}px)`; // centre of the 8px thumb
    ticks.append(t);
    if (presets) {
      presets.classList.add("ui-presets");
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(m);
      b.dataset.value = String(m);
      b.onclick = () => {
        set(m, true);
        sync();
      };
      presets.append(b);
    }
  }
  input.oninput = () => {
    set(Number(input.value), false);
    sync();
  };
  input.onchange = () => set(Number(input.value), true);
  const sync = () => {
    input.value = String(get());
    if (opts.valueEl) opts.valueEl.textContent = opts.format ? opts.format(get()) : String(get());
    presets?.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.value) === get())));
  };
  sync();
  return sync;
}

/**
 * Ableton Extensions dialogs: send a result string back to the extension and close.
 * Outside Live (e.g. `vite` in a browser) it just logs.
 */
export function closeDialog(result: string) {
  const w = window as unknown as {
    webkit?: { messageHandlers?: { live?: { postMessage(m: unknown): void } } };
    chrome?: { webview?: { postMessage(m: unknown): void } };
  };
  const message = { method: "close_and_send", params: [result] };
  if (w.webkit?.messageHandlers?.live) w.webkit.messageHandlers.live.postMessage(message);
  else if (w.chrome?.webview) w.chrome.webview.postMessage(message);
  else console.log("close_and_send", result);
}
