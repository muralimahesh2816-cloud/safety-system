// Lightweight cross-page navigation helper. This app uses hand-rolled
// path-based routing (see App.js's moduleFromPath/handleModuleNavigation)
// rather than react-router, so there is no shared router context a
// standalone component like DashboardShortcut could call into directly.
// Rather than prop-drilling a navigate callback through every page, this
// pushes the target URL and re-dispatches "popstate" — App.js already
// listens for that event (to handle the browser Back/Forward buttons) and
// will pick up the new path and update activeModule itself. No changes to
// App.js's routing logic are needed for this to work.
export const goToPath = (path) => {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const goToDashboard = () => goToPath("/dashboard");
