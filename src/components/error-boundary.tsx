"use client";

import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  theme?: "light" | "dark";
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Portal render error:", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDark = this.props.theme === "dark";

    return (
      <div
        className={[
          "rounded-3xl border px-6 py-10 text-center shadow-lg",
          isDark ? "border-border-default bg-surface-raised text-text-primary" : "border-[#b2dfdb] bg-white text-slate-900",
        ].join(" ")}
      >
        <h2 className={["text-xl font-bold", isDark ? "text-text-primary" : "text-slate-900"].join(" ")}>
          Something went wrong
        </h2>
        <p className={["mt-2 text-sm", isDark ? "text-text-secondary" : "text-slate-600"].join(" ")}>
          Please refresh and try again.
        </p>
      </div>
    );
  }
}
