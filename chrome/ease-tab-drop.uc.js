// Ease a dropped tab into its new place over 200ms instead of snapping (holds it in place, then slides)
window.delayedStartupPromise.then(() => {
  const DURATION = "200ms";
  const EASING = "ease-out";
  const GIVE_UP_MS = 2000; // if the browser never lets go, stop holding the tab
  const DRAGGED = ":is(.tabbrowser-tab, tab-split-view-wrapper)[dragtarget]";

  const tabs = window.gBrowser?.tabContainer;
  if (!tabs || tabs.ctEaseTabDrop) {
    return;
  }
  tabs.ctEaseTabDrop = true;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function follow(item, droppedLeft) {
    let ours = null; // the transform we last set, to tell it from the browser's
    const observer = new MutationObserver(update);
    const timer = window.setTimeout(() => finish(true), GIVE_UP_MS);

    function stop() {
      observer.disconnect();
      window.clearTimeout(timer);
    }

    function setOffset(dx, transition) {
      item.style.transition = transition;
      ours = dx ? `translateX(${dx}px)` : "";
      item.style.transform = ours;
      observer.takeRecords(); // our own change, not the browser's
    }

    // how far the item is from where it was dropped, untransformed
    function offset() {
      item.style.transition = "none";
      item.style.transform = "";
      return droppedLeft - item.getBoundingClientRect().left;
    }

    function finish(slide) {
      stop();
      if (!item.isConnected) {
        return;
      }
      if (item.hasAttribute("tabdrop-samewindow")) {
        // the browser animates this drop itself
        item.removeAttribute("ct-dropping");
        return;
      }
      const dx = slide ? offset() : 0;
      if (Math.abs(dx) < 1) {
        setOffset(0, "");
        item.removeAttribute("ct-dropping");
        return;
      }
      setOffset(dx, "none");
      item.getBoundingClientRect(); // start from there
      setOffset(0, `transform ${DURATION} ${EASING}`);

      const done = event => {
        if (event && (event.target != item || event.propertyName != "transform")) {
          return;
        }
        item.removeEventListener("transitionend", done);
        item.removeEventListener("transitioncancel", done);
        if (!item.hasAttribute("dragtarget")) {
          item.style.transition = "";
        }
        item.removeAttribute("ct-dropping");
      };
      item.addEventListener("transitionend", done);
      item.addEventListener("transitioncancel", done);
    }

    function update() {
      if (!item.isConnected || item.hasAttribute("tabdrop-samewindow")) {
        finish(false);
        return;
      }
      if (!item.hasAttribute("dragtarget")) {
        finish(true);
        return;
      }
      // Still the browser's drag transform: it hasn't handled the drop yet
      if (item.style.transform && item.style.transform != ours) {
        return;
      }
      // the browser has cleared it but not let go yet: hold the item in place
      item.setAttribute("ct-dropping", "");
      setOffset(offset(), "none");
    }

    observer.observe(item, {
      attributes: true,
      attributeFilter: ["style", "dragtarget", "tabdrop-samewindow"],
    });
  }

  tabs.addEventListener(
    "drop",
    () => {
      if (reduceMotion.matches || tabs.verticalMode) {
        return;
      }
      for (const item of tabs.querySelectorAll(DRAGGED)) {
        // a tab of a dragged split view moves with its split view
        if (item.parentElement?.matches("tab-split-view-wrapper[dragtarget]")) {
          continue;
        }
        follow(item, item.getBoundingClientRect().left);
      }
    },
    true
  );
});
