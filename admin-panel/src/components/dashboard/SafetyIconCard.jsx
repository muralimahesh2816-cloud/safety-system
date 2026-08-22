// Icon chip inside a KPI tile. Intentionally free of `backdrop-filter` and of
// a hover rotation: 28 of these render at once on the dashboard, and each blur
// layer costs a compositor re-rasterise per scroll frame.
const SafetyIconCard = ({ icon: Icon, accent = "text-cyan-200", className = "" }) => (
  <div
    className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,.16)] transition-transform duration-300 group-hover:scale-105 ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
    <Icon className={`relative z-10 ${accent}`} size={23} strokeWidth={1.8} aria-hidden="true" />
  </div>
);

export default SafetyIconCard;
