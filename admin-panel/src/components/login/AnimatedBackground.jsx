import { motion } from "framer-motion";

const AnimatedBackground = ({ active = false }) => (
  <div className="absolute inset-0 overflow-hidden bg-[#050b14]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(14,165,233,.22),transparent_28%),radial-gradient(circle_at_76%_24%,rgba(249,115,22,.2),transparent_24%),linear-gradient(120deg,rgba(2,6,23,.45),rgba(15,23,42,.92))]" />
    <motion.div
      className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent"
      animate={{ opacity: active ? [0.25, 0.8, 0.25] : [0.12, 0.34, 0.12], y: active ? [-10, 12, -10] : [-4, 4, -4] }}
      transition={{ duration: active ? 2.2 : 5, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute left-[-12%] top-[18%] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
      animate={{ x: active ? [0, 80, 0] : [0, 40, 0], opacity: active ? 0.55 : 0.3 }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute bottom-[-16%] right-[10%] h-80 w-80 rounded-full bg-orange-400/10 blur-3xl"
      animate={{ scale: active ? [1, 1.24, 1] : [1, 1.08, 1], opacity: active ? 0.62 : 0.28 }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    />
    <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.45)_1px,transparent_1px)] [background-size:54px_54px]" />
  </div>
);

export default AnimatedBackground;
