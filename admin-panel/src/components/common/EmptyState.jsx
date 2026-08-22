import { Inbox } from "lucide-react";

/**
 * The one empty state used by every list in the portal: an icon, a plain
 * sentence saying what is missing, and an optional next action. Never a bare
 * "No data" string, and never an empty box.
 */
const EmptyState = ({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  message = "",
  action = null,
  className = ""
}) => (
  <div
    className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-10 text-center ${className}`}
  >
    <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] text-slate-300">
      <Icon size={22} aria-hidden="true" />
    </span>
    <p className="text-sm font-semibold text-white">{title}</p>
    {message ? <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">{message}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export default EmptyState;
