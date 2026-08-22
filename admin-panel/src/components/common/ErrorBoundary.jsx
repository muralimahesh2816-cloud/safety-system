import React from "react";

/**
 * Application error boundary.
 *
 * The reset/fallback contract is unchanged (`fallback`, `resetKey`, `onError`
 * all behave exactly as before) — only the default UI was rebuilt.
 *
 * Normal users never see a stack trace: the message is plain, and the two
 * recovery paths are the ones that actually work (retry the render, or go back
 * to the dashboard). The technical detail is still captured — logged to the
 * console and handed to `onError` — and is available on screen behind an
 * explicit disclosure, which is what lets a site engineer read out a reference
 * to IT without exposing internals by default.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reference: "" };
  }

  static getDerivedStateFromError(error) {
    // Short, human-readable reference so a user can quote it in a support call.
    const reference = `UI-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    return { hasError: true, error, reference };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, reference: "" });
    }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Enterprise UI Error Boundary", error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null, reference: "" });
  };

  goToDashboard = () => {
    window.location.assign("/dashboard");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback !== undefined) {
      return typeof this.props.fallback === "function"
        ? this.props.fallback({ error: this.state.error, reset: this.reset })
        : this.props.fallback;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div
          role="alert"
          className="w-full max-w-lg rounded-3xl border border-white/12 bg-slate-900/70 p-8 text-center shadow-[0_28px_70px_rgba(0,0,0,.5)]"
        >
          <span
            aria-hidden="true"
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-rose-400/35 bg-rose-500/15 text-rose-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-6 w-6">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </span>

          <h1 className="font-display text-xl font-semibold text-white">Something went wrong</h1>
          <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-slate-300">
            This screen could not be displayed. Your work has not been submitted — please try again,
            or return to the dashboard and re-open the module.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={this.reset}
              className="hse-primary-button inline-flex min-h-11 items-center px-5 text-sm font-semibold text-white"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={this.goToDashboard}
              className="inline-flex min-h-11 items-center rounded-xl border border-white/15 bg-white/[0.07] px-5 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.13]"
            >
              Go to Dashboard
            </button>
          </div>

          {this.state.reference ? (
            <p className="mt-5 text-[11px] text-slate-500">
              Reference <span className="font-mono text-slate-400">{this.state.reference}</span> — quote
              this if you contact support.
            </p>
          ) : null}

          {this.state.error ? (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
                Technical details
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[10px] leading-relaxed text-slate-400">
                {String(this.state.error?.message || this.state.error)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
