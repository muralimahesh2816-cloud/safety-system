import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock3,
  Info,
  RotateCcw
} from "lucide-react";

/**
 * One badge for every status string in the portal.
 *
 * Status is never communicated by colour alone (WCAG 1.4.1): each tone also
 * carries its own glyph, and the label text is always rendered. That matters
 * here specifically because these badges encode safety-critical state — an
 * "Open critical hazard" must not be indistinguishable from "Closed" to a
 * colour-blind reviewer or in a greyscale print of a report.
 */
const TONES = {
  neutral: { className: "hse-status--neutral", Icon: CircleDashed },
  info: { className: "hse-status--info", Icon: Info },
  pending: { className: "hse-status--pending", Icon: Clock3 },
  progress: { className: "hse-status--progress", Icon: CircleDot },
  success: { className: "hse-status--success", Icon: CheckCircle2 },
  critical: { className: "hse-status--critical", Icon: AlertTriangle },
  returned: { className: "hse-status--critical", Icon: RotateCcw }
};

// Matched longest-first so "Pending Final Approval" doesn't fall through to
// the generic "pending" rule with the wrong glyph.
const RULES = [
  [/returned|reject|correction/i, "returned"],
  [/critical|high risk|severe|overdue|expired|failed|danger/i, "critical"],
  [/completed|closed|approved|verified|resolved|competent|passed|active|published/i, "success"],
  [/in progress|progress|responding|investigation|assigned|under review|review/i, "progress"],
  [/pending|awaiting|planned|scheduled|draft|submitted|due/i, "pending"],
  [/open|reported|new|info/i, "info"]
];

export const statusTone = (status = "") => {
  const value = String(status || "").trim();
  if (!value) return "neutral";
  const match = RULES.find(([pattern]) => pattern.test(value));
  return match ? match[1] : "neutral";
};

const StatusBadge = ({ status, tone, label, className = "", showIcon = true }) => {
  const resolvedTone = tone || statusTone(status);
  const { className: toneClass, Icon } = TONES[resolvedTone] || TONES.neutral;
  const text = label || status || "Unknown";

  return (
    <span className={`hse-status ${toneClass} ${className}`}>
      {showIcon ? <Icon size={11} aria-hidden="true" /> : <span className="hse-status__dot" />}
      {text}
    </span>
  );
};

export default StatusBadge;
