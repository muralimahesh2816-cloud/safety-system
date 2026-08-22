// Shared loading placeholders. Every list, card grid, table and chart in the
// portal shows one of these instead of a blank panel or a bare "Loading..."
// string, so the layout never collapses and then jumps back when data lands.

const shimmer = "animate-pulse rounded-2xl bg-white/10";

export const Line = ({ className = "h-3 w-full" }) => (
  <div className={`${shimmer} ${className}`} />
);

export const CardSkeleton = ({ className = "" }) => (
  <div className={`rounded-3xl border border-white/10 bg-white/[0.035] p-5 ${className}`}>
    <Line className="h-3 w-24" />
    <Line className="mt-4 h-8 w-32" />
    <Line className="mt-3 h-3 w-full" />
    <Line className="mt-2 h-3 w-2/3" />
  </div>
);

export const CardGridSkeleton = ({ count = 6, className = "" }) => (
  <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
    {Array.from({ length: count }).map((_, index) => (
      <CardSkeleton key={index} />
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 6, columns = 5 }) => (
  <div className="overflow-hidden rounded-2xl border border-white/10">
    <div className="flex gap-3 border-b border-white/10 bg-white/[0.05] p-3">
      {Array.from({ length: columns }).map((_, index) => (
        <Line key={index} className="h-3 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-3 border-b border-white/5 p-3 last:border-b-0">
        {Array.from({ length: columns }).map((_, index) => (
          <Line key={index} className="h-3 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const ListSkeleton = ({ rows = 4 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <Line className="h-3 w-1/3" />
        <Line className="mt-2 h-3 w-2/3" />
      </div>
    ))}
  </div>
);

export const ChartSkeleton = ({ height = 288 }) => (
  <div
    className="flex w-full min-w-0 items-end gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5"
    style={{ height, minHeight: height }}
    aria-hidden="true"
  >
    {[0.45, 0.7, 0.35, 0.85, 0.55, 0.65, 0.4].map((fraction, index) => (
      <div
        key={index}
        className="flex-1 animate-pulse rounded-t-lg bg-white/10"
        style={{ height: `${fraction * 100}%` }}
      />
    ))}
  </div>
);

/** Inline spinner for buttons — sized to the surrounding text. */
export const ButtonSpinner = ({ size = 14, className = "" }) => (
  <span
    role="status"
    aria-label="Working"
    className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current ${className}`}
    style={{ width: size, height: size }}
  />
);

export const ModalLoader = ({ label = "Loading" }) => (
  <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-slate-300">
    <ButtonSpinner size={26} />
    <p>{label}</p>
  </div>
);

const Skeletons = {
  CardSkeleton,
  CardGridSkeleton,
  TableSkeleton,
  ListSkeleton,
  ChartSkeleton,
  ButtonSpinner,
  ModalLoader
};

export default Skeletons;
