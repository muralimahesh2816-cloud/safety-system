import { motion } from "framer-motion";
import { classNames } from "../../utils/format";

const GlassCard = ({ children, className = "", hover = true, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    whileHover={hover ? { y: -4, scale: 1.005 } : undefined}
    className={classNames(
      "brand-glass-card rounded-3xl border border-white/15 bg-white/6 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
      className
    )}
  >
    {children}
  </motion.div>
);

export default GlassCard;
