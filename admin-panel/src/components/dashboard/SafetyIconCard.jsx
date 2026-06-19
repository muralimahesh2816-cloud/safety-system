import { motion } from "framer-motion";

const SafetyIconCard = ({ icon: Icon, accent = "text-cyan-200", className = "" }) => (
  <motion.div
    whileHover={{ rotate: -5, scale: 1.08 }}
    className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_12px_28px_rgba(0,0,0,.22)] backdrop-blur-xl ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
    <Icon className={`relative z-10 ${accent}`} size={23} strokeWidth={1.8} />
  </motion.div>
);

export default SafetyIconCard;
