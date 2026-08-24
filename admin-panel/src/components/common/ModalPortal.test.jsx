/*
 * These tests are specifically about *where in the DOM* the overlay is
 * mounted, which is the whole point of the portal — Testing Library's queries
 * deliberately abstract that away, so asserting it requires direct node
 * access. Disabled for this file only.
 */
/* eslint-disable testing-library/no-node-access */
import { render, screen } from "@testing-library/react";
import ModalPortal from "./ModalPortal";

const Root = ({ children }) => {
  // Mimics the real shell: an app root that scrolls, containing a transformed
  // page-transition wrapper. Both of those are what broke `position: fixed`.
  return (
    <div id="root">
      <div style={{ overflow: "auto" }}>
        <div style={{ transform: "translateY(8px)" }}>{children}</div>
      </div>
    </div>
  );
};

afterEach(() => {
  document.getElementById("hse-overlay-root")?.remove();
  document.body.className = "";
  delete document.body.dataset.overlayDepth;
});

test("overlay content escapes the app root entirely", () => {
  render(
    <Root>
      <ModalPortal>
        <div data-testid="overlay">Details</div>
      </ModalPortal>
    </Root>
  );

  const overlay = screen.getByTestId("overlay");
  const appRoot = document.getElementById("root");

  // The whole point: a transformed ancestor is the containing block for
  // `position: fixed`, so an overlay left inside the shell is laid out against
  // the content column and clipped by its scroll container instead of covering
  // the viewport.
  expect(appRoot.contains(overlay)).toBe(false);
  expect(document.getElementById("hse-overlay-root").contains(overlay)).toBe(true);
});

test("the portal host does not create a stacking context", () => {
  render(
    <ModalPortal>
      <div data-testid="overlay">Details</div>
    </ModalPortal>
  );

  const host = document.getElementById("hse-overlay-root");
  // `position: relative` + any z-index (0 included) would establish a stacking
  // context, and every overlay inside would then paint at the host's level —
  // which is what put modals underneath the mobile navigation drawer.
  expect(host.style.display).toBe("contents");
  expect(host.style.position).toBe("");
  expect(host.style.zIndex).toBe("");
});

test("stacked overlays share one reference-counted scroll lock", () => {
  const { rerender } = render(
    <>
      <ModalPortal>
        <div>first</div>
      </ModalPortal>
      <ModalPortal>
        <div>second</div>
      </ModalPortal>
    </>
  );

  expect(document.body.classList.contains("hse-overlay-open")).toBe(true);
  expect(document.body.dataset.overlayDepth).toBe("2");

  // Closing the inner overlay must not release the lock while the outer one is
  // still open — a details modal can open a media viewer on top of itself.
  rerender(
    <ModalPortal>
      <div>first</div>
    </ModalPortal>
  );
  expect(document.body.classList.contains("hse-overlay-open")).toBe(true);

  rerender(<div />);
  expect(document.body.classList.contains("hse-overlay-open")).toBe(false);
  expect(document.body.dataset.overlayDepth).toBeUndefined();
});

test("a disabled portal renders inline, so it can be opted out of", () => {
  render(
    <Root>
      <ModalPortal disabled>
        <div data-testid="inline">Inline</div>
      </ModalPortal>
    </Root>
  );

  expect(document.getElementById("root").contains(screen.getByTestId("inline"))).toBe(true);
});
