"use client";
import { useState } from "react";
export function CopyGuidebookLink({ path }: { path: string }) {
  const [state, setState] = useState("Copy public link");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(
            new URL(path, window.location.origin).toString(),
          );
          setState("Link copied");
        } catch {
          setState("Copy failed · select the link above");
        }
      }}
      className="rounded-full border px-5 py-3 text-sm font-semibold"
      aria-live="polite"
    >
      {state}
    </button>
  );
}
