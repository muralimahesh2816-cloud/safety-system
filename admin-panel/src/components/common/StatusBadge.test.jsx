import { render, screen } from "@testing-library/react";
import StatusBadge, { statusTone } from "./StatusBadge";

test("workflow stages map to the intended tones", () => {
  expect(statusTone("Pending Check")).toBe("pending");
  expect(statusTone("Pending Final Approval")).toBe("pending");
  expect(statusTone("Work In Progress")).toBe("progress");
  expect(statusTone("Approved")).toBe("success");
  expect(statusTone("Completed")).toBe("success");
  expect(statusTone("Returned for Correction")).toBe("returned");
  expect(statusTone("Open")).toBe("info");
  expect(statusTone("Critical")).toBe("critical");
  expect(statusTone("")).toBe("neutral");
});

test("'Returned for Correction' is not misread as a generic pending state", () => {
  // It contains neither 'pending' nor 'critical', and matching order matters:
  // a returned record must be visually distinct from one merely awaiting review.
  expect(statusTone("Returned for Correction")).not.toBe("pending");
});

test("the label is always rendered, so status is never colour-only", () => {
  render(<StatusBadge status="Closed" />);
  expect(screen.getByText("Closed")).toBeInTheDocument();
});

test("an explicit tone overrides the inferred one", () => {
  render(<StatusBadge status="Low" label="Low severity" tone="neutral" />);
  const badge = screen.getByText("Low severity");
  expect(badge).toHaveClass("hse-status--neutral");
});
