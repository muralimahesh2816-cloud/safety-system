import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error("Enterprise UI Error Boundary", error);
    this.props.onError?.(error);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return typeof this.props.fallback === "function"
          ? this.props.fallback({ error: this.state.error, reset: this.reset })
          : this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <h1 className="text-2xl font-semibold mb-3">Something went wrong</h1>
            <p className="text-slate-300">
              The dashboard hit an unexpected error. Refresh to recover the session.
            </p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
