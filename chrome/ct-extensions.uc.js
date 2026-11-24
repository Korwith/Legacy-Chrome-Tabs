// Legacy Chrome put every extension's icon on the toolbar. Firefox puts new ones in the
// extensions (puzzle) panel, whose button the theme hides. So: pin each extension to the
// toolbar the first time it is seen, and flag the window while nothing is left in the panel
// (userChrome.css hides the button only then, so an unpinned extension stays reachable).
window.delayedStartupPromise.then(() => {
  const { CustomizableUI } = ChromeUtils.importESModule("resource:///modules/CustomizableUI.sys.mjs");
  const SEEN_PREF = "userChrome.ct.extensions.pinned"; // widget ids already pinned once
  const PANEL_AREA = "unified-extensions-area";
  const ATTR = "ct-extensions-all-pinned";
  const root = document.documentElement;

  if (root.ctExtensions) {
    return;
  }
  root.ctExtensions = true;

  const isExtension = id => id.endsWith("-browser-action");

  function seen() {
    try {
      return new Set(JSON.parse(Services.prefs.getStringPref(SEEN_PREF, "[]")));
    } catch (e) {
      return new Set();
    }
  }

  // pin extensions never seen before; one the user unpins later stays in the panel
  function pinNew() {
    const ids = seen();
    let changed = false;
    for (const id of CustomizableUI.getWidgetIdsInArea(PANEL_AREA)) {
      if (isExtension(id) && !ids.has(id)) {
        CustomizableUI.addWidgetToArea(id, CustomizableUI.AREA_NAVBAR);
        ids.add(id);
        changed = true;
      }
    }
    // remember the ones already on the toolbar too, so unpinning them later sticks
    for (const id of CustomizableUI.getWidgetIdsInArea(CustomizableUI.AREA_NAVBAR)) {
      if (isExtension(id) && !ids.has(id)) {
        ids.add(id);
        changed = true;
      }
    }
    if (changed) {
      Services.prefs.setStringPref(SEEN_PREF, JSON.stringify([...ids]));
    }
  }

  function update() {
    pinNew();
    const leftInPanel = CustomizableUI.getWidgetIdsInArea(PANEL_AREA).some(isExtension);
    root.toggleAttribute(ATTR, !leftInPanel);
  }

  // a new extension's widget is placed after it is created, so check once things settle
  let queued = false;
  function queue() {
    if (!queued) {
      queued = true;
      window.setTimeout(() => {
        queued = false;
        update();
      }, 0);
    }
  }

  const listener = {
    onWidgetCreated: queue,
    onWidgetAdded: queue,
    onWidgetRemoved: queue,
    onWidgetMoved: queue,
    onWidgetDestroyed: queue,
    onWidgetReset: queue,
    onWidgetUndoMove: queue,
  };
  CustomizableUI.addListener(listener);
  window.addEventListener("unload", () => CustomizableUI.removeListener(listener), { once: true });
  update();
});
