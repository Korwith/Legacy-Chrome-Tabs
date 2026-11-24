# Chrome Classic Tabs for LibreWolf: how it works

This document describes the `userChrome.css` that restyles LibreWolf 160 (Firefox 160) to look and behave like pre-2018 Chrome: trapezoid tabs, a blue frame and a flat address bar. It is written for someone adding **extra color themes**, so it covers:

- where the colors live
- which colors are baked into SVGs
- how the light/dark switch works
- which LibreWolf UI elements are restyled, and how

## Files

| File | Purpose |
|---|---|
| `~/.config/librewolf/librewolf/1k6lwcln.default-release/chrome/userChrome.css` | The stylesheet. LibreWolf reads it at startup only, so restart after every change. |
| `~/.config/librewolf/librewolf/1k6lwcln.default-release/user.js` | Prefs the stylesheet depends on. They are re-applied at every startup. |
| `chrome/userChrome.css.bak-20261116-1947` | The previous version, before the overlap, hit-area and animation rewrite. |
| `chrome/userContent.css` | Page-side part of the themes (Glass: new tab / home / blank pages). |
| `chrome/userChrome.css.bak-20261116-glass` | The version before the Glass theme was appended. |
| `~/Documents/VivaldiCSS/custom.css` | The original Vivaldi version this was ported from. It shares the palette and SVG shapes. |

Required prefs (all set by `user.js`):

| Pref | Value | Why |
|---|---|---|
| `toolkit.legacyUserProfileCustomizations.stylesheets` | `true` | Makes LibreWolf load `userChrome.css` |
| `browser.nova.enabled` | `false` | Nova is the new default look, with an inset rounded page card. The CSS is built on the flat Proton layout. |
| `browser.tabs.inTitlebar` | `1` | Tabs are drawn in the title bar, so the caption buttons are LibreWolf's own (and styled) |
| `sidebar.verticalTabs` / `sidebar.revamp` | `false` | Horizontal tabs only |
| `browser.tabs.groups.enabled` | `false` | Tab groups would break the overlap layout |
| `browser.tabs.hoverPreview.enabled` | `false` | Chrome showed a plain tooltip |
| `browser.tabs.tabMinWidth` | `32` | Tabs shrink down to favicon-only, like Chrome |
| `browser.tabs.tabClipWidth` | `56` | Below this width, only the active tab keeps its "x" |
| `browser.urlbar.trimURLs` / `trimHttps` | `false` | Show the scheme, as Chrome did |
| `browser.uidensity` | `1` | Compact base sizes |

The tab font is **Roboto** (`sudo apt install fonts-roboto`). Fallbacks are Segoe UI, Selawik, Arial, sans-serif.

---

## 1. How userChrome.css works (and the rules it forces on you)

- **It is a user-origin stylesheet** applied to the browser window document (`browser.xhtml`), which is XUL and HTML. Firefox's own chrome CSS is author-origin. In the cascade, *author normal beats user normal, whatever the specificity*, and that includes Firefox's `@layer tokens` variables. So any property or variable that Firefox also sets needs `!important`. Properties Firefox never sets on that element (most pseudo-element drawing, for example) are written without it.
- **User `!important` beats author `!important`.** Use it carefully where Firefox's own `!important` must keep winning. Example: dragged tabs get `z-index: 3 !important` from Firefox, so this file explicitly sets `[dragtarget]` to `2000 !important` rather than letting its own tab z-indexes override the drag.
- **`context-fill` does not work in `data:` SVGs.** Firefox only honours it for `chrome://` URLs. Every icon is therefore either:
  - a **mask** (`mask: url(svg)`) on an element whose `background-color` is the icon color, or
  - a **ready-colored SVG** with the color written into the data URL, used where a state needs two colors (the red-circle close hover).
- **Pseudo-elements on XUL boxes work** (`.tab-background::before`, `.tabbrowser-tab::before`, `#trust-icon-container::after`). On XUL `<image>` elements they don't, so glyphs go on the image itself via `mask` and `background-color`.
- **`-moz-pref("name", value)` media queries work in userChrome.css.** They react live to pref changes and accept int values. The light/dark switch uses this.
- **`sibling-index()` is supported in Firefox 160.** The tab stacking order uses it.

To inspect: set `devtools.chrome.enabled = true` and `devtools.debugger.remote-enabled = true`, then press Ctrl+Alt+Shift+I to open the Browser Toolbox.

