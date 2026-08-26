import { useEffect, useRef, useState } from "react";
import useReducedMotion from "../../hooks/useReducedMotion";

/**
 * The cinematic login environment: shield, orbiting safety icons, connection
 * paths and ambient depth.
 *
 * Built from layered CSS 3D transforms and inline SVG rather than WebGL. That
 * is a deliberate engineering choice, not a shortcut:
 *
 *  - **No new dependency.** Three.js + React Three Fiber + drei is roughly
 *    600 kB gzipped. This portal's entire main bundle is 157 kB, and a login
 *    screen is the one page a user on a site tablet waits on before they can do
 *    anything at all.
 *  - **No WebGL failure mode.** A WebGL scene needs a fallback for machines
 *    with blocked or unavailable GPUs — common on locked-down corporate
 *    desktops. There is nothing here to fall back *from*: it renders wherever
 *    CSS renders.
 *  - **Compositor-only.** Every animation is `transform` or `opacity`, so the
 *    scene runs on the GPU and never blocks the main thread — which matters
 *    because the authentication request is happening on that thread.
 *
 * Effects are tiered down automatically: `prefers-reduced-motion` stops all
 * motion, a low core count drops the particle layer, and the whole scene is
 * `aria-hidden` because it carries no information a screen reader needs.
 */

// Kept small on purpose — this is depth, not a particle demo.
const PARTICLE_COUNT = 14;
const ORBIT_ICONS = [
  { key: "incident", label: "Incident", angle: 268, radius: 46, delay: 0 },
  { key: "near-miss", label: "Near Miss", angle: 212, radius: 44, delay: 1.1 },
  { key: "ppe", label: "PPE", angle: 318, radius: 43, delay: 2.2 },
  { key: "inspection", label: "Inspection", angle: 12, radius: 45, delay: 3.3 },
  { key: "first-aid", label: "First Aid", angle: 52, radius: 43, delay: 4.4 },
  { key: "risk", label: "Risk Assessment", angle: 168, radius: 47, delay: 5.5 },
  { key: "permit", label: "Work Permit", angle: 140, radius: 45, delay: 6.6 },
  { key: "checklist", label: "Safety Checklist", angle: 92, radius: 44, delay: 7.7 }
];

const ICON_PATHS = {
  incident: "M12 3v10m0 4h.01M4.5 20h15a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0L2.8 17a2 2 0 0 0 1.7 3Z",
  "near-miss": "M12 9v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  ppe: "M4 15a8 8 0 0 1 16 0M2 15h20M8 15V8a4 4 0 0 1 8 0v7",
  inspection: "M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1ZM6 5h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 7 2 2 4-4",
  "first-aid": "M4 8h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm5 0V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-4 4v5m-2.5-2.5h5",
  risk: "m10.3 3.9-7.5 13a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01",
  permit: "M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13l2 2 4-4",
  checklist: "M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1ZM6 5h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm2.5 6.5 1.5 1.5 3-3m-4.5 7 1.5 1.5 3-3"
};

const isLowPowerDevice = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.hardwareConcurrency === "number" &&
  navigator.hardwareConcurrency > 0 &&
  navigator.hardwareConcurrency <= 4;

