"use client";

import {
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncResult = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

type SyncApiResponse =
  | {
      success: true;
      durationMs: number;
      result: SyncResult;
    }
  | {
      success: false;
      error: string;
    };

type SyncState =
  | {
      status: "idle";
    }
  | {
      status: "syncing";
    }
  | {
      status: "success";
      durationMs: number;
      result: SyncResult;
    }
  | {
      status: "error";
      message: string;
    };

type SyncNowButtonProps = {
  provider: "hospitable";
  disabled?: boolean;
};

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} sec`;
}

export function SyncNowButton({
  provider,
  disabled = false,
}: SyncNowButtonProps) {
  const router = useRouter();

  const [syncState, setSyncState] =
    useState<SyncState>({
      status: "idle",
    });

  const isSyncing =
    syncState.status === "syncing";

  async function handleSync() {
    if (isSyncing || disabled) {
      return;
    }

    setSyncState({
      status: "syncing",
    });

    try {
      const response = await fetch(
        `/api/admin/integrations/${provider}/sync`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload =
        (await response.json()) as SyncApiResponse;

      if (!response.ok || !payload.success) {
        const message =
          payload.success === false
            ? payload.error
            : `Sync failed with status ${response.status}.`;

        throw new Error(message);
      }

      setSyncState({
        status: "success",
        durationMs: payload.durationMs,
        result: payload.result,
      });

      router.refresh();
    } catch (error) {
      setSyncState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The integration could not be synchronized.",
      });
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        disabled={disabled || isSyncing}
        onClick={handleSync}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSyncing ? (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
            Syncing…
          </>
        ) : (
          <>
            <RefreshCw
              aria-hidden="true"
              className="h-4 w-4"
            />
            Sync now
          </>
        )}
      </button>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="min-h-5 text-left text-xs sm:text-right"
      >
        {syncState.status === "success" ? (
          <p className="inline-flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />

            Processed {syncState.result.processed},{" "}
            updated {syncState.result.updated} in{" "}
            {formatDuration(syncState.durationMs)}.
          </p>
        ) : null}

        {syncState.status === "error" ? (
          <p className="inline-flex items-start gap-1.5 text-red-700">
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            />

            <span>{syncState.message}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