---

## 2. File layout (section order)

1. **Header comment**: feature list, setup, notes on `!important` and glyphs.
2. **Palette**: `:root { --ct-* }` for light, a `@media` block for dark, and `:root:-moz-window-inactive` for an unfocused window.
3. **Glyphs**: `--ct-glyph-*` and `--ct-caption-*` mask SVGs. They are colorless (black means drawn).
4. **Geometry**: `--ct-tab-height`, `--ct-tab-slope`, `--ct-frame-top`, `--ct-tab-reach`, `--ct-strip-inset`, `--ct-anim`, with overrides for maximized and fullscreen windows.
5. **Firefox theme variables**: Firefox's own `--tab-*`, `--toolbar-*`, `--toolbarbutton-*` and `--urlbar-*` variables, mapped onto `--ct-*`.
6. **Tab strip**: background, the frame above the tabs, scrollbox padding, hidden scroll arrows, max width.
7. **Tabs**: box, stacking, hit area, trapezoid, hover, open/close animations, contents, close button, audio, spinner, pinned tabs.
8. **New tab button**
9. **Hidden Firefox buttons**
10. **Window (caption) buttons**
11. **Address toolbar**: buttons, field, site-info chip, star, dropdown.
12. **Bookmarks bar**
13. **Menus, find bar**
14. **Pref / Customize Toolbar reference** (comment)
15. **Themes**: one `@media -moz-pref("userChrome.ct.theme", "<name>")` block per theme (§3.5)

Code style: 4-space indentation inside blocks, `/* … */` comments with continuation lines indented as ` *   `, and `--ct-` as the prefix for every custom variable.

---

## 3. The theme system

### 3.1 How light/dark is chosen

```css
:root { color-scheme: light !important; /* light palette */ }

@media -moz-pref("layout.css.prefers-color-scheme.content-override", 0),
       (-moz-pref("layout.css.prefers-color-scheme.content-override", 2) and (prefers-color-scheme: dark)) {
    :root { color-scheme: dark !important; /* dark palette */ }
}

:root:-moz-window-inactive { /* swap strip + inactive-tab fill to the *-blurred values */ }
```

- `layout.css.prefers-color-scheme.content-override` is the pref behind **Settings → General → Website appearance**: `0` is Dark, `1` is Light and `2` is Automatic.
- **The browser UI does *not* see that setting through `prefers-color-scheme`.** That media query only follows the system and browser theme. This is why the pref is read directly.
- With Automatic, `prefers-color-scheme` decides. That covers the OS theme and LibreWolf's built-in Dark theme in about:addons, and both were tested.
- Setting `color-scheme` on `:root` makes all of Firefox's own `light-dark()` colors follow, so menus, panels and the URL dropdown switch too.

### 3.2 Adding another theme

A theme is a set of `--ct-*` overrides on `:root`. You also need a way to select it. Options:

- **Custom pref (used):** `@media -moz-pref("userChrome.ct.theme", "ocean") { :root { … } }`, with `user_pref("userChrome.ct.theme", "ocean")` in `user.js` or set in about:config. Tested in LibreWolf 160: a user-created string pref works, switches live without a restart, and also works in `userContent.css`. Theme blocks must come **after** the base rules in `userChrome.css` (an `@import`ed file would lose every tie with the base), so each theme is a section appended at the end.
- **Edit-in:** keep one palette block active and the others commented out, or in separate files that you `@import` from the top of `userChrome.css` (imports must come first).
- **Window theme attribute:** LibreWolf themes from about:addons set `:root[lwtheme]` and `[lwtheme-brighttext]`. A specific theme can't be targeted by name, though.

Each theme needs a **light and a dark** value set, plus **blurred** (unfocused window) strip and inactive-tab values. Put dark variants inside a block that uses the same `@media` condition as §3.1 so Website appearance still works.

### 3.3 Palette variables

