"use client";

import { useEffect, useState } from "react";
import type { AuthActionState } from "@/app/actions/auth";

export function AuthFormStatus({ state }: { state?: AuthActionState }) {
  if (!state?.message) return null;
  return (
    <div
      aria-live="polite"
      role={state.ok ? "status" : "alert"}
      className={`rounded-2xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}
    >
      {state.message}
      <Countdown key={state.correlationId} seconds={state.retryAfterSeconds ?? 0} className="mt-1 block" />
    </div>
  );
}

export function AuthCooldown({ seconds = 0, attemptKey }: Readonly<{ seconds?: number; attemptKey?: string }>) {
  return <Countdown key={attemptKey} seconds={seconds} className="mt-2 text-sm text-amber-800" />;
}

function Countdown({ seconds, className }: Readonly<{ seconds: number; className: string }>) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (!seconds) return;
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);
  return remaining > 0 ? <span role="status" aria-live="polite" className={className}>Try again in {remaining} second{remaining === 1 ? "" : "s"}.</span> : null;
}
