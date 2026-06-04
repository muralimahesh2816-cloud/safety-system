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
  title = "Please uploading...",
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

export const showValidationPopup = async (text = "Please fill all required fields.") => {
  const Swal = await ensureSweetAlert();
  if (!Swal) {
    window.alert(text);
    return;
  }

  await Swal.fire({
    icon: "warning",
    title: "Please fill required fields",
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