| Variable | Light default | Dark default | Used for |
|---|---|---|---|
| `--ct-strip-top` / `--ct-strip-bottom` | `#acbed8` / `#98add2` | `#3f444c` / `#33373e` | Frame gradient across the 29px tab row. Solid `--ct-strip-top` above it. |
| `--ct-strip-top-blurred` / `-bottom-blurred` | `#d3dceb` / `#c8d3e6` | `#4b4f56` / `#43464c` | Same, for an unfocused window |
| `--ct-stroke` | `rgba(0,0,0,.25)` | `rgba(0,0,0,.45)` | Line along the strip's bottom edge |
| `--ct-toolbar` | `#f2f2f2` | `#55595e` | Address toolbar, bookmarks bar, find bar. **Must equal the active tab SVG fill.** |
| `--ct-toolbar-line` | `#b7b5b7` | `#26282b` | Line under the toolbar |
| `--ct-text` / `--ct-text-inactive` | `#000` / `#333` | `#f1f1f1` / `#c4c4c4` | Active / background tab titles |
| `--ct-icon` / `--ct-icon-disabled` | `#5e6267` / `#d6d7d7` | `#e3e3e3` / `#7d8084` | Toolbar glyphs (mask color) |
| `--ct-button-hover` / `-hover-line` / `-press` | translucent black | translucent white | Toolbar button hover square, outline, press |
| `--ct-caption-*` | | | Minimize, maximize and close glyphs and hovers. Close hover is `#e81123`. |
| `--ct-url-bg`, `-text`, `-border`, `-focus`, `-separator` | `#fff`, `#000`, `#aaa`, `#4d90fe`, `#c8c8c8` | | Address field |
| `--ct-secure` / `--ct-insecure` | `#0b8043` / `#c53929` | `#81c995` / `#f28b82` | Padlock + "Secure" / broken-security ⓘ |
| `--ct-bookmarked` | `#4285f4` | `#8ab4f8` | Filled star |
| `--ct-loading` / `--ct-waiting` | `#4285f4` / `#9e9e9e` | `#8ab4f8` / `#8a8d91` | Spinner arc: loading / waiting |
| `--ct-dropdown-bg`, `-text`, `-selected`, `-shadow` | | | Address dropdown |

### 3.4 SVG variables: colors baked in (the part that's easy to get wrong)

These are `data:` URLs with **hard-coded colors**. A theme that changes the related plain colors must regenerate them. In data URLs, `#` is written `%23`.

| Variable | Color inside | Must match |
|---|---|---|
| `--ct-tab-active` | fill `#f2f2f2` (dark `#55595e`), outline `rgba(0,0,0,.25)` | `--ct-toolbar`. The active tab merges into the toolbar with no seam. |
| `--ct-tab-inactive` | vertical gradient `#cdd8e8 → #c1cee4` (dark `#4e535a → #43474d`), bottom line, outline | **Derived from the strip.** See the formula below. |
| `--ct-tab-inactive-blurred` | `#e5eaf3 → #dee5f0` (dark `#595d64 → #52555a`) | Derived from the blurred strip |
| `--ct-tab-hover` | `rgba(255,255,255,.25)` (dark `.07`) | Translucent on purpose: an overlay on top of the opaque fill |
| `--ct-newtab`, `-hover`, `-press` | translucent white over the strip; outline | Translucent on purpose: the button never overlaps anything |
| `--ct-close` | glyph `#5a5a5a` (dark `#c8c8c8`) | Resting "x" color |
| `--ct-close-hover` / `--ct-close-press` | circle `#db4437` / `#a8352a`, white glyph | Same in both palettes |

**Inactive tab fill formula.** Background tabs are **opaque**, so overlapping tabs never show through each other. Their fill reproduces what a translucent white wash over the strip would look like:

```
inactive_top    = mix(strip_top,    white, a)
inactive_bottom = mix(strip_bottom, white, a)
light: a = 0.40    dark: a = 0.08
mix(c, white, a) = c * (1 - a) + 255 * a   (per channel)
```

This only lines up because the strip gradient spans exactly the 29px tab row (`#TabsToolbar` background: `linear-gradient(top, bottom) bottom / 100% 29px`). The area above the tabs is solid `--ct-strip-top`. Keep that if you change the strip, and derive the blurred variant from the blurred strip colors in the same way.

**Mask glyphs** (`--ct-glyph-*`, `--ct-caption-*`, `--ct-empty`) carry no color. They take it from `background-color`, so themes never need to touch them.

### 3.5 Theme: Glass

Selected by `user_pref("userChrome.ct.theme", "glass")` (in `user.js`). The kircic.org look: a black window with `blurred.svg` glowing through it, and every surface a pane of glass, `rgba(255,255,255,.05)` fill and `rgba(255,255,255,.1)` edge with 8px corners. It is dark only and ignores the Website appearance setting for the frame.

