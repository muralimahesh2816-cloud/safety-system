import {
  calculateCompletionPercentage,
  getChainageDisplay,
  parseComparableChainage,
  validateChainageRange
} from "./chainage";

test("pending work displays the requested chainage", () => {
  expect(
    getChainageDisplay({
      workflowStage: "Pending Check",
      requestedChainageFrom: "KM 328+500",
      requestedChainageTo: "KM 329+000",
      approvedChainageFrom: "KM 328+500",
      approvedChainageTo: "KM 329+000"
    })
  ).toEqual({
    label: "Requested Chainage",
    from: "KM 328+500",
    to: "KM 329+000",
    range: "KM 328+500 to KM 329+000"
  });
});

test("approved work displays the immutable approval snapshot", () => {
  const display = getChainageDisplay({
    workflowStage: "Approved",
    requestedChainageFrom: "KM 328+500",
    requestedChainageTo: "KM 329+000",
    approvedChainageFrom: "KM 328+600",
    approvedChainageTo: "KM 328+900"
  });
  expect(display.label).toBe("Approved Chainage");
  expect(display.range).toBe("KM 328+600 to KM 328+900");
});

test("partial completion percentage uses approved and completed ranges", () => {
  expect(parseComparableChainage("328500")).toBe(328.5);
  expect(
    calculateCompletionPercentage({
      workflowStage: "Partially Completed",
      approvedChainageFrom: "KM 328+000",
      approvedChainageTo: "KM 329+000",
      completedChainageFrom: "KM 328+000",
      completedChainageTo: "KM 328+500"
    })
  ).toBe(50);
  expect(
    validateChainageRange({ chainageFrom: "KM 329+000", chainageTo: "KM 328+500" }).isValid
  ).toBe(false);
});
