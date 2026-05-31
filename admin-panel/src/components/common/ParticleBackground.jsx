import { useMemo } from "react";

const ParticleBackground = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, index) => ({
        id: index,
        left: Math.random() * 100,
        size: Math.random() * 5 + 2,
        duration: Math.random() * 24 + 10,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.35 + 0.1
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      <div className="absolute inset-0 bg-premium-grid opacity-25" />
      <div className="absolute inset-0 bg-premium-radial opacity-80" />
      {particles.map((particle) => (
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
      ))}
    </div>
  );
};

export default ParticleBackground;
