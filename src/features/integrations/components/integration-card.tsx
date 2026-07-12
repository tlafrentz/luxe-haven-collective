import {
  Building2,
  CalendarCheck2,
  Clock3,
  DatabaseZap,
} from "lucide-react";

import type {
  IntegrationDashboardItem,
} from "../types";

import { ConnectionStatusBadge } from "./connection-status-badge";
import { SyncNowButton } from "./sync-now-button";

type IntegrationCardProps = {
  integration: IntegrationDashboardItem;
};

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(
  durationMs: number,
): string {
  if (durationMs <= 0) {
    return "Not recorded";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} sec`;
}

export function IntegrationCard({
  integration,
}: IntegrationCardProps) {
  const canSync =
    integration.connectionStatus === "connected" ||
    integration.connectionStatus === "error";

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white">
              <DatabaseZap
                aria-hidden="true"
                className="h-5 w-5"
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-neutral-950">
                {integration.displayName}
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600">
                {integration.description}
              </p>
            </div>
          </div>

          <ConnectionStatusBadge
            connectionStatus={
              integration.connectionStatus
            }
            health={integration.health}
          />
        </div>
      </div>

      <div className="grid gap-px bg-neutral-200 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Building2}
          label="Linked properties"
          value={integration.propertyCount.toString()}
        />

        <Metric
          icon={CalendarCheck2}
          label="Reservations"
          value={integration.reservationCount.toString()}
        />

        <Metric
          icon={Clock3}
          label="Last sync"
          value={formatDateTime(
            integration.lastSyncedAt,
          )}
        />

        <Metric
          icon={DatabaseZap}
          label="Duration"
          value={formatDuration(
            integration.lastSync?.durationMs ?? 0,
          )}
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-neutral-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-neutral-600">
          {integration.lastSync ? (
            <span>
              Last run processed{" "}
              <strong className="font-semibold text-neutral-950">
                {integration.lastSync.processed}
              </strong>{" "}
              reservations, created{" "}
              <strong className="font-semibold text-neutral-950">
                {integration.lastSync.created}
              </strong>
              , updated{" "}
              <strong className="font-semibold text-neutral-950">
                {integration.lastSync.updated}
              </strong>
              , and failed{" "}
              <strong className="font-semibold text-neutral-950">
                {integration.lastSync.failed}
              </strong>
              .
            </span>
          ) : (
            <span>No sync history is available yet.</span>
          )}
        </div>

        {integration.provider === "hospitable" ? (
          <SyncNowButton
            provider="hospitable"
            disabled={!canSync}
          />
        ) : null}
      </div>
    </article>
  );
}

type MetricProps = {
  icon: typeof Building2;
  label: string;
  value: string;
};

function Metric({
  icon: Icon,
  label,
  value,
}: MetricProps) {
  return (
    <div className="bg-white p-5">
      <div className="flex items-center gap-2 text-neutral-500">
        <Icon
          aria-hidden="true"
          className="h-4 w-4"
        />

        <p className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className="mt-3 text-lg font-semibold text-neutral-950">
        {value}
      </p>
    </div>
  );
}
