// LegacyChromeTabs loader: runs <profile>/chrome/*.uc.js in each browser window (autoconfig skips line 1)
try {
  const { interfaces: Ci, utils: Cu } = Components;

  Services.obs.addObserver(
    {
      observe(win) {
        win.addEventListener(
          "DOMContentLoaded",
          () => {
            if (win.location.href != "chrome://browser/content/browser.xhtml") {
              return;
            }
            const dir = Services.dirsvc.get("UChrm", Ci.nsIFile);
            if (!dir.exists()) {
              return;
            }
            // file:// scripts are refused in chrome; resource:// ones are not
            Services.io
              .getProtocolHandler("resource")
              .QueryInterface(Ci.nsIResProtocolHandler)
              .setSubstitution("userchrome", Services.io.newFileURI(dir));
            const entries = dir.directoryEntries;
            while (entries.hasMoreElements()) {
              const file = entries.nextFile;
              if (!file.leafName.endsWith(".uc.js") || !file.isFile()) {
                continue;
              }
              try {
                const url = `resource://userchrome/${encodeURIComponent(file.leafName)}`;
                Services.scriptloader.loadSubScript(`${url}?${file.lastModifiedTime}`, win);
              } catch (e) {
                Cu.reportError(e);
              }
            }
          },
          { once: true }
        );
      },
    },
    "chrome-document-global-created"
  );
} catch (e) {
  Components.utils.reportError(e);
}
