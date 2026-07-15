import Link from "next/link";

import {
  ArrowLeft,
  Sparkles,
} from "lucide-react";

import type {
  ExecutionWorkspace,
} from "../domain";

import {
  ActionPriorityBadge,
} from "./action-priority-badge";

import {
  ActionStatusBadge,
} from "./action-status-badge";

type ExecutionHeaderProps = {
  workspace: ExecutionWorkspace;
};

export function ExecutionHeader({
  workspace,
}: ExecutionHeaderProps) {
  return (
    <header>
      <Link
        href="/dashboard/actions"
        className="inline-flex items-center gap-2 text-sm font-semibold text-stone-500 transition hover:text-stone-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Action Center
      </Link>

      <div className="mt-7 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            <Sparkles className="h-4 w-4" />
            Execution workspace
          </p>

          <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
            {workspace.outcomeTitle}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600 sm:text-base">
            {workspace.whyNow}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionPriorityBadge
            priority={
              workspace.metadata.priority
            }
          />

          <ActionStatusBadge
            status={
              workspace.metadata.status
            }
          />
        </div>
      </div>
    </header>
  );
}
