import { motion } from "framer-motion";
import { HardHat } from "lucide-react";

const LoadingOverlay = ({ visible = false, label = "Initializing secure safety environment" }) => {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]"
    >
      <div className="rounded-3xl border border-cyan-200/20 bg-slate-950/70 px-6 py-5 text-center shadow-[0_0_50px_rgba(14,165,233,.18)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-orange-300/40 bg-orange-400/10 text-orange-200"
        >
          <HardHat size={26} />
        </motion.div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">{label}</p>
        <div className="mt-4 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-orange-400"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default LoadingOverlay;
