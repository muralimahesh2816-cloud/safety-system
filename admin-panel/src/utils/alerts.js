const SWEETALERT_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js";
const SWEETALERT_STYLE_URL =
  "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css";

let swalLoader = null;

const ensureSweetAlert = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Swal) return Promise.resolve(window.Swal);
  if (swalLoader) return swalLoader;

  swalLoader = new Promise((resolve) => {
    const existingScript = document.querySelector("script[data-hse-swal='true']");
    const existingStyle = document.querySelector("link[data-hse-swal='true']");

    if (!existingStyle) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = SWEETALERT_STYLE_URL;
      style.setAttribute("data-hse-swal", "true");
      document.head.appendChild(style);
    }

    const done = () => resolve(window.Swal || null);

    if (existingScript) {
      existingScript.addEventListener("load", done, { once: true });
      existingScript.addEventListener("error", done, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SWEETALERT_SCRIPT_URL;
    script.async = true;
    script.setAttribute("data-hse-swal", "true");
    script.onload = done;
    script.onerror = done;
    document.body.appendChild(script);
  });

  return swalLoader;
};

export const showSuccessPopup = async (title, text = "") => {
  const Swal = await ensureSweetAlert();
  if (!Swal) {
    window.alert(`${title}${text ? `\n${text}` : ""}`);
    return;
  }

  await Swal.fire({
    icon: "success",
    title,
    text,
    timer: 3000,
    timerProgressBar: true,
    showConfirmButton: false,
    backdrop: "rgba(2, 6, 23, 0.72)",
    customClass: {
      popup: "hse-swal-popup",
      title: "hse-swal-title",
      htmlContainer: "hse-swal-text",
      timerProgressBar: "hse-swal-timer"
    },
    showClass: {
      popup: "hse-swal-show"
    },
    hideClass: {
      popup: "hse-swal-hide"
    }
  });
};

export const showLoadingPopup = async (
  title = "Uploading Please Wait...",
  text = "Please wait while your request is being processed."
) => {
  const Swal = await ensureSweetAlert();
  if (!Swal) return;

  Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    backdrop: "rgba(2, 6, 23, 0.72)",
    customClass: {
      popup: "hse-swal-popup",
      title: "hse-swal-title",
      htmlContainer: "hse-swal-text"
    },
    showClass: {
      popup: "hse-swal-show"
    },
    hideClass: {
      popup: "hse-swal-hide"
    },
    didOpen: () => {
      Swal.showLoading();
    }
  });
};

export const closeLoadingPopup = async () => {
  const Swal = await ensureSweetAlert();
  if (Swal?.isVisible()) Swal.close();
};

export const showValidationPopup = async (
  text = "Please fill all required fields.",
  title = "Please fill required fields"
) => {
  const Swal = await ensureSweetAlert();
  if (!Swal) {
    window.alert(`${title}\n${text}`);
    return;
  }

  await Swal.fire({
    icon: "warning",
    title,
    text,
    confirmButtonText: "OK",
    backdrop: "rgba(2, 6, 23, 0.72)",
    customClass: {
      popup: "hse-swal-popup",
      title: "hse-swal-title",
      htmlContainer: "hse-swal-text"
    },
    showClass: {
      popup: "hse-swal-show"
    },
    hideClass: {
      popup: "hse-swal-hide"
    }
  });
};

export const showConfirmPopup = async ({
  title = "Are you sure?",
  text = "",
  confirmText = "Yes",
  cancelText = "Cancel",
  icon = "warning"
} = {}) => {
  const Swal = await ensureSweetAlert();
  if (!Swal) {
    return window.confirm(`${title}${text ? `\n${text}` : ""}`);
  }

  const result = await Swal.fire({
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    backdrop: "rgba(2, 6, 23, 0.72)",
    customClass: {
      popup: "hse-swal-popup",
      title: "hse-swal-title",
      htmlContainer: "hse-swal-text"
    },
    showClass: {
      popup: "hse-swal-show"
    },
    hideClass: {
      popup: "hse-swal-hide"
    }
  });

  return Boolean(result.isConfirmed);
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
  const Swal = await ensureSweetAlert();
  if (!Swal) {
    const raw = window.prompt(`${title}${text ? `\n${text}` : ""}`);
    if (raw === null || raw.trim() === "") return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const result = await Swal.fire({
    icon: "question",
    title,
    text,
    input: "number",
    inputLabel,
    inputAttributes: { min, max, step: "1" },
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    reverseButtons: true,
    backdrop: "rgba(2, 6, 23, 0.72)",
    customClass: {
      popup: "hse-swal-popup",
      title: "hse-swal-title",
      htmlContainer: "hse-swal-text"
    },
    showClass: { popup: "hse-swal-show" },
    hideClass: { popup: "hse-swal-hide" },
    inputValidator: (value) => {
      if (value === "" || value === null || value === undefined) return "A score is required";
      const numeric = Number(value);
      if (Number.isNaN(numeric) || numeric < min || numeric > max) return `Enter a number between ${min} and ${max}`;
      return null;
    }
  });

  if (!result.isConfirmed) return null;
  return Number(result.value);
};