| Variable | Value | Used for |
|---|---|---|
| `--glass-fill` / `--glass-edge` | `.05` / `.1` white | Toolbar, bookmarks bar, active tab, address field, borders |
| `--glass-hover` / `--glass-press` | `.08` / `.12` white | Buttons, menu items, dropdown rows |
| `--glass-radius` | `8px` | Field, buttons, menus |
| `--glass-popup-base` | `#0c0e12` | Solid base under menus, panels and the address dropdown, which float over the page |
| `--glass-glow` | `blurred.svg` as a data URL | The blur |
| `--glass-glow-y` | `calc(42px - 34.4vw)` | Vertical position of the glow's middle. The site uses `center`, but the frame is only the top ~85px of the window and stayed black, so the glow is centred on the toolbars instead. `center` restores the site's placement. |
| `--glass-frame` | the whole background stack | Black, glow at `120% auto`, a dimming layer for unfocused windows. **Every layer is `background-attachment: fixed`**, so any element painting it lines up with every other one. |

How it works with the tab system:
- **Translucent tabs can't hide each other by being opaque** (§3.4). Instead, a background tab's `.tab-background` is `clip-path`-ed where a neighbour is drawn on top of it: along the neighbour's edge, over the whole height of the strip. The cut runs 1.2px to the lower tab's side of the neighbour's edge line: enough to clear both 1px outlines (about 0.55px across each at this slope). So the lower tab's outline ends at the outer side of the neighbour's, above and below the crossing, instead of overlapping it. Cutting along the centre of the line, or only below the crossing, left a brighter blob where the two outlines met. Measured at 3x: peak brightness at the crossing went from 82-90 to 64-73, against 55-63 for a plain stretch of edge. A background tab is always clipped on the left, unless it has no left neighbour (the first pinned tab, or the first normal tab when there are no pinned tabs). It is clipped on the right when the next tab is the active one (`:has(+ [visuallyselected])`). That can't see from the last pinned tab into the other scrollbox, so a second selector clips the last pinned tab when the first normal tab is active. The clip edges are set through `--ct-clip-start` / `--ct-clip-end`; the exceptions must out-rank the general rule's specificity, or they silently lose (which once clipped the first pinned tab's corner).
- **The line under the tabs can't be covered by the see-through active tab.** The two tab scrollboxes paint `--glass-frame` themselves, which is pixel-identical to what's behind them but hides `#TabsToolbar`'s line. Inside, background tabs carry the line in their SVG, and `#tabbrowser-arrowscrollbox-periphery::after` (the new tab button's box) draws it from the last tab's bottom corner, pinned or not, to the end of the scrollbox. Outside, it is drawn on the customization target's start, the elements after `#tabbrowser-tabs`, and the caption-button box.
- The active tab SVG has the same `.05` fill as `#nav-bar`, so it flows into the toolbar with no seam.
- `userContent.css` gives about:newtab, about:home, about:privatebrowsing and about:blank the site's exact background (glow centred at 120%, fixed) and glass search box and shortcut tiles.

- **`--ct-tab-inactive-blurred` must be its own image, never `var(--ct-tab-inactive)`.** In an unfocused window the base sets `--ct-tab-inactive: var(--ct-tab-inactive-blurred)`, so referencing it back is a cycle that makes both invalid. That is true for every theme.

Known limits: popups, including the address dropdown, can't be checked in Marionette screenshots; their colors were checked through computed styles.

---

## 4. Geometry

