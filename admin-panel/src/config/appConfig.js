export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api/v1";

export const APP_TITLE = "Enterprise Safety HSE Management";

export const NAV_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "work", label: "Work Approvals" },
  { key: "hazards", label: "Hazards" },
  { key: "training", label: "Training" },
  { key: "users", label: "Users" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" }
];
