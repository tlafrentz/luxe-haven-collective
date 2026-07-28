"use client";

import {
  CheckCircle2,
  LoaderCircle,
  MessageSquareText,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type MessageSyncResult = {
  reservations: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
};

type MessageSyncApiResponse =
  | { success: true; result: MessageSyncResult }
  | { success: false; error: string };

type MessageSyncState =
  | { status: "idle" }
  | { status: "syncing" }
  | { status: "success"; result: MessageSyncResult }
  | { status: "error"; message: string };

export function SyncMessagesButton({
  disabled = false,
  running = false,
}: {
  disabled?: boolean;
  running?: boolean;
}) {
  const router = useRouter();
  const [syncState, setSyncState] =
    useState<MessageSyncState>({ status: "idle" });
  const isSyncing =
    running || syncState.status === "syncing";

  async function handleSync() {
    if (disabled || isSyncing) return;

    setSyncState({ status: "syncing" });

    try {
      const response = await fetch(
        "/api/admin/integrations/hospitable/messages/sync",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        },
      );
      const payload =
        (await response.json()) as MessageSyncApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success === false
            ? payload.error
            : `Message sync failed with status ${response.status}.`,
        );
      }

      setSyncState({
        status: "success",
        result: payload.result,
      });
      router.refresh();
    } catch (error) {
      setSyncState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Hospitable messages could not be synchronized.",
      });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        disabled={disabled || isSyncing}
        onClick={handleSync}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-950 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSyncing ? (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
            Syncing messages…
          </>
        ) : (
          <>
            <MessageSquareText
              aria-hidden="true"
              className="h-4 w-4"
            />
            Sync messages
          </>
        )}
      </button>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="min-h-5 text-left text-xs sm:text-right"
      >
        {running && syncState.status === "idle" ? (
          <p className="inline-flex items-center gap-1.5 text-blue-700">
            <LoaderCircle
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
            A message sync is already running.
          </p>
        ) : null}

        {syncState.status === "success" ? (
          <p className="inline-flex items-start gap-1.5 text-emerald-700">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            />
            <span>
              {syncState.result.reservations} reservations;{" "}
              {syncState.result.processed} messages processed,{" "}
              {syncState.result.created} created,{" "}
              {syncState.result.skipped} skipped,{" "}
              {syncState.result.failed} failed.
            </span>
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
