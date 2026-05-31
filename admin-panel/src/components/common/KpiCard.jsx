import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import GlassCard from "./GlassCard";

const AnimatedValue = ({ value }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const safeValue = Number(value || 0);
    let current = 0;
    const step = Math.max(1, Math.floor(safeValue / 30));
    const timer = setInterval(() => {
      current += step;
      if (current >= safeValue) {
        setDisplay(safeValue);
        clearInterval(timer);
      } else {
        setDisplay(current);
      }
    }, 18);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
};

const KpiCard = ({ title, value, hint, tone = "teal", delay = 0 }) => (
  <GlassCard className="p-5 relative overflow-hidden" delay={delay}>
    <div className={`absolute -right-12 -top-12 h-28 w-28 rounded-full blur-3xl ${tone}`} />
    <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{title}</p>
    <motion.h3
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3, delay: delay + 0.1 }}
      className="mt-2 text-3xl font-display font-semibold text-white"
    >
      <AnimatedValue value={value} />
    </motion.h3>
    {hint ? <p className="mt-1 text-xs text-slate-300/80">{hint}</p> : null}
  </GlassCard>
);

export default KpiCard;
