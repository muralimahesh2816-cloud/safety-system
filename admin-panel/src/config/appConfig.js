const isBrowser = typeof window !== "undefined";
const isLocalBrowser =
  isBrowser && ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);

const DEFAULT_API_BASE_URL =
  isBrowser && !isLocalBrowser
    ? "https://utpl-safety-backend.onrender.com/api/v1"
    : "http://localhost:5000/api/v1";

export const API_BASE_URL = process.env.REACT_APP_API_URL || DEFAULT_API_BASE_URL;

export const APP_NAME = process.env.REACT_APP_APP_NAME || "Safety Management System";
export const APP_TITLE = APP_NAME;
export const PORTAL_BRAND_NAME = APP_NAME;
export const ORGANIZATION_NAME =
  process.env.REACT_APP_ORGANIZATION_NAME || "Udupi Tollway Pvt. Ltd.";
export const APP_VERSION = process.env.REACT_APP_APP_VERSION || "0.1.0";
export const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "";

export const NAV_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "work", label: "Work Approvals" },
  { key: "hazards", label: "Hazards" },
  { key: "training", label: "Training" },
  { key: "users", label: "Users" },
  { key: "reports", label: "Reports" },
  { key: "health", label: "System Health" },
  { key: "settings", label: "Settings" }
];
