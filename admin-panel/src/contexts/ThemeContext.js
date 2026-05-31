import { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "theme";
const LEGACY_THEME_KEY = "hse_theme";

const ThemeContext = createContext(null);

const resolveTheme = (value) => {
  if (value === "dark" || value === "light") return value;
  return "dark";
};

const getInitialTheme = () => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) {
    const initial = resolveTheme(stored);
    document.documentElement.classList.toggle("dark", initial === "dark");
    document.documentElement.classList.toggle("light", initial === "light");
    return initial;
  }

  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy) {
    const normalized = resolveTheme(legacy);
    localStorage.setItem(THEME_KEY, normalized);
    document.documentElement.classList.toggle("dark", normalized === "dark");
    document.documentElement.classList.toggle("light", normalized === "light");
    return normalized;
  }

  document.documentElement.classList.add("dark");
  document.documentElement.classList.remove("light");
  return "dark";
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    localStorage.removeItem(LEGACY_THEME_KEY);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used inside ThemeProvider");
  }
  return context;
};
