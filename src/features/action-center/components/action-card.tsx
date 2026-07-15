import {
  ArrowRight,
  Building2,
  UserRound,
} from "lucide-react";

import type {
  ActionCenterItem,
} from "../domain";

import {
  ActionPriorityBadge,
} from "./action-priority-badge";

import {
  ActionStatusBadge,
} from "./action-status-badge";

type ActionCardProps = {
  action: ActionCenterItem;
};

function formatActionType(
  type: ActionCenterItem["type"],
): string {
  return type
    .split("-")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

export function ActionCard({
  action,
}: ActionCardProps) {
  return (
    <article className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ActionPriorityBadge
              priority={action.priority}
            />

            <ActionStatusBadge
              status={action.status}
            />

            <span className="text-xs font-medium text-stone-500">
              {formatActionType(action.type)}
            </span>
          </div>

          <h3 className="mt-4 text-lg font-semibold tracking-tight text-stone-950">
            {action.title}
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            {action.summary}
          </p>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-500">
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-3.5 w-3.5" />
              {action.ownerName}
            </span>

            <span className="inline-flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              {action.propertyId
                ? "Property action"
                : "Portfolio action"}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-950 transition hover:border-stone-950 hover:bg-stone-950 hover:text-white"
        >
          View action
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
