import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Renders overlay content into a dedicated node on `document.body`.
 *
 * Why this exists — the bug it fixes:
 *
 * `position: fixed` is only relative to the viewport while no ancestor
 * establishes a containing block. Any ancestor with a `transform`, `filter`,
 * `perspective`, `backdrop-filter`, `contain: paint` or `will-change:
 * transform` takes over that role. The app shell has several: the page
 * transition wrapper animates `y` (so it carries a transform for the duration
 * of every navigation), and `.page-content` scrolls with `overflow: auto`.
 *
 * The result was that a modal declaring `fixed inset-0` did not cover the
 * viewport at all — it was laid out inside the content column, starting to the
 * right of the sidebar and clipped by the scroll container. That is what made
 * "View Details" cards look like the sidebar was covering them.
 *
 * Raising z-index cannot fix this: the modal is not losing a stacking contest,
 * it is being positioned and clipped by the wrong box. Portalling to `body` is
 * the actual fix, and it keeps working no matter what transforms or scroll
 * containers are added to the shell later.
 *
 * The portal host sits outside `#root` so no app-level stacking context can
 * ever contain it.
 */
const HOST_ID = "hse-overlay-root";

const getHost = () => {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    // The host must NOT create a stacking context of its own. `position:
    // relative` with any z-index (including 0) would do exactly that, and then
    // every overlay inside it — however high its own z-index — would be
    // painted at the host's level, which put modals *underneath* the mobile
    // navigation drawer. `display: contents` removes the box from layout and
    // from stacking entirely, so overlays compete on the root stacking context
    // where their z-index values actually mean something.
    host.style.display = "contents";
    document.body.appendChild(host);
  }
  return host;
};

const ModalPortal = ({ children, disabled = false }) => {
  const hostRef = useRef(null);
  if (!disabled && !hostRef.current && typeof document !== "undefined") {
    hostRef.current = getHost();
  }

  // Body scroll lock while any overlay is mounted. Reference-counted, because
  // overlays stack (a details modal can open a media viewer on top of it) and
  // the first one to unmount must not release the lock for the others.
  useEffect(() => {
    if (disabled || typeof document === "undefined") return undefined;
    const body = document.body;
    const depth = Number(body.dataset.overlayDepth || 0) + 1;
    body.dataset.overlayDepth = String(depth);
    body.classList.add("hse-overlay-open");

    return () => {
      const next = Number(body.dataset.overlayDepth || 1) - 1;
      if (next <= 0) {
        delete body.dataset.overlayDepth;
        body.classList.remove("hse-overlay-open");
      } else {
        body.dataset.overlayDepth = String(next);
      }
    };
  }, [disabled]);

  if (disabled || !hostRef.current) return children;
  return createPortal(children, hostRef.current);
};

export default ModalPortal;
