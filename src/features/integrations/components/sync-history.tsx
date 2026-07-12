import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
} from "lucide-react";

import type {
  IntegrationSyncHistoryItem,
  IntegrationSyncRunStatus,
} from "../types";

type SyncHistoryProps = {
  history: IntegrationSyncHistoryItem[];
};

type StatusConfig = {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  badgeClassName: string;
};

const statusConfig: Record<
  IntegrationSyncRunStatus,
  StatusConfig
> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    iconClassName: "text-emerald-700",
    badgeClassName:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  partial: {
    label: "Partial",
    icon: AlertTriangle,
    iconClassName: "text-amber-700",
    badgeClassName:
      "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  failed: {
    label: "Failed",
    icon: AlertTriangle,
    iconClassName: "text-red-700",
    badgeClassName:
      "bg-red-50 text-red-700 ring-red-600/20",
  },
  running: {
    label: "Running",
    icon: LoaderCircle,
    iconClassName: "animate-spin text-blue-700",
    badgeClassName:
      "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(
  durationMs: number,
): string {
  if (durationMs <= 0) {
    return "In progress";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} sec`;
}

export function SyncHistory({
  history,
}: SyncHistoryProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <p className="text-sm font-medium text-neutral-500">
          Integration activity
        </p>

        <h2 className="mt-1 text-xl font-semibold text-neutral-950">
          Recent sync history
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          The most recent reservation synchronization
          attempts for this connection.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <Clock3
            aria-hidden="true"
            className="mx-auto h-6 w-6 text-neutral-400"
          />

          <h3 className="mt-3 text-sm font-semibold text-neutral-950">
            No sync history yet
          </h3>

          <p className="mt-2 text-sm text-neutral-500">
            Run the integration to create the first
            activity record.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {history.map((syncRun) => (
            <SyncHistoryRow
              key={syncRun.id}
              syncRun={syncRun}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SyncHistoryRow({
  syncRun,
}: {
  syncRun: IntegrationSyncHistoryItem;
}) {
  const config =
    statusConfig[syncRun.status];

  const StatusIcon = config.icon;

  return (
    <article className="px-5 py-4 transition hover:bg-neutral-50">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
            <StatusIcon
              aria-hidden="true"
              className={`h-4 w-4 ${config.iconClassName}`}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-neutral-950">
                {formatDateTime(
                  syncRun.startedAt,
                )}
              </p>

              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.badgeClassName}`}
              >
                {config.label}
              </span>
            </div>

            <p className="mt-1 text-sm text-neutral-500">
              Processed {syncRun.processed},{" "}
              created {syncRun.created}, updated{" "}
              {syncRun.updated}, skipped{" "}
              {syncRun.skipped}, failed{" "}
              {syncRun.failed}.
            </p>

            {syncRun.errorMessage ? (
              <p className="mt-2 max-w-3xl text-sm leading-5 text-red-700">
                {syncRun.errorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-neutral-500 lg:justify-end">
          <Clock3
            aria-hidden="true"
            className="h-4 w-4"
          />

          {formatDuration(syncRun.durationMs)}
        </div>
      </div>
    </article>
  );
}
