import momentumMark from "../../assets/topbarlogo.svg";
import { APP_NAME } from "../../config/appConfig";

/**
 * The live Momentum wheel.
 *
 * One component for the mark wherever it appears, so there is a single
 * definition of how it looks and moves rather than a slightly different
 * treatment per surface.
 *
 * Motion is pure CSS (`transform: rotate`, linear, 48s — the same cadence the
 * login page has always used). That matters:
 *
 *  - `transform` is compositor-only, so a continuous rotation costs no layout,
 *    no paint and no main-thread work; it does not compete with charts,
 *    scrolling or navigation.
 *  - Nothing here re-renders React. The previous topbar drove this with three
 *    infinite framer-motion animations — including a `backdrop-filter` ring —
 *    which kept the compositor busy for the whole session on every page.
 *  - `prefers-reduced-motion` stops it outright.
 *
 * Deliberately slow: at 48s per turn the wheel reads as alive without pulling
 * the eye away from safety information.
 */
const SIZES = {
  sm: { box: 40, mark: 30 },
  md: { box: 56, mark: 44 },
  lg: { box: 64, mark: 50 }
};

const MomentumLogo = ({
  size = "md",
  spin = true,
  className = "",
  // The mark is decorative wherever a visible product name sits beside it;
  // pass a label to make it the accessible name instead.
  label = ""
}) => {
  const { box, mark } = SIZES[size] || SIZES.md;

  return (
    <span
      className={`momentum-logo ${spin ? "momentum-logo--spinning" : ""} ${className}`}
      style={{ width: box, height: box }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : "true"}
    >
      <span className="momentum-logo__halo" />
      <img
        className="momentum-logo__mark"
        src={momentumMark}
        alt=""
        width={mark}
        height={mark}
        draggable="false"
        style={{ width: mark, height: mark }}
      />
    </span>
  );
};

export const MOMENTUM_ALT = `${APP_NAME} logo`;

export default MomentumLogo;