| Variable | Value | Meaning |
|---|---|---|
| `--ct-tab-height` | `29px` | Tab row height and trapezoid SVG height |
| `--ct-tab-slope` | `8px` | How far the trapezoid reaches past the tab box on each side |
| `--ct-frame-top` | `18px` (maximized `2px`, fullscreen `0`) | Frame above the tabs |
| `--ct-tab-reach` | `8px` (maximized `2px`, fullscreen `0`) | Part of that frame that still selects the tab below it |
| `--ct-strip-inset` | `4px` (fullscreen `0`) | First tab's bottom corner to the window edge (to the incognito icon's 28px box in a private window, so 32px from the edge) |
| `--ct-anim` | `200ms ease-out` | Open/close timing (Chrome's BoundsAnimator) |

Other fixed sizes:
- Tab max width: **135px** box. That is the distance between neighbouring tabs; with the slopes, a tab is drawn 151px wide.
- Pinned tabs: a 40px box (56px trapezoid).
- Toolbar: **36px**. Omnibox: **28px**, white, 1px `#aaa` border, 2px radius.
- Toolbar buttons: **28px** squares, 1px apart. `#nav-bar .toolbarbutton-1` gets `padding: 0` and `height: 28px`, because Firefox pads the first and last buttons by 8px and stretches them to the toolbar's 36px; the hover square is drawn on that element, so ⋮ used to get a 36px box with its dots off-centre.
- Caption buttons: **45×29**.
- Title: Roboto **12px**. URL text: **13px**.

---

## 5. UI elements and how each is restyled

### 5.1 Tab DOM (Firefox 160)

```
#TabsToolbar (.browser-titlebar)
├─ .titlebar-spacer[type=pre-tabs]                 hidden
├─ .toolbar-items                                  padding-top = frame-top − tab-reach
│  └─ #TabsToolbar-customization-target           padding-inline-start = strip inset
│     ├─ #tabbrowser-tabs[orient=horizontal]
│     │  ├─ arrowscrollbox#pinned-tabs-container   pinned tabs
│     │  └─ arrowscrollbox#tabbrowser-arrowscrollbox
│     │     ├─ tab.tabbrowser-tab  ×N
│     │     │  └─ .tab-stack
│     │     │     ├─ .tab-background               trapezoid drawn on ::before / ::after
│     │     │     │  ├─ .tab-context-line          hidden
│     │     │     │  ├─ .tab-loading-burst         ::before hidden
│     │     │     │  └─ .tab-group-line            hidden
│     │     │     └─ .tab-content
│     │     │        ├─ .tab-icon-stack (.tab-throbber, .tab-icon-image, overlays)
│     │     │        ├─ moz-button.tab-audio-button   order 1
│     │     │        ├─ .tab-label-container > .tab-label
│     │     │        └─ image.tab-close-button        order 2
│     │     └─ #tabbrowser-arrowscrollbox-periphery > #tabs-newtab-button
│     ├─ #new-tab-button                           shown instead when tabs overflow
│     └─ #alltabs-button, toolbarspring            hidden
└─ .titlebar-buttonbox-container > .titlebar-buttonbox > .titlebar-min/-max/-restore/-close
```

Attributes Firefox sets, all copied down from the `tab` to its parts:

| Attribute | Meaning |
|---|---|
| `[visuallyselected]` (`[selected]` on children) | Active tab |
| `[fadein]` | The tab has finished appearing. It is removed again when the tab starts closing. |
| `[pinned]` | Pinned tab |
| `[busy]` / `[progress]` | Waiting for the server / receiving the page |
| `[titlechanged]` | Pinned tab's title changed while you were elsewhere |
| `[multiselected]` | Part of a Ctrl+click selection |
| `[dragtarget]` | Being dragged |
| `#tabbrowser-tabs[closebuttons="activetab"]` | Tabs are narrower than `tabClipWidth` |

Firefox 160 has **no attribute for "unread"** (`[notselectedsinceload]` is declared but never set), so the Vivaldi mod's italic unread titles were dropped.

### 5.2 Tab shape (9-slice trapezoid)

`.tab-background::before` is absolutely positioned with `inset: 0 -8px`. It draws the 48×29 SVG as a `border-image` with `slice 0 16 0 16 fill`:
- the 16px left and right caps hold the slopes, the rounded top corners and the flared bottom corners;
- the middle is a plain rectangle stretched to any width.

`.tab-background::after` draws the same shape with `--ct-tab-hover`. It sits at `opacity: 0` and fades to `1` over 120ms on hover, because `border-image-source` can't be transitioned. It also stays at `1` for Ctrl+click multi-selected tabs.

Firefox's own tab look is neutralised in two places:
- `--tab-background-color*`, `--tab-border-color*` and `--tab-box-shadow-selected` are set to transparent or none;
- `.tab-background` has its border, radius, background, shadow and outline removed.

### 5.3 Overlap and stacking

- **Overlap:** the tab box equals the distance between tabs. Each trapezoid reaches 8px past its box on both sides, so a tab's bottom corner starts exactly where its neighbour's top corner ends.
- **Room for the slopes:** the first tab in each scrollbox gets `margin-inline-start: 8px` so its slope isn't clipped. The last pinned tab also gets `margin-inline-end: 8px`, and the pinned container gets `margin-inline-end: -16px`, so pinned and normal tabs overlap like neighbours.
- **`::part()` does not work from userChrome.css** in LibreWolf 160: rules on the scrollboxes' parts (`items-wrapper`, `scrollbutton-*`, `overflow-*-indicator`) never match, even a plain `#tabbrowser-arrowscrollbox::part(items-wrapper) { outline: … }`. Style the light-DOM elements (the tabs) instead. The earlier `items-wrapper` padding was dead, which cut off the first tab's slope when maximized and the pinned tabs' slopes always.
- With **only pinned tabs**, the new tab button (`#tabbrowser-arrowscrollbox-periphery`) takes the first normal tab's 8px start margin, so it keeps its gap after the last pinned tab instead of sliding 8px under it.
- The trapezoid pseudo-elements have `border: 0 solid transparent` under the border image. If the image is ever missing (an invalid `--ct-tab-*` variable), the 16px caps stay invisible instead of painting as solid blocks in the text color.
- Pinned tabs hide their title with `.tab-label-container[pinned] { display: none }`. Firefox's own `width: 0` loses to the container's `flex: 1`.
- **Stacking**, read from zoomed frames of Chrome recordings:

  | Tabs | z-index |
  |---|---|
  | Background tabs | `calc(500 - sibling-index())`: the left one is on top |
  | Pinned tabs | `calc(900 - sibling-index())`: above every normal tab |
  | Active tab | `1000` |
  | Dragged tab | `2000 !important` |

- Because fills are opaque, the hidden part of the lower tab is never visible. Of two background tabs, the left one's right edge shows below the crossing point, as in Chrome.

### 5.4 Click (hit) area

- `.tabbrowser-tab` has `pointer-events: none`.
- `.tabbrowser-tab::before` is the only part that takes the mouse. It has the same ±8px reach as the trapezoid and a `clip-path` polygon in the trapezoid's shape, plus a rectangle of `--ct-tab-reach` straight above the flat top. So:
  - a click in an overlap goes to whichever tab is drawn there;
  - the gap between two tab tops falls through to the frame (window drag);
  - clicks just above a tab select it. When maximized this reaches the screen edge (y = 0).
- The reach comes from the tab's own `padding-top`, taken out of the toolbar's top padding. The tab's box therefore grows upward inside the scrollbox and isn't clipped.
- `.tab-close-button` and `.tab-audio-button` get `pointer-events: auto; position: relative; z-index: 1` so they sit above the hit layer.
- `-moz-window-dragging: no-drag` on the hit layer keeps the window from dragging there.

### 5.5 Open/close animations

These were measured against the Chrome recordings and tested in LibreWolf.

| Event | Firefox mechanism | What the CSS does |
|---|---|---|
| Open | The tab is inserted without `[fadein]`; it is added on the next frame, and `min-width`/`max-width` transition from 0 | `--tab-width-transition` is 200ms ease-out. The `.tab-stack` of a tab without `[fadein]` has `translateY(100%)`; once `[fadein]` arrives it slides up to 0 over 200ms. The scrollbox clips it below the strip. |
| Close | `[fadein]` is removed, the width shrinks to 0, and the tab is removed on `transitionend` (max-width) | The tab is kept visible (Firefox blanks it): `visibility: visible` and `.tab-label { display: block }` on `:not([fadein])`. The no-`[fadein]` state carries `transition: transform 0s linear 10s`, so a closing tab never slides down. Transitions use the *new* state's timing, so a tab sliding up uses 200ms while a closing tab waits 10s and is gone first. |
| Hover | | 120ms opacity fade on the hover layer |
| Loading | `.tab-throbber[busy]` and `[progress]` | A 2px border arc (`border-top` only). Grey and turning backwards while waiting; blue and turning forwards with `[progress]`. One turn every 1333ms, measured from the recording. Firefox's sprite `::before` is removed. |
| Pinned title change | `[titlechanged]` | The hover layer pulses (1s alternate) |

`prefers-reduced-motion: reduce` turns the slide off.

### 5.6 Tab contents

- `.tab-content` has padding `8px` start and `7px` end. That puts the favicon 16px from the trapezoid's bottom-left corner and the "x" 15px from its bottom-right corner. It is `overflow: clip` so contents are cut off while a tab opens or closes.
- The title starts 6px after the favicon (`--tab-icon-margin-inline-end: 6px`).
- Pages without a favicon get Firefox's default page icon; Firefox hides it in horizontal tabs, Chrome showed one.
- **Title fade:** Firefox's own mask on `.tab-label-container[textoverflow]`, with `--tab-label-mask-size: 20px !important` on the tab, including on hover where Firefox would widen it to 2em. Firefox only adds `[textoverflow]` when the title doesn't fit, so short titles are never faded. No ellipsis.
- **Close "x":** a 16×16 `<image>`. Its `list-style-image` is replaced by `--ct-empty`, and the glyph is a `background` (`--ct-close` → `--ct-close-hover` → `--ct-close-press`).
  - Below `tabClipWidth`, Firefox hides inactive tabs' "x" itself (`[closebuttons="activetab"]`).
  - The active tab is forced to always show one.
- **Audio:** the speaker button is moved between the title and the "x" with flex `order`, and its button background is removed.

### 5.7 New tab button

`#tabs-newtab-button` (after the last tab) and `#new-tab-button` (shown when tabs overflow) both use:
- `appearance: none`, with the "+" icon hidden;
- a 41px-wide button whose background is the 33×17 slanted SVG (`M0.5 0.5H26L32.5 16.5H7Z`, every variant) at `calc(11px − slope) calc(100% − 5px)`. Measured from the reference: 11px right of the last tab's top corner, 7px below it, 5px above the strip's bottom edge, sides sloping about 3:7.

Hover and press swap the SVG.

### 5.8 Tab strip and frame

- `#TabsToolbar` background, three layers:
  1. a 1px `--ct-stroke` line at the bottom;
  2. a 29px gradient at the bottom;
  3. solid `--ct-strip-top`.
- Firefox fades the title bar in an unfocused window (`.browser-titlebar` opacity); that is reset to 1.
- `.titlebar-spacer` elements are hidden. The 18px frame above the tabs is the drag area.
- Scroll arrows: the `::part(scrollbutton-*)` and `::part(overflow-*-indicator)` rules meant to hide them **don't match** (see §5.3). Once tabs overflow, Firefox's ‹ › arrows show at both ends of the tab scrollbox. Firefox also scrolls with the wheel once tabs reach `tabMinWidth`.
- Hidden in the strip: Firefox View, "List all tabs", the Smart Window / AI buttons, flexible spaces, and the private-browsing label.
- **Private windows:** `.private-browsing-indicator-with-label` is moved before the tabs (`order: -1`), aligned to the tab row, with padding `5px 4px 0 8px`. Its icon is replaced by `--ct-glyph-incognito` (hat and glasses), a 16px mask colored `--ct-text`. The first tab's bottom corner ends up 32px from the window edge, as in the reference. In the glass theme the strip line is drawn under it too.

### 5.9 Caption buttons

- `.titlebar-buttonbox` has `appearance: none` and is aligned to the top.
- Each `.titlebar-button` is 45×29 with no padding.
- The order is forced to minimize, maximize/restore, close, whatever the GTK layout says.
- Glyphs are 10×10 masks on `.toolbarbutton-icon`, filled with `currentColor` (`--ct-caption-glyph`).
- Hover uses translucent fills; close turns `#e81123` with a white glyph.
- **Not verified on screen:** the test runs were headless, which has no custom title bar.

### 5.10 Address toolbar (`#nav-bar`)

- **Toolbar:** `--ct-toolbar` background, at least 36px tall, no top border. A 1px `--ct-toolbar-line` border sits on the bottom of `#navigator-toolbox`.
- **Buttons:**
  - Firefox's hover/active variables are set to transparent, because the icon element now carries the glyph mask and can't also show a hover background.
  - Hover and press are drawn on the `.toolbarbutton-1` element itself instead: a 2px radius, an inset 1px outline on hover, and a darker fill on press, `[open]` and `[checked]`.
- **Glyphs:** `#back-button`, `#forward-button`, `#reload-button`, `#stop-button` and `#PanelUI-menu-button` (⋮).
  - The icon's `list-style-image` is replaced by `--ct-empty`.
  - The glyph is `mask: var(--ct-glyph)`, colored by `background-color: var(--ct-icon)`.
  - Disabled buttons use `--ct-icon-disabled`.
  - The reload/stop morph animation (`.toolbarbutton-animatable-box`) is hidden.
- **Hidden:** Home, sidebar, Firefox account, the Forget button, and flexible spaces.
- **Extensions button:** `ct-extensions.uc.js` pins each extension to the toolbar the first time it is seen (as legacy Chrome showed every extension icon) and sets `:root[ct-extensions-all-pinned]` while the extensions panel holds none. The puzzle button is hidden only then, and not while `#nav-bar[overflowing]` (overflowed pinned extensions move into that panel). Without the loader it always shows.
- **Field (`#urlbar`, a light-DOM `moz-urlbar`):**
  - Firefox's `--urlbar-*` variables give it the 28px height, colors and border.
  - The open-state growth and overhang variables are set to 0 so the field doesn't grow when the dropdown opens.
  - `.urlbar-background` gets a 2px radius and no shadow; `[popover-open]` gets square bottom corners and no clip-path.
  - The text is `.urlbar-input` at 13px Roboto.
  - The search-mode switcher shows only while a search mode is active, and the go arrow is hidden.
- **Site-info chip** (`#trust-icon-container` with `.secure`/`.insecure`, or `#identity-box` for internal pages):
  - no chip background;
  - `#trust-icon` gets a mask glyph (ⓘ, or a padlock when secure) colored by `--ct-site-color`;
  - secure pages add `::after { content: "Secure" }` in green, followed by a thin separator;
  - the tracker count, the trust label and the tracking-protection shield are hidden.
- **Star:**
  - `#star-button-box` is forced visible.
  - `#star-button` gets a mask: an outline star, or a filled star colored `--ct-bookmarked` when `[starred]`.
  - (The old bug, an invisible star, was caused by `context-fill` in a `data:` SVG.)
- **Page actions:** reader mode, Picture-in-Picture and translations are hidden. The zoom indicator and the password key icon stay.
- **Dropdown:** `.urlbarView` with square corners, `.urlbarView-background` colored, and 24px rows (`.urlbarView-row`, `-row-inner`). The selected or hovered row uses `--ct-dropdown-selected`. `.search-one-offs` is hidden.

### 5.11 Bookmarks bar, menus, find bar, Nova

- **Bookmarks bar:** `#PersonalToolbar` is 28px on `--ct-toolbar` with no separators. `.bookmark-item` has 6px padding, a 2px radius and the same hover/press as toolbar buttons.
- **Menus:** `menupopup` and `panel` get `--panel-border-radius: 0` and square menu items, in the Roboto font.
- **Find bar:** `findbar` gets toolbar colors. It can't be moved to Chrome's top-right box.
- **Nova fallback:** `.browserContainer` gets `--content-area-start-radius: 0`, no radius and no top border, so the page isn't an inset card if Nova is on.

---

## 6. Testing setup that was used

LibreWolf can be driven headless through Marionette, with the browser UI as the script target:

```bash
MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1 librewolf --headless --marionette --no-remote --profile <copy-of-profile>
```

- `marionette.port` is 2828.
- A small Python client sends `WebDriver:NewSession`, then `Marionette:SetContext {"value":"chrome"}`, then either:
  - `WebDriver:ExecuteScript` to run JS with access to `gBrowser`, `getComputedStyle` and `document.elementFromPoint`, or
  - `WebDriver:TakeScreenshot`, which captures the browser UI;
  - or `WebDriver:PerformActions` for real mouse clicks.
- Use a **copy** of the profile (`rsync` without `lock`), with test prefs in its own `user.js`.
- Check animations by sampling `getBoundingClientRect().width` and the `.tab-stack` transform on every `requestAnimationFrame` while calling `gBrowser.addTab(...)` / `gBrowser.removeTab(tab, {animate: true})`.
- Check themes by setting `layout.css.prefers-color-scheme.content-override` live (0/1/2) and enabling `firefox-compact-dark@mozilla.org` through `AddonManager`.

## 7. Known limits

- The hover glow that followed the mouse in classic Chrome: CSS can't track the pointer.
- Chrome-style tab dragging and tear-off animation; Firefox's own drag is kept.
- Tabs that never scroll: Firefox scrolls once tabs reach `tabMinWidth`, and shows its scroll arrows (they can't be hidden without `::part()`).
- A green "https" scheme in the address: Firefox greys the scheme and path in a single color that CSS can't style separately.
- Italic unread titles: no attribute exists for them.
- The find bar staying at the bottom of the page.
- A profile-name button in the frame. LibreWolf disables Firefox accounts anyway.
- Caption buttons haven't been checked on screen (headless testing).
