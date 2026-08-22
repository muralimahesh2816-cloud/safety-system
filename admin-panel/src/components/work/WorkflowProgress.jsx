import { Check, RotateCcw } from "lucide-react";
import { normalizeWorkStage } from "../../utils/chainage";

/**
 * Step-by-step visualisation of the work-approval workflow.
 *
 * It only *renders* the stage a record is already in — it never derives or
 * changes workflow state. Stage naming and ordering mirror
 * backend/src/constants/work-status.js so the picture cannot drift from the
 * rules the server actually enforces.
 *
 * "Returned for Correction" is deliberately not a step in the line: it is a
 * loop back to the creator from wherever the record was, so it is shown as an
 * out-of-band state marked on the step that bounced it.
 */
export const WORKFLOW_STEPS = [
  { key: "Pending Check", label: "Created", done: "Submitted" },
  { key: "Pending Recommendation", label: "Checked" },
  { key: "Pending Final Approval", label: "Recommended" },
  { key: "Approved", label: "Approved" },
  { key: "Work In Progress", label: "In Progress" },
  { key: "Completed", label: "Completed" }
];

const STEP_INDEX = new Map(WORKFLOW_STEPS.map((step, index) => [step.key, index]));

/**
 * Index of the step a record currently sits on. Partially Completed shares the
 * "In Progress" position because the work is genuinely still open.
 */
const resolveIndex = (stage) => {
  if (stage === "Partially Completed") return STEP_INDEX.get("Work In Progress");
  return STEP_INDEX.has(stage) ? STEP_INDEX.get(stage) : 0;
};

const WorkflowProgress = ({ work, stage: stageProp, className = "", compact = false }) => {
  const stage = stageProp || normalizeWorkStage(work || {});
  const returned = stage === "Returned for Correction";
  const currentIndex = returned ? 0 : resolveIndex(stage);

  return (
    <div
      className={`hse-workflow ${className}`}
      role="list"
      aria-label={`Approval workflow — currently ${returned ? "Returned for Correction" : stage}`}
    >
      {WORKFLOW_STEPS.map((step, index) => {
        const isDone = !returned && index < currentIndex;
        const isCurrent = !returned && index === currentIndex;
        const state = returned && index === 0 ? "returned" : isDone ? "done" : isCurrent ? "current" : "todo";
        const isLast = index === WORKFLOW_STEPS.length - 1;

        return (
          <div
            key={step.key}
            className="hse-workflow__step"
            data-state={state}
            role="listitem"
            aria-current={isCurrent ? "step" : undefined}
          >
            {!isLast ? <span className="hse-workflow__connector" aria-hidden="true" /> : null}
            <span className="hse-workflow__marker">
              {state === "returned" ? (
                <RotateCcw aria-hidden="true" />
              ) : isDone ? (
                <Check aria-hidden="true" />
              ) : (
                index + 1
              )}
            </span>
            {!compact ? (
              <span className="hse-workflow__label">
                {isDone && step.done ? step.done : step.label}
                {/* Screen readers get the state in words, not just via colour. */}
                <span className="sr-only">
                  {state === "returned"
                    ? " — returned for correction"
                    : isDone
                    ? " — complete"
                    : isCurrent
                    ? " — current stage"
                    : " — not started"}
                </span>
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowProgress;
