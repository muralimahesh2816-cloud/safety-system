import { useEffect, useState } from "react";

export const SIDEBAR_LOCK_KEY = "safety.sidebar.locked";

const readInitialPreference = () => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(SIDEBAR_LOCK_KEY);
  if (stored !== null) return stored === "true";
  return localStorage.getItem("sidebarCollapsed") === "false";
};

export default function useSidebarPreference() {
  const [sidebarLocked, setSidebarLocked] = useState(readInitialPreference);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_LOCK_KEY, String(sidebarLocked));
  }, [sidebarLocked]);

  return { sidebarLocked, setSidebarLocked };
}
