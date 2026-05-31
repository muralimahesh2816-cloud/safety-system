import { MoonStar, SunMedium } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "../../hooks/useTheme";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative h-10 w-20 rounded-full border border-white/20 bg-white/10 px-1"
      aria-label="Toggle theme"
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="absolute top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-900"
        style={{ left: theme === "dark" ? "4px" : "44px" }}
      >
        {theme === "dark" ? <MoonStar size={15} /> : <SunMedium size={15} />}
      </motion.span>
    </button>
  );
};

export default ThemeToggle;
