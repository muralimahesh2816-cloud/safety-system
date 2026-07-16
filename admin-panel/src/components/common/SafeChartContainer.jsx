import { useEffect, useRef, useState } from "react";

const ChartSkeleton = ({ height }) => (
  <div
    className="flex w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]"
    style={{ height, minHeight: height }}
  >
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
  </div>
);

const SafeChartContainer = ({ children, height = 320, className = "" }) => {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const markReady = (width, measuredHeight) => {
      setReady(width > 1 && measuredHeight > 1);
    };

    if (typeof ResizeObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        markReady(rect.width, rect.height);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height: measuredHeight } = entry.contentRect;
      markReady(width, measuredHeight);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`chart-safe-container w-full min-w-0 ${className}`}
      style={{ height, minHeight: height }}
    >
      {ready ? children : <ChartSkeleton height={height} />}
    </div>
  );
};

export default SafeChartContainer;
