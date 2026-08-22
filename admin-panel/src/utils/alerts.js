// Portal dialog engine.
//
// This used to pull SweetAlert2 from a public CDN on first use, which meant
// every first submission of a session waited on a third-party network round
// trip, and any environment that blocks the CDN silently degraded to
// `window.alert`/`window.confirm`. Both are unacceptable for a production HSE
// portal, so the six dialogs the app actually uses are implemented here
// directly against the DOM.
//
// The exported API and return contracts are unchanged, so every existing call
// site keeps working:
//   showSuccessPopup(title, text)        -> Promise<void>   (auto-dismisses)
//   showLoadingPopup(title, text)        -> Promise<void>   (stays open)
//   closeLoadingPopup()                  -> Promise<void>
//   showValidationPopup(text, title)     -> Promise<void>
//   showConfirmPopup({...})              -> Promise<boolean>
//   showNumberInputPopup({...})          -> Promise<number|null>
//
// It is deliberately framework-free (no React root of its own) so it can be
// called from services, utils and event handlers alike.

const ROOT_ID = "hse-dialog-root";
const SUCCESS_TIMER_MS = 2600;

let activeDialog = null;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getRoot = () => {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
};

const ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
  question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Tears down whatever dialog is currently mounted. */
const dismiss = (result) => {
  if (!activeDialog) return;
  const { overlay, resolve, previousFocus, keyHandler, timer } = activeDialog;
  activeDialog = null;

  if (timer) window.clearTimeout(timer);
  document.removeEventListener("keydown", keyHandler, true);
  overlay.dataset.state = "closing";

  const remove = () => {
    overlay.remove();
    if (!document.getElementById(ROOT_ID)?.childElementCount) {
      document.body.classList.remove("hse-dialog-open");
    }
    previousFocus?.focus?.();
    resolve(result);
  };

  if (prefersReducedMotion()) remove();
  else window.setTimeout(remove, 160);
};

/**
 * Mounts a dialog and returns a promise that settles when it closes.
 * `build` receives the panel element and may wire up its own controls.
 */
const present = ({
  icon,
  title,
  text,
  buttons = [],
  input = null,
  loading = false,
  dismissible = true,
  autoCloseMs = 0
}) =>
  new Promise((resolve) => {
    // Only one dialog at a time — a new one supersedes whatever is showing
    // (this is what lets a success popup replace an open loading popup).
    if (activeDialog) dismiss(activeDialog.defaultResult);

    const overlay = document.createElement("div");
    overlay.className = "hse-dialog-overlay";
    overlay.dataset.state = "open";
    if (prefersReducedMotion()) overlay.dataset.reducedMotion = "true";

    const titleId = `hse-dialog-title-${Date.now()}`;
    const iconMarkup = icon && ICONS[icon] ? `<span class="hse-dialog__icon hse-dialog__icon--${icon}">${ICONS[icon]}</span>` : "";
    const loadingMarkup = loading ? '<span class="hse-dialog__spinner" role="status" aria-label="Working"></span>' : "";
    const textMarkup = text ? `<p class="hse-dialog__text">${escapeHtml(text)}</p>` : "";
    const inputMarkup = input
      ? `<label class="hse-dialog__field"><span>${escapeHtml(input.label || "")}</span>
           <input class="hse-dialog__input" type="${input.type || "text"}"
             ${input.min !== undefined ? `min="${input.min}"` : ""}
             ${input.max !== undefined ? `max="${input.max}"` : ""}
             step="${input.step || "1"}" inputmode="numeric" />
         </label>
         <p class="hse-dialog__error" role="alert" hidden></p>`
      : "";
    const buttonsMarkup = buttons.length
      ? `<div class="hse-dialog__actions">${buttons
          .map(
            (button, index) =>
              `<button type="button" class="hse-dialog__button hse-dialog__button--${button.tone || "secondary"}" data-index="${index}">${escapeHtml(button.label)}</button>`
          )
          .join("")}</div>`
      : "";
    const timerMarkup = autoCloseMs ? '<span class="hse-dialog__timer"></span>' : "";

    overlay.innerHTML = `
      <div class="hse-dialog" role="${input || buttons.length ? "alertdialog" : "alert"}" aria-modal="true" aria-labelledby="${titleId}">
        ${timerMarkup}
        ${iconMarkup}${loadingMarkup}
        <h2 class="hse-dialog__title" id="${titleId}">${escapeHtml(title)}</h2>
        ${textMarkup}
        ${inputMarkup}
        ${buttonsMarkup}
      </div>`;

    const keyHandler = (event) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        dismiss(activeDialog?.defaultResult);
        return;
      }
      if (event.key !== "Tab") return;
      // Keep focus inside the dialog.
      const focusable = overlay.querySelectorAll("button, input");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    activeDialog = {
      overlay,
      resolve,
      previousFocus: document.activeElement,
      keyHandler,
      defaultResult: input ? null : buttons.length ? false : undefined,
      timer: null
    };

    if (dismissible) {
      overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) dismiss(activeDialog?.defaultResult);
      });
    }

    const errorNode = overlay.querySelector(".hse-dialog__error");
    const inputNode = overlay.querySelector(".hse-dialog__input");

    overlay.querySelectorAll(".hse-dialog__button").forEach((node) => {
      node.addEventListener("click", () => {
        const button = buttons[Number(node.dataset.index)];
        if (button.validate) {
          const problem = button.validate(inputNode ? inputNode.value : undefined);
          if (problem) {
            if (errorNode) {
              errorNode.textContent = problem;
              errorNode.hidden = false;
            }
            inputNode?.focus();
            return;
          }
        }
        dismiss(button.resolveWith ? button.resolveWith(inputNode ? inputNode.value : undefined) : button.value);
      });
    });

    if (inputNode) {
      inputNode.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        overlay.querySelector(".hse-dialog__button--primary")?.click();
      });
    }

    document.body.classList.add("hse-dialog-open");
    getRoot().appendChild(overlay);
    (inputNode || overlay.querySelector(".hse-dialog__button--primary") || overlay.querySelector(".hse-dialog__button"))?.focus();

    if (autoCloseMs) {
      const bar = overlay.querySelector(".hse-dialog__timer");
      if (bar) bar.style.animationDuration = `${autoCloseMs}ms`;
      activeDialog.timer = window.setTimeout(() => dismiss(undefined), autoCloseMs);
    }
  });

