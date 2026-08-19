import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * "Safety reality" 3D scene for the login page.
 *
 * Represents the portal's operating context — a highway / toll-plaza safety
 * zone — as a small set of layered planes inside a CSS 3D (preserve-3d)
 * rig: a boom-barrier gate (controlled, safe passage), a rotating HSE
 * shield medallion, and a chainage marker chip. The whole rig tilts gently
 * with the pointer for parallax depth; nothing here is interactive or
 * conveys information, so it stays out of the accessibility tree
 * (aria-hidden) and the sign-in form beside it is unaffected.
 *
 * Approach: CSS 3D transforms only (perspective + translateZ layers),
 * no 3D engine/dependency. `prefers-reduced-motion` disables the pointer
 * parallax, the idle drift, and the shield spin in favor of a single
 * static, elegantly-angled frame.
 */
const SafetyRealityScene = ({ className = "" }) => {
  const prefersReducedMotion = useReducedMotion();
  const rigRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const node = rigRef.current;
    if (!node) return undefined;

    const handlePointerMove = (event) => {
      const bounds = node.parentElement.getBoundingClientRect();
      const relativeX = (event.clientX - bounds.left) / bounds.width;
      const relativeY = (event.clientY - bounds.top) / bounds.height;
      const clamp = (value) => Math.max(-1, Math.min(1, value));
      setTilt({
        x: clamp((relativeY - 0.5) * -2),
        y: clamp((relativeX - 0.5) * 2)
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [prefersReducedMotion]);

  const rigStyle = prefersReducedMotion
    ? { transform: "rotateX(6deg) rotateY(-16deg)" }
    : { transform: `rotateX(${6 + tilt.x * 5}deg) rotateY(${-16 + tilt.y * 8}deg)` };

  return (
    <div
      className={`reality-scene ${className}`}
      aria-hidden="true"
      role="presentation"
    >
      <div
        ref={rigRef}
        className="reality-scene__rig"
        style={{ ...rigStyle, transition: prefersReducedMotion ? "none" : "transform 260ms ease-out" }}
      >
        {/* Backmost plane: soft hazard-beacon glow */}
        <div className="reality-scene__plane reality-scene__glow" style={{ transform: "translateZ(-160px)" }} />

        {/* Road-marking chevrons, receding into the background */}
        <div className="reality-scene__plane reality-scene__chevrons" style={{ transform: "translateZ(-90px) translateY(60px)" }}>
          <svg width="420" height="160" viewBox="0 0 420 160" fill="none">
            <g opacity="0.5" stroke="#f0a69b" strokeWidth="6" strokeLinecap="round">
              <path d="M10 130 L60 90 L110 130" />
              <path d="M90 140 L140 96 L190 140" />
              <path d="M170 150 L220 102 L270 150" />
              <path d="M250 150 L300 102 L350 150" />
            </g>
          </svg>
        </div>

        {/* Rotating HSE shield medallion */}
        <motion.div
          className="reality-scene__plane reality-scene__shield"
          style={{ z: 10, transformStyle: "preserve-3d" }}
          animate={prefersReducedMotion ? undefined : { rotateY: [0, 360] }}
          transition={prefersReducedMotion ? undefined : { duration: 16, repeat: Infinity, ease: "linear" }}
        >
          <svg width="180" height="180" viewBox="0 0 72 72" fill="none">
            <defs>
              <linearGradient id="realityShield" x1="10" y1="8" x2="62" y2="66">
                <stop stopColor="#b82510" />
                <stop offset="0.55" stopColor="#9b1400" />
                <stop offset="1" stopColor="#b67352" />
              </linearGradient>
            </defs>
            <path
              d="M36 5 60 14v18c0 16.6-9.5 28.3-24 35C21.5 60.3 12 48.6 12 32V14L36 5Z"
              fill="#151719"
              stroke="url(#realityShield)"
              strokeWidth="3"
            />
            <path d="M24 37l7 7 17-20" stroke="url(#realityShield)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>

        {/* Boom-barrier gate — a controlled, raised "safe to proceed" arm */}
        <div
          className="reality-scene__plane reality-scene__barrier"
          style={{ transform: "translateZ(70px) translateX(-30px) translateY(30px) rotate(-22deg)" }}
        >
          <div className="reality-scene__barrier-post" />
          <div className="reality-scene__barrier-arm">
            <span />
          </div>
        </div>

        {/* Foreground chainage marker chip */}
        <div className="reality-scene__plane reality-scene__chip" style={{ transform: "translateZ(140px) translateX(70px) translateY(150px)" }}>
          <span className="reality-scene__chip-dot" />
          NH · Safety Zone Active
        </div>
      </div>
    </div>
  );
};

export default SafetyRealityScene;
