import { CardGridSkeleton, Line, TableSkeleton } from "./Skeletons";

/**
 * Suspense fallback for a code-split module. It mirrors the real page frame
 * (header block, KPI row, content table) so the hand-off from skeleton to
 * loaded module doesn't shift the layout.
 */
const ModuleSkeleton = ({ label = "module" }) => (
  <div className="space-y-5" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading {label}</span>
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-5 md:px-5">
      <Line className="h-2.5 w-40" />
      <Line className="mt-3 h-6 w-64" />
      <Line className="mt-3 h-3 w-80 max-w-full" />
    </div>
    <CardGridSkeleton count={4} />
    <TableSkeleton rows={5} columns={5} />
  </div>
);

export default ModuleSkeleton;