export const showSuccessPopup = async (title, text = "") =>
  present({ icon: "success", title, text, autoCloseMs: SUCCESS_TIMER_MS });

export const showLoadingPopup = async (
  title = "Uploading Please Wait...",
  text = "Please wait while your request is being processed."
) => {
  // Resolves immediately: callers `await` it only to guarantee the dialog is
  // mounted before the long operation starts, then call closeLoadingPopup().
  present({ title, text, loading: true, dismissible: false });
  return undefined;
};

export const closeLoadingPopup = async () => {
  dismiss(undefined);
};

export const showValidationPopup = async (
  text = "Please fill all required fields.",
  title = "Please fill required fields"
) =>
  present({
    icon: "warning",
    title,
    text,
    buttons: [{ label: "OK", tone: "primary", value: undefined }]
  });

/** Professional failure state — icon, plain reason, and a retry affordance. */
export const showErrorPopup = async (
  text = "Something went wrong. Please try again.",
  title = "Unable to complete",
  { retryText = "Try Again", cancelText = "Close" } = {}
) =>
  present({
    icon: "error",
    title,
    text,
    buttons: [
      { label: cancelText, tone: "secondary", value: false },
      { label: retryText, tone: "primary", value: true }
    ]
  });

export const showConfirmPopup = async ({
  title = "Are you sure?",
  text = "",
  confirmText = "Yes",
  cancelText = "Cancel",
  icon = "warning"
} = {}) => {
  const result = await present({
    icon,
    title,
    text,
    buttons: [
      { label: cancelText, tone: "secondary", value: false },
      { label: confirmText, tone: "primary", value: true }
    ]
  });
  return Boolean(result);
};

/**
 * A single-number-input prompt, e.g. for recording an assessment score.
 * Returns the entered number, or null if the user cancelled.
 */
export const showNumberInputPopup = async ({
  title = "Enter a value",
  text = "",
  inputLabel = "",
  min = 0,
  max = 100,
  confirmText = "Save"
} = {}) => {
  const result = await present({
    icon: "question",
    title,
    text,
    input: { type: "number", label: inputLabel, min, max, step: "1" },
    buttons: [
      { label: "Cancel", tone: "secondary", value: null },
      {
        label: confirmText,
        tone: "primary",
        validate: (value) => {
          if (value === "" || value === null || value === undefined) return "A score is required";
          const numeric = Number(value);
          if (Number.isNaN(numeric) || numeric < min || numeric > max) {
            return `Enter a number between ${min} and ${max}`;
          }
          return null;
        },
        resolveWith: (value) => Number(value)
      }
    ]
  });
  return result === null || result === undefined ? null : result;
};
