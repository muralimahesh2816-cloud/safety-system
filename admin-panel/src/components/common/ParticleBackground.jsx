import { useMemo } from "react";
import useReducedMotion from "../../hooks/useReducedMotion";

// Ambient depth behind the app shell. The two gradient layers are static and
// essentially free; only the drifting dots animate, and they are dropped
// entirely under `prefers-reduced-motion` or on a device that reports few
// logical cores (a proxy for low-end hardware, where 20+ permanently animating
// composited layers is a real cost against the rest of the UI).
const PARTICLE_COUNT = 12;

const isLowPowerDevice = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.hardwareConcurrency === "number" &&
  navigator.hardwareConcurrency > 0 &&
  navigator.hardwareConcurrency <= 4;

const ParticleBackground = () => {
  const reduced = useReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map((_, index) => ({
        id: index,
        left: Math.random() * 100,
        size: Math.random() * 4 + 2,
        duration: Math.random() * 24 + 14,
        delay: Math.random() * 12,
        opacity: Math.random() * 0.28 + 0.08
      })),
    []
  );

  const showParticles = !reduced && !isLowPowerDevice();

  return (
    <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-premium-grid opacity-25" />
      <div className="absolute inset-0 bg-premium-radial opacity-80" />
      {showParticles
        ? particles.map((particle) => (
            <span
              key={particle.id}
              className="particle-dot"
              style={{
                left: `${particle.left}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`,
                opacity: particle.opacity
              }}
            />
          ))
        : null}
    </div>
  );
};

export default ParticleBackground;