const Safety3DLoginScene = () => {
  const reduced = useReducedMotion();
  const sceneRef = useRef(null);
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    setLowPower(isLowPowerDevice());
  }, []);

  // Mouse parallax.
  //
  // Written straight to CSS custom properties inside a rAF, never to React
  // state: a pointer move that re-rendered the tree would re-render the login
  // form on every mouse event. Pointer-fine only, so it costs nothing on a
  // touch device.
  useEffect(() => {
    if (reduced || lowPower) return undefined;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;

    const node = sceneRef.current;
    if (!node) return undefined;

    let frame = null;
    let targetX = 0;
    let targetY = 0;

    const apply = () => {
      frame = null;
      node.style.setProperty("--parallax-x", targetX.toFixed(3));
      node.style.setProperty("--parallax-y", targetY.toFixed(3));
    };

    const onPointerMove = (event) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      if (frame === null) frame = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [reduced, lowPower]);

  const particles = lowPower || reduced ? [] : Array.from({ length: PARTICLE_COUNT });

  return (
    <div
      ref={sceneRef}
      className="safety-scene"
      data-testid="safety-login-scene"
      data-reduced={reduced ? "true" : "false"}
      data-low-power={lowPower ? "true" : "false"}
      // Pure decoration: everything it conveys is stated in the copy beside it.
      aria-hidden="true"
    >
      {/* Environment: night sky, ground plane, distant skyline, toll gantry */}
      <div className="safety-scene__sky" />
      <div className="safety-scene__skyline" />
      <div className="safety-scene__ground" />
      <div className="safety-scene__glow safety-scene__glow--blue" />
      <div className="safety-scene__glow safety-scene__glow--green" />

      {/* The composition sits in a 3D space so layers can hold real depth. */}
      <div className="safety-scene__stage">
        {/* Connection paths + travelling data points, behind the shield */}
        <svg className="safety-scene__paths" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="safety-path-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity=".55" />
              <stop offset="100%" stopColor="#4ade80" stopOpacity=".25" />
            </linearGradient>
          </defs>
          {ORBIT_ICONS.map((icon, index) => {
            const radians = (icon.angle * Math.PI) / 180;
            const x = 50 + Math.cos(radians) * icon.radius;
            const y = 50 + Math.sin(radians) * icon.radius * 0.72;
            return (
              <g key={icon.key}>
                <line
                  className="safety-scene__path"
                  x1="50"
                  y1="50"
                  x2={x}
                  y2={y}
                  stroke="url(#safety-path-gradient)"
                />
                {!reduced && !lowPower ? (
                  <circle
                    className="safety-scene__datum"
                    r="0.7"
                    style={{
                      // Travels the path from the icon toward the shield —
                      // "safety data flowing into the secure system".
                      offsetPath: `path("M ${x} ${y} L 50 50")`,
                      animationDelay: `${index * 0.9}s`
                    }}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>

        {/* Hero shield */}
        <div className="safety-shield">
          <div className="safety-shield__halo" />
          <div className="safety-shield__body">
            <svg viewBox="0 0 120 140" className="safety-shield__svg">
              <defs>
                <linearGradient id="shield-metal" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#cbd5e1" />
                  <stop offset="42%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#94a3b8" />
                </linearGradient>
                <linearGradient id="shield-face" x1="0" y1="0" x2="0.6" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" />
                  <stop offset="55%" stopColor="#132a63" />
                  <stop offset="100%" stopColor="#0b1a3f" />
                </linearGradient>
                <linearGradient id="shield-sheen" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity=".45" />
                  <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Metal rim */}
              <path
                d="M60 4 112 26v52c0 32-24 50-52 58C32 128 8 110 8 78V26Z"
                fill="url(#shield-metal)"
              />
              {/* Inner face */}
              <path
                d="M60 14 102 32v45c0 26-19 41-42 48-23-7-42-22-42-48V32Z"
                fill="url(#shield-face)"
              />
              {/* Human safety symbol */}
              <circle cx="60" cy="52" r="10" fill="#e2e8f0" />
              <path
                d="M42 68h36l-14 20v18h-8V88Z"
                fill="#e2e8f0"
              />
              {/* Safety green check */}
              <path
                d="M44 92l12 12 26-30"
                fill="none"
                stroke="#4ade80"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Specular sweep */}
              <path
                d="M60 14 102 32v45c0 26-19 41-42 48-23-7-42-22-42-48V32Z"
                fill="url(#shield-sheen)"
              />
            </svg>
          </div>
          <div className="safety-shield__base" />
        </div>

        {/* Orbiting safety icons */}
        <div className="safety-orbit">
          {ORBIT_ICONS.map((icon) => {
            const radians = (icon.angle * Math.PI) / 180;
            return (
              <div
                key={icon.key}
                className="safety-orbit__item"
                style={{
                  left: `${50 + Math.cos(radians) * icon.radius}%`,
                  top: `${50 + Math.sin(radians) * icon.radius * 0.72}%`,
                  animationDelay: `${icon.delay}s`
                }}
              >
                <span className="safety-orbit__chip">
                  <svg viewBox="0 0 24 24" className="safety-orbit__icon">
                    <path
                      d={ICON_PATHS[icon.key]}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="safety-orbit__label">{icon.label}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Foreground site equipment */}
        <div className="safety-props">
          <svg className="safety-props__helmet" viewBox="0 0 140 96">
            <defs>
              <linearGradient id="helmet-shell" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="45%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
            </defs>
            <ellipse cx="70" cy="86" rx="62" ry="8" fill="#000" opacity=".45" />
            <path d="M12 78a58 58 0 0 1 116 0Z" fill="url(#helmet-shell)" />
            <path d="M4 78h132a5 5 0 0 1-5 6H9a5 5 0 0 1-5-6Z" fill="#eab308" />
            <path d="M56 22a58 58 0 0 1 28 0l4 56H52Z" fill="#fde047" opacity=".55" />
            <path d="M34 40a46 46 0 0 1 26-16" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" />
          </svg>

          <svg className="safety-props__cone" viewBox="0 0 90 120">
            <ellipse cx="45" cy="112" rx="40" ry="7" fill="#000" opacity=".45" />
            <path d="M45 8 72 104H18Z" fill="#f97316" />
            <path d="M45 8 58 104H45Z" fill="#c2410c" opacity=".5" />
            <path d="M31 62h28l3 12H28Z" fill="#f8fafc" />
            <path d="M25 84h40l3 12H22Z" fill="#f8fafc" />
            <rect x="8" y="100" width="74" height="14" rx="5" fill="#ea580c" />
          </svg>

          <div className="safety-props__barrier" />
        </div>

        {/* Ambient particles */}
        {particles.length ? (
          <div className="safety-scene__particles">
            {particles.map((_, index) => (
              <span
                key={index}
                className="safety-scene__particle"
                style={{
                  left: `${(index * 37) % 100}%`,
                  animationDuration: `${18 + ((index * 7) % 14)}s`,
                  animationDelay: `${(index * 1.7) % 12}s`,
                  opacity: 0.1 + ((index % 5) * 0.05)
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Safety3DLoginScene;
