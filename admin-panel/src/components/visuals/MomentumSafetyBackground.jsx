import { motion } from "framer-motion";

const particles = Array.from({ length: 26 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  delay: (index % 9) * 0.45,
  size: 2 + (index % 4)
}));

const MomentumSafetyBackground = ({ intensity = "normal" }) => {
  const low = intensity === "low";
  return (
    <div className="momentum-safety-bg pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(20,184,166,.23),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(14,165,233,.2),transparent_36%),linear-gradient(135deg,#020617,#06111f_48%,#031b1c)]" />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/15"
        animate={{ rotate: 360, scale: [1, 1.04, 1] }}
        transition={{ rotate: { duration: 36, repeat: Infinity, ease: "linear" }, scale: { duration: 6, repeat: Infinity } }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-300/20"
        animate={{ rotate: -360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />
      <motion.svg
        viewBox="0 0 260 260"
        className="absolute right-[7%] top-[14%] h-64 w-64 opacity-20 blur-[.2px]"
        animate={{ y: [0, -18, 0], rotateY: [0, 18, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <linearGradient id="momentumShield" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#5eead4" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <path d="M130 18 218 51v67c0 58-34 99-88 124-54-25-88-66-88-124V51l88-33Z" fill="none" stroke="url(#momentumShield)" strokeWidth="8" />
        <path d="m91 132 28 29 58-72" fill="none" stroke="url(#momentumShield)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
      <div className="absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(120deg,transparent,rgba(45,212,191,.12),transparent)] momentum-wave" />
      {particles.map((particle, index) => (
        <span
          key={index}
          className="momentum-particle"
          style={{
            left: particle.left,
            width: particle.size,
            height: particle.size,
            animationDelay: `${particle.delay}s`,
            opacity: low ? 0.24 : 0.46
          }}
        />
      ))}
      <div className="absolute inset-0 backdrop-blur-[1px]" />
    </div>
  );
};

export default MomentumSafetyBackground;
