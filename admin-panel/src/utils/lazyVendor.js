// Heavy document-generation vendors (jsPDF ~350kB, xlsx ~430kB raw) are only
// ever needed the moment a user actually clicks Export/Download/Print. Keeping
// them out of the main bundle is the single biggest win for first paint and
// for the login -> dashboard transition, so every consumer loads them through
// these memoized dynamic imports instead of a top-level `import`.
//
// Each loader caches its promise, so repeated exports in one session reuse the
// already-downloaded chunk and feel instant after the first use.

let pdfKitPromise = null;
let xlsxPromise = null;
let fileSaverPromise = null;

/**
 * Resolves to `{ jsPDF, autoTable }` — jsPDF plus the autotable plugin, which
 * must be imported alongside it because it augments the jsPDF prototype.
 */
export const loadPdfKit = () => {
  if (!pdfKitPromise) {
    pdfKitPromise = Promise.all([import("jspdf"), import("jspdf-autotable")])
      .then(([pdfModule, autoTableModule]) => ({
        jsPDF: pdfModule.default || pdfModule.jsPDF,
        autoTable: autoTableModule.default || autoTableModule.autoTable
      }))
      .catch((error) => {
        // Allow a later retry rather than caching a permanent failure.
        pdfKitPromise = null;
        throw error;
      });
  }
  return pdfKitPromise;
};

/** Resolves to the SheetJS namespace used for Excel exports. */
export const loadXlsx = () => {
  if (!xlsxPromise) {
    xlsxPromise = import("xlsx").catch((error) => {
      xlsxPromise = null;
      throw error;
    });
  }
  return xlsxPromise;
};

/** Resolves to file-saver's `saveAs`. */
export const loadFileSaver = () => {
  if (!fileSaverPromise) {
    fileSaverPromise = import("file-saver")
      .then((module) => module.saveAs || module.default?.saveAs)
      .catch((error) => {
        fileSaverPromise = null;
        throw error;
      });
  }
  return fileSaverPromise;
};
