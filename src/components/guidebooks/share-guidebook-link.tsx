"use client";
import { useState } from "react";
export function ShareGuidebookLink({
  path,
  title,
}: {
  path: string;
  title: string;
}) {
  const [state, setState] = useState("Share link");
  return (
    <button
      type="button"
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {
            // user cancelled the native share sheet; no error state needed
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          setState("Link copied");
        } catch {
          setState("Share unavailable · copy the link above");
        }
      }}
      className="rounded-full border px-5 py-3 text-sm font-semibold"
      aria-live="polite"
    >
      {state}
    </button>
  );
}
