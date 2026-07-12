import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  CircleX,
  LoaderCircle,
} from "lucide-react";

import type {
  IntegrationConnectionStatus,
  IntegrationHealth,
} from "../types";

type ConnectionStatusBadgeProps = {
  connectionStatus: IntegrationConnectionStatus;
  health: IntegrationHealth;
};

const statusConfig = {
  connected: {
    label: "Connected",
    icon: CheckCircle2,
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  disconnected: {
    label: "Disconnected",
    icon: CircleX,
    className:
      "bg-neutral-100 text-neutral-700 ring-neutral-600/20",
  },
  paused: {
    label: "Paused",
    icon: CirclePause,
    className:
      "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  error: {
    label: "Connection error",
    icon: AlertTriangle,
    className:
      "bg-red-50 text-red-700 ring-red-600/20",
  },
} satisfies Record<
  IntegrationConnectionStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
  }
>;

export function ConnectionStatusBadge({
  connectionStatus,
  health,
}: ConnectionStatusBadgeProps) {
  const config = statusConfig[connectionStatus];

  const Icon =
    health === "syncing"
      ? LoaderCircle
      : config.icon;

  const label =
    health === "syncing"
      ? "Syncing"
      : config.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.className}`}
    >
      <Icon
        aria-hidden="true"
        className={`h-3.5 w-3.5 ${
          health === "syncing"
            ? "animate-spin"
            : ""
        }`}
      />

      {label}
    </span>
  );
}
