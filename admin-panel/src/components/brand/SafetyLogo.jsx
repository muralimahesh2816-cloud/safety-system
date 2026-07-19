import { motion } from "framer-motion";
import { APP_NAME } from "../../config/appConfig";

const SafetyLogo = ({ compact = false, className = "" }) => (
  <div className={`relative inline-flex items-center gap-3 ${className}`}>
    <motion.svg
      width={compact ? 46 : 62}
      height={compact ? 46 : 62}
      viewBox="0 0 72 72"
      fill="none"
      role="img"
      aria-label={APP_NAME}
      className="drop-shadow-[0_0_22px_rgba(45,212,191,0.42)]"
    >
      <defs>
        <linearGradient id="hseShield" x1="10" y1="8" x2="62" y2="66">
          <stop stopColor="#5eead4" />
          <stop offset="0.55" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#facc15" />
        </linearGradient>
        <linearGradient id="hseShine" x1="0" x2="1">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.75" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M36 5 60 14v18c0 16.6-9.5 28.3-24 35C21.5 60.3 12 48.6 12 32V14L36 5Z"
        fill="#020617"
        stroke="url(#hseShield)"
        strokeWidth="3"
      />
      <path d="M24 37l7 7 17-20" stroke="url(#hseShield)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <motion.rect
        x="-20"
        y="8"
        width="18"
        height="58"
        fill="url(#hseShine)"
        transform="rotate(24)"
        animate={{ x: [0, 90] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <text x="36" y="59" textAnchor="middle" fill="#e0f2fe" fontSize="10" fontWeight="800">HSE</text>
    </motion.svg>
    {!compact ? (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-teal-200">Enterprise Portal</p>
        <p className="font-display text-lg font-semibold leading-tight text-white">{APP_NAME}</p>
      </div>
    ) : null}
  </div>
);

export default SafetyLogo;
