import { motion } from "framer-motion";
import { Construction, HardHat, ShieldCheck, TrafficCone, TriangleAlert } from "lucide-react";

const floatingItems = [
  { Icon: HardHat, className: "left-[7%] top-[13%]", size: 88, color: "text-amber-300", delay: 0 },
  { Icon: ShieldCheck, className: "right-[8%] top-[12%]", size: 104, color: "text-teal-300", delay: 0.8 },
  { Icon: TrafficCone, className: "bottom-[10%] left-[11%]", size: 82, color: "text-orange-300", delay: 1.5 },
  { Icon: Construction, className: "bottom-[13%] right-[10%]", size: 90, color: "text-cyan-300", delay: 2.1 },
  { Icon: TriangleAlert, className: "left-[46%] top-[8%] hidden md:block", size: 54, color: "text-yellow-200", delay: 1.1 }
];

const AnimatedLoginBackground = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(245,158,11,.15),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,.17),transparent_30%),radial-gradient(circle_at_50%_85%,rgba(14,165,233,.14),transparent_34%),linear-gradient(145deg,#020617_0%,#07111f_52%,#020617_100%)]" />
    <motion.div
      className="absolute -left-[20%] top-[28%] h-16 w-[140%] rotate-[-8deg] border-y border-amber-300/20 bg-gradient-to-r from-transparent via-amber-300/[0.08] to-transparent"
      animate={{ x: ["-8%", "8%", "-8%"], opacity: [0.25, 0.7, 0.25] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute -left-[20%] bottom-[24%] h-12 w-[140%] rotate-[7deg] border-y border-cyan-300/15 bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent"
      animate={{ x: ["9%", "-7%", "9%"], opacity: [0.25, 0.6, 0.25] }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
    />

    <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.06)_1px,transparent_1px)] [background-size:58px_58px] [mask-image:linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)]" />

    {floatingItems.map(({ Icon, className, size, color, delay }, index) => (
      <motion.div
        key={`${Icon.displayName || Icon.name}-${index}`}
        className={`absolute ${className} ${color} opacity-20 drop-shadow-[0_0_30px_currentColor]`}
        initial={{ opacity: 0, y: 20, rotateY: -20 }}
        animate={{
          opacity: [0.12, 0.3, 0.12],
          y: [0, -18, 0],
          rotateZ: [-4, 4, -4],
          rotateY: [-12, 12, -12]
        }}
        transition={{ duration: 7 + index, delay, repeat: Infinity, ease: "easeInOut" }}
        style={{ perspective: 900 }}
      >
        <Icon size={size} strokeWidth={1.25} />
      </motion.div>
    ))}

    {Array.from({ length: 18 }).map((_, index) => (
      <motion.span
        key={index}
        className="absolute h-1 w-1 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,.9)]"
        style={{ left: `${6 + ((index * 17) % 90)}%`, top: `${8 + ((index * 29) % 84)}%` }}
        animate={{ opacity: [0.08, 0.8, 0.08], scale: [0.7, 1.7, 0.7], y: [0, -24, 0] }}
        transition={{ duration: 4 + (index % 5), delay: index * 0.16, repeat: Infinity, ease: "easeInOut" }}
      />
    ))}

    <motion.div
      className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/10"
      animate={{ rotate: 360, scale: [0.94, 1.05, 0.94] }}
      transition={{ rotate: { duration: 40, repeat: Infinity, ease: "linear" }, scale: { duration: 8, repeat: Infinity } }}
    >
      <div className="absolute left-1/2 top-0 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,.9)]" />
      <div className="absolute bottom-8 right-8 h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_18px_rgba(94,234,212,.9)]" />
    </motion.div>
  </div>
);

export default AnimatedLoginBackground;
