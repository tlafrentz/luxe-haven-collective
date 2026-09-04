"use client";

import { useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { backfillLibraryProductImagesAction } from "@/app/actions/furnishing-library";

export function ImageBackfillPanel({ initialMissingCount }: { initialMissingCount: number }) {
  const [missing, setMissing] = useState(initialMissingCount);
  const [running, setRunning] = useState(false);
  const [totalFound, setTotalFound] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const stopRef = useRef(false);

  if (missing <= 0) return null;

  async function run() {
    setRunning(true);
    stopRef.current = false;
    setError(undefined);
    let found = 0;
    let remaining = missing;
    while (!stopRef.current && remaining > 0) {
      const result = await backfillLibraryProductImagesAction({}, new FormData());
      if (!result.ok) {
        setError(result.message ?? "Backfill couldn't complete.");
        break;
      }
      found += result.imagesFound ?? 0;
      remaining = result.remaining ?? 0;
      setTotalFound(found);
      setMissing(remaining);
      if (result.processed === 0) break; // nothing left this pass, avoid spinning
    }
    setRunning(false);
  }

  return (
    <section role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed bg-white p-4 text-sm">
      <div className="flex items-center gap-2 text-stone-700">
        <ImageIcon aria-hidden="true" className="h-4 w-4 text-stone-400" />
        {running ? (
          <span>Fetching images… {totalFound} found so far, {missing} remaining.</span>
        ) : (
          <span>{missing} saved product{missing === 1 ? "" : "s"} {missing === 1 ? "has" : "have"} no image yet.{totalFound ? ` ${totalFound} added this run.` : ""}</span>
        )}
      </div>
      <div className="flex gap-2">
        {running ? (
          <button type="button" onClick={() => { stopRef.current = true; }} className="min-h-11 rounded-xl border px-4 font-semibold">
            Stop
          </button>
        ) : (
          <button type="button" onClick={run} className="min-h-11 rounded-xl border px-4 font-semibold">
            Fetch missing images
          </button>
        )}
      </div>
      {error ? <p role="alert" className="w-full text-red-700">{error}</p> : null}
    </section>
  );
}
