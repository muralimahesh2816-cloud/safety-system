import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import SafetyIconCard from "./SafetyIconCard";

const AnimatedNumber = ({ value }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Number(value || 0));
    const startedAt = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / 650);
      setDisplay(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return display.toLocaleString();
};

const KPIBox = ({ title, value, icon: Icon, backgroundIcon: BackgroundIcon = Icon, gradient, accent, delay = 0, hint }) => (
  <motion.article
    initial={{ opacity: 0, y: 18, rotateX: -7 }}
    animate={{ opacity: 1, y: 0, rotateX: 0 }}
    transition={{ duration: 0.38, delay }}
    whileHover={{ y: -7, rotateX: 3, rotateY: -2, scale: 1.015 }}
    className={`group relative min-h-40 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br ${gradient} p-5 shadow-[0_22px_55px_rgba(0,0,0,.26)] [transform-style:preserve-3d]`}
  >
    <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]" />
    <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/10 blur-3xl transition duration-500 group-hover:scale-125" />
    <BackgroundIcon className={`absolute -bottom-6 -right-4 h-32 w-32 ${accent} opacity-[0.08] transition duration-500 group-hover:rotate-[-7deg] group-hover:scale-110`} strokeWidth={1} />
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

    <div className="relative z-10 flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">{title}</p>
        <p className="mt-3 font-display text-4xl font-bold text-white drop-shadow-lg"><AnimatedNumber value={value} /></p>
        {hint ? <p className="mt-2 text-xs text-slate-300">{hint}</p> : null}
      </div>
      <SafetyIconCard icon={Icon} accent={accent} />
    </div>
  </motion.article>
);

export default KPIBox;
