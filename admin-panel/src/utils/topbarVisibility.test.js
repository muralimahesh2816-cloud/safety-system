import { getTopbarVisibility } from "./topbarVisibility";

test("hides the dashboard topbar on meaningful downward scrolling", () => {
  expect(getTopbarVisibility({ previousScrollTop: 100, nextScrollTop: 120 })).toBe(false);
});

test("shows the dashboard topbar on upward scroll, page top, or interaction", () => {
  expect(getTopbarVisibility({ previousScrollTop: 120, nextScrollTop: 110 })).toBe(true);
  expect(getTopbarVisibility({ previousScrollTop: 20, nextScrollTop: 8 })).toBe(true);
  expect(getTopbarVisibility({ previousScrollTop: 100, nextScrollTop: 120, interacting: true })).toBe(true);
});
