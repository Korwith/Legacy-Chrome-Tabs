// Colors & opacity panel in the ⋮ menu: writes userChrome.ct.* prefs, applied live as an author sheet
window.delayedStartupPromise.then(() => {
  if (window.ctSettings) {
    return;
  }

  const BRANCH = "userChrome.ct.";
  const THEME_PREF = "userChrome.ct.theme";
  const SCHEME_PREF = "layout.css.prefers-color-scheme.content-override";
  const VIEW_ID = "ct-settings-view";
  const BUTTON_ID = "appMenu-ct-settings-button";
  const XHTML = "http://www.w3.org/1999/xhtml";

  const isDark = () => {
    const o = Services.prefs.getIntPref(SCHEME_PREF, 2);
    return o == 0 || (o == 2 && window.matchMedia("(prefers-color-scheme: dark)").matches);
  };

  // The classic palette's own colors, light and dark (as in userChrome.css).
  const CLASSIC = {
    light: { top: "#acbed8", bottom: "#98add2", toolbar: "#f2f2f2" },
    dark: { top: "#3f444c", bottom: "#33373e", toolbar: "#55595e" },
  };
  const classicDefault = key => () => CLASSIC[isDark() ? "dark" : "light"][key];

  // each palette's settings in panel order; def is userChrome.css's value (a function if light/dark differ)
  const SETTINGS = {
    glass: [
      { section: "Colors" },
      { pref: "glass.tint", label: "Glass tint", type: "color", def: "#ffffff" },
      { pref: "glass.glow-color", label: "Glow", type: "color", def: "#1f80ff" },
      { pref: "glass.background", label: "Window background", type: "color", def: "#000000" },
      { pref: "glass.menu", label: "Menus and panels", type: "color", def: "#0c0e12" },
      { pref: "glass.accent", label: "Accent (star, loading)", type: "color", def: "#1f80ff" },
      { section: "Opacity" },
      { pref: "glass.fill", label: "Toolbar and active tab", type: "opacity", def: 5 },
      { pref: "glass.tabs", label: "Background tabs", type: "opacity", def: 2 },
      { pref: "glass.edge", label: "Edges", type: "opacity", def: 10 },
      { pref: "glass.glow", label: "Glow", type: "opacity", def: 79 },
    ],
    classic: [
      { section: "Colors" },
      { pref: "classic.frame-top", label: "Frame, top", type: "color", def: classicDefault("top") },
      { pref: "classic.frame-bottom", label: "Frame, bottom", type: "color", def: classicDefault("bottom") },
      { pref: "classic.toolbar", label: "Toolbar and active tab", type: "color", def: classicDefault("toolbar") },
    ],
  };

  const palette = () =>
    Services.prefs.getStringPref(THEME_PREF, "") == "glass" ? "glass" : "classic";
  const items = name => SETTINGS[name].filter(s => s.pref);
  const prefName = s => BRANCH + s.pref;
  const defaultOf = s => (typeof s.def == "function" ? s.def() : s.def);
  const isSet = s => Services.prefs.prefHasUserValue(prefName(s));

  // ── Values ──

  function normalizeHex(text) {
    let m = /^\s*#?([0-9a-f]{3}|[0-9a-f]{6})\s*$/i.exec(text ?? "");
    if (!m) {
      return null;
    }
    let hex = m[1].toLowerCase();
    if (hex.length == 3) {
      hex = [...hex].map(c => c + c).join("");
    }
    return "#" + hex;
  }

  function get(s) {
    if (isSet(s)) {
      try {
        if (s.type == "color") {
          const hex = normalizeHex(Services.prefs.getStringPref(prefName(s)));
          if (hex) {
            return hex;
          }
        } else {
          return Math.min(100, Math.max(0, Services.prefs.getIntPref(prefName(s))));
        }
      } catch (e) {
        // wrong type in about:config: fall back to the default
      }
    }
    return defaultOf(s);
  }

  function set(s, value) {
    if (s.type == "color") {
      Services.prefs.setStringPref(prefName(s), value);
    } else {
      Services.prefs.setIntPref(prefName(s), value);
    }
  }

  const values = name => Object.fromEntries(items(name).map(s => [s.pref.split(".")[1], get(s)]));

  // ── Color helpers ──

  const rgb = hex => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (hex, alpha) =>
    `rgba(${rgb(hex).join(",")},${+Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
  // hex mixed with toHex: t = 0 gives hex, 1 gives toHex
  const mix = (hex, toHex, t) =>
    "#" +
    rgb(hex)
      .map((c, i) => Math.round(c + (rgb(toHex)[i] - c) * t).toString(16).padStart(2, "0"))
      .join("");
  const svg = markup =>
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' ${markup}</svg>`
    )}")`;

  // The shapes from userChrome.css
  const TAB = "width='48' height='29' viewBox='0 0 48 29'>";
  const TAB_FILL =
    "M0.4 29C2 29 2.87 28 3.34 27L14.66 3C15.08 2.1 15.4 1 16 1H32C32.6 1 32.92 2.1 33.34 3L44.66 27C45.13 28 46 29 47.6 29Z";
  const GLASS_OUTLINE =
    "M-0.15 28.5C1.45 28.5 2.32 28 2.79 27L14.34 2.5C14.77 1.6 15.4 0.5 16 0.5H32C32.6 0.5 33.23 1.6 33.66 2.5L45.21 27C45.68 28 46.55 28.5 48.15 28.5";
  const CLASSIC_OUTLINE =
    "M-0.15 29C1.45 29 2.32 28 2.79 27L14.34 2.5C14.77 1.6 15.4 0.5 16 0.5H32C32.6 0.5 33.23 1.6 33.66 2.5L45.21 27C45.68 28 46.55 29 48.15 29";
  const NEWTAB = "width='33' height='17' viewBox='0 0 33 17'><path d='M0.5 0.5H26L32.5 16.5H7Z'";

  const glassTab = (fill, edge, closed) =>
    svg(`${TAB}<path d='${TAB_FILL}' fill='${fill}'/><path d='${GLASS_OUTLINE}${closed ? "Z" : ""}' fill='none' stroke='${edge}'/>`);
  const glassNewTab = (fill, edge) => svg(`${NEWTAB} fill='${fill}' stroke='${edge}'/>`);
  const glow = (color, alpha) =>
    svg(
      "width='2439' height='1398' viewBox='0 0 2439 1398' fill='none'>" +
        "<g filter='url(#f)'><ellipse cx='1219.5' cy='698.5' rx='869.5' ry='221.5' fill='url(#p)'/></g>" +
        "<defs><filter id='f' x='0' y='127' width='2439' height='1143' filterUnits='userSpaceOnUse' color-interpolation-filters='sRGB'>" +
        "<feFlood flood-opacity='0' result='BackgroundImageFix'/>" +
        "<feBlend mode='normal' in='SourceGraphic' in2='BackgroundImageFix' result='shape'/>" +
        "<feGaussianBlur stdDeviation='175'/></filter>" +
        "<radialGradient id='p' cx='0' cy='0' r='1' gradientUnits='userSpaceOnUse' gradientTransform='translate(1220 477) rotate(90.0342) scale(838.285 3290.69)'>" +
        `<stop stop-color='${color}' stop-opacity='${alpha}'/>` +
        `<stop offset='0.702943' stop-color='${color}' stop-opacity='0'/>` +
        "</radialGradient></defs>"
    );
  const classicActive = (fill, stroke) =>
    svg(`${TAB}<path d='${TAB_FILL}' fill='${fill}'/><path d='${CLASSIC_OUTLINE}' fill='none' stroke='${stroke}' stroke-width='1.2'/>`);
  const classicInactive = (top, bottom, stroke) =>
    svg(
      `${TAB}<defs><linearGradient id='g' x2='0' y2='1'><stop offset='0' stop-color='${top}'/><stop offset='1' stop-color='${bottom}'/></linearGradient></defs>` +
        `<path d='${TAB_FILL}' fill='url(#g)'/><path d='M0 28.5H48' stroke='${stroke}'/>` +
        `<path d='${CLASSIC_OUTLINE}' fill='none' stroke='${stroke}' stroke-width='1.2'/>`
    );

  // ── The sheet ──

  function glassCSS() {
    const v = values("glass");
    const f = v.fill / 100;
    const t = v.tabs / 100;
    const e = v.edge / 100;
    const tint = a => rgba(v.tint, a);
    return `
:root {
  --glass-fill: ${tint(f)};
  --glass-edge: ${tint(e)};
  --glass-hover: ${tint(f * 1.6)};
  --glass-press: ${tint(f * 2.4)};
  --glass-popup-base: ${v.menu};
  --glass-glow: ${glow(v["glow-color"], v.glow / 100)};
  --glass-frame:
    linear-gradient(var(--glass-dim), var(--glass-dim)) fixed,
    var(--glass-glow) center var(--glass-glow-y) / 120% auto no-repeat fixed,
    ${v.background};
  --ct-bookmarked: ${v.accent};
  --ct-loading: ${v.accent};
  --ct-tab-active: ${glassTab(tint(f), tint(e), false)};
  --ct-tab-inactive: ${glassTab(tint(t), tint(e), true)};
  --ct-tab-inactive-blurred: ${glassTab(tint(t), tint(e), true)};
  --ct-tab-hover: ${svg(`${TAB}<path d='${TAB_FILL}' fill='${tint((t + f) / 2)}'/>`)};
  --ct-newtab: ${glassNewTab(tint(f), tint(e))};
  --ct-newtab-hover: ${glassNewTab(tint(f * 2), tint(e * 1.8))};
  --ct-newtab-press: ${glassNewTab(tint(f * 0.4), tint(e))};
}
:root:-moz-window-inactive {
  --ct-tab-inactive: var(--ct-tab-inactive-blurred);
}`;
  }

  function classicCSS() {
    const v = values("classic");
    const dark = isDark();
    const stroke = dark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.25)";
    // how much paler the unfocused frame and background tabs are than the frame
    const blur = dark ? 0.06 : 0.47;
    const tab = dark ? 0.08 : 0.4;
    const white = "#ffffff";
    const topBlurred = mix(v["frame-top"], white, blur);
    const bottomBlurred = mix(v["frame-bottom"], white, blur);
    return `
:root {
  --ct-strip-top: ${v["frame-top"]};
  --ct-strip-bottom: ${v["frame-bottom"]};
  --ct-strip-top-blurred: ${topBlurred};
  --ct-strip-bottom-blurred: ${bottomBlurred};
  --ct-toolbar: ${v.toolbar};
  --ct-tab-active: ${classicActive(v.toolbar, stroke)};
  --ct-tab-inactive: ${classicInactive(mix(v["frame-top"], white, tab), mix(v["frame-bottom"], white, tab), stroke)};
  --ct-tab-inactive-blurred: ${classicInactive(mix(topBlurred, white, tab), mix(bottomBlurred, white, tab), stroke)};
}
:root:-moz-window-inactive {
  --ct-strip-top: var(--ct-strip-top-blurred);
  --ct-strip-bottom: var(--ct-strip-bottom-blurred);
  --ct-tab-inactive: var(--ct-tab-inactive-blurred);
}`;
  }

  // Only the active palette, and only once one of its settings is changed.
  function buildCSS() {
    const name = palette();
    if (!items(name).some(isSet)) {
      return "";
    }
    return name == "glass" ? glassCSS() : classicCSS();
  }

  const utils = window.windowUtils;
  let sheet = null;

  function apply() {
    const css = buildCSS();
    const uri = css ? "data:text/css;charset=utf-8," + encodeURIComponent(css) : null;
    if (uri == sheet) {
      return;
    }
    if (sheet) {
      utils.removeSheetUsingURIString(sheet, utils.AUTHOR_SHEET);
    }
    sheet = uri;
    if (sheet) {
      utils.loadSheetUsingURIString(sheet, utils.AUTHOR_SHEET);
    }
  }

  // pref changes arrive here; applied at most once a frame
  let pending = false;
  function schedule() {
    if (pending) {
      return;
    }
    pending = true;
    window.requestAnimationFrame(() => {
      pending = false;
      apply();
      const view = document.getElementById(VIEW_ID);
      if (view?.hasAttribute("visible") || view?.closest("panel")?.state == "open") {
        refresh(view);
      }
    });
  }

  const observer = { observe: schedule };
  Services.prefs.addObserver(BRANCH, observer);
  Services.prefs.addObserver(SCHEME_PREF, observer);
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  darkQuery.addEventListener("change", schedule);
  window.addEventListener(
    "unload",
    () => {
      Services.prefs.removeObserver(BRANCH, observer);
      Services.prefs.removeObserver(SCHEME_PREF, observer);
      darkQuery.removeEventListener("change", schedule);
    },
    { once: true }
  );

  // ── The panel ──

  const PANEL_CSS = `
/* The view takes the main menu's width; min-width: 0 lets the body (a flex
 *   item) shrink to it instead of growing to its content's widest line. */
#${VIEW_ID} .ct-body {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  padding: 4px 12px 8px 16px;
}
#${VIEW_ID} .ct-section {
  margin: 10px 0 4px;
  font-size: 0.9em;
  font-weight: 600;
  opacity: 0.7;
}
#${VIEW_ID} .ct-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-height: 30px;
}
#${VIEW_ID} .ct-row.ct-changed > label::after {
  content: " \\2022";
  color: var(--ct-loading, AccentColor);
}
#${VIEW_ID} input[type="color"] {
  width: 34px;
  height: 22px;
  padding: 1px;
  border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
  border-radius: 4px;
  background: transparent;
}
#${VIEW_ID} .ct-hex {
  box-sizing: border-box;
  width: 9ch;
  min-width: 0;
  padding: 2px 4px;
  font: inherit;
  font-family: monospace;
  color: inherit;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
  border-radius: 4px;
}
#${VIEW_ID} .ct-hex:invalid,
#${VIEW_ID} .ct-hex.ct-bad {
  border-color: #f28b82;
}
#${VIEW_ID} input[type="range"] {
  width: 100px;
  min-width: 0;
  margin: 0;
}
#${VIEW_ID} .ct-value {
  min-width: 4ch;
  text-align: end;
  font-variant-numeric: tabular-nums;
}
#${VIEW_ID} .ct-palette {
  display: flex;
  gap: 4px;
}
#${VIEW_ID} .ct-palette button {
  padding: 2px 10px;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
  border-radius: 4px;
}
#${VIEW_ID} .ct-palette button[aria-pressed="true"] {
  background: color-mix(in srgb, currentColor 18%, transparent);
}
#${VIEW_ID} .ct-note {
  margin-top: 8px;
  font-size: 0.85em;
  opacity: 0.6;
}`;
  utils.loadSheetUsingURIString(
    "data:text/css;charset=utf-8," + encodeURIComponent(PANEL_CSS),
    utils.AUTHOR_SHEET
  );

  const html = (tag, props = {}) => Object.assign(document.createElementNS(XHTML, tag), props);

  function colorRow(s) {
    const row = html("div", { className: "ct-row" });
    const id = `ct-${s.pref.replace(".", "-")}`;
    const label = html("label", { textContent: s.label, htmlFor: id });
    const picker = html("input", { type: "color", id });
    const hex = html("input", {
      type: "text",
      className: "ct-hex",
      spellcheck: false,
      maxLength: 7,
      pattern: "#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})",
    });
    hex.setAttribute("aria-label", `${s.label} (hex)`);
    picker.addEventListener("input", () => set(s, picker.value));
    hex.addEventListener("change", () => {
      const value = normalizeHex(hex.value);
      hex.classList.toggle("ct-bad", !value);
      if (value) {
        set(s, value);
      }
    });
    row.append(label, picker, hex);
    row.ctUpdate = () => {
      const value = get(s);
      picker.value = value;
      if (document.activeElement != hex) {
        hex.value = value;
        hex.classList.remove("ct-bad");
      }
      row.classList.toggle("ct-changed", isSet(s));
    };
    return row;
  }

  function opacityRow(s) {
    const row = html("div", { className: "ct-row" });
    const id = `ct-${s.pref.replace(".", "-")}`;
    const label = html("label", { textContent: s.label, htmlFor: id });
    const range = html("input", { type: "range", id, min: 0, max: 100, step: 1 });
    const out = html("output", { className: "ct-value" });
    range.addEventListener("input", () => {
      out.value = `${range.value}%`;
      set(s, Number(range.value));
    });
    row.append(label, range, out);
    row.ctUpdate = () => {
      const value = get(s);
      range.value = value;
      out.value = `${value}%`;
      row.classList.toggle("ct-changed", isSet(s));
    };
    return row;
  }

  function paletteRow(current) {
    const row = html("div", { className: "ct-row" });
    const group = html("div", { className: "ct-palette", role: "group" });
    group.setAttribute("aria-label", "Palette");
    for (const [value, text] of [["glass", "Glass"], ["classic", "Classic"]]) {
      const b = html("button", { textContent: text, type: "button" });
      b.setAttribute("aria-pressed", String(value == current));
      b.addEventListener("click", () => Services.prefs.setStringPref(THEME_PREF, value));
      group.append(b);
    }
    row.append(html("label", { textContent: "Palette" }), group, html("span"));
    return row;
  }

  // (Re)builds the rows when the palette changed, else just updates them.
  function refresh(view) {
    const body = view.querySelector(".ct-body");
    const name = palette();
    if (body.ctPalette != name) {
      body.ctPalette = name;
      body.replaceChildren(paletteRow(name));
      for (const s of SETTINGS[name]) {
        if (s.section) {
          body.append(html("div", { className: "ct-section", textContent: s.section }));
        } else {
          body.append(s.type == "color" ? colorRow(s) : opacityRow(s));
        }
      }
      body.append(
        html("div", {
          className: "ct-note",
          textContent:
            name == "glass"
              ? "Changes apply to every window right away. The new tab page keeps its own background."
              : "Changes apply to every window right away, in light and dark.",
        })
      );
    }
    for (const row of body.querySelectorAll(".ct-row")) {
      row.ctUpdate?.();
    }
    view.querySelector(".ct-reset").disabled = !items(name).some(isSet);
  }

  function makeView() {
    const view = document.createXULElement("panelview");
    view.id = VIEW_ID;
    view.className = "PanelUI-subView";
    view.setAttribute("title", "Colors & opacity");
    const outer = document.createXULElement("vbox");
    outer.className = "panel-subview-body";
    const body = html("div", { className: "ct-body" });
    const sep = document.createXULElement("toolbarseparator");
    const reset = document.createXULElement("toolbarbutton");
    reset.className = "subviewbutton ct-reset";
    reset.setAttribute("label", "Reset to defaults");
    outer.append(body, sep, reset);
    view.append(outer);
    return view;
  }

  function makeButton() {
    const button = document.createXULElement("toolbarbutton");
    button.id = BUTTON_ID;
    button.className = "subviewbutton subviewbutton-nav";
    button.setAttribute("label", "Colors & opacity");
    button.setAttribute("closemenu", "none");
    return button;
  }

  // the main menu lives in a <template> until first opened: add our button and view there, next to Settings
  const cache = document.getElementById("appMenu-viewCache");
  const settingsButton = (cache?.content ?? document).getElementById("appMenu-settings-button");
  if (!settingsButton) {
    console.error("ct-settings: the main menu's Settings item wasn't found");
    return;
  }
  settingsButton.after(makeButton());
  if (cache) {
    cache.content.append(makeView());
  } else {
    document.body.append(makeView());
  }

  // catch events on the window (capturing) wherever the template's nodes ended up
  window.addEventListener(
    "command",
    e => {
      if (e.target.id == BUTTON_ID) {
        PanelUI.showSubView(VIEW_ID, e.target, e);
      } else if (e.target.classList?.contains("ct-reset") && e.target.closest(`#${VIEW_ID}`)) {
        for (const s of items(palette())) {
          Services.prefs.clearUserPref(prefName(s));
        }
      }
    },
    true
  );
  window.addEventListener(
    "ViewShowing",
    e => {
      if (e.target.id == VIEW_ID) {
        refresh(e.target);
      }
    },
    true
  );

  window.ctSettings = { apply, SETTINGS };
  apply();
});
