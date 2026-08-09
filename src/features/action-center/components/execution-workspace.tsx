"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { ActionCenterAction } from "../domain";
import {
  mutateActionCenterAction,
  type ActionCenterMutationInput,
} from "@/app/actions/action-center";
import { ActionPriorityBadge } from "./action-priority-badge";
import { ActionStatusBadge } from "./action-status-badge";

const actionable = new Set([
  "commit",
  "mark-ready",
  "start",
  "block",
  "unblock",
  "submit-for-review",
  "return-for-correction",
  "complete",
  "fail",
  "retry",
  "reopen",
  "cancel",
  "archive",
]);
export function ExecutionWorkspacePage({
  action: initial,
}: {
  action: ActionCenterAction;
}) {
  const [action, setAction] = useState(initial);
  const [message, setMessage] = useState("");
  const [reasonOperation, setReasonOperation] = useState<ActionCenterMutationInput["operation"] | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  function run(operation: ActionCenterMutationInput["operation"], operationReason?: string) {
    startTransition(async () => {
      const result = await mutateActionCenterAction({
        actionId: action.id,
        expectedVersion: action.version,
        operation,
        ...(operationReason ? { reason: operationReason } : {}),
      });
      if (result.ok) {
        setAction(result.action);
        setMessage("");
        setReasonOperation(null);
        setReason("");
      } else setMessage(result.message);
    });
  }
  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link
          href="/dashboard/execute/actions"
          className="text-sm font-semibold text-stone-600"
        >
          ← Back to Action Center
        </Link>
        <header>
          <div className="flex gap-2">
            <ActionPriorityBadge priority={action.priority} />
            <ActionStatusBadge status={action.status} />
            <span className="text-xs text-stone-500">
              Version {action.version}
            </span>
          </div>
          <h1 className="mt-5 text-4xl font-semibold text-stone-950">
            {action.title}
          </h1>
          {action.description ? (
            <p className="mt-4 text-stone-600">{action.description}</p>
          ) : null}
        </header>
        <section className="rounded-3xl border bg-white p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-stone-500">Owner</dt>
              <dd>{action.owner.label}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Assignee</dt>
              <dd>{action.assignee?.label ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Source</dt>
              <dd>{action.sourceLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Due</dt>
              <dd>
                {action.dueAt
                  ? new Date(action.dueAt).toLocaleString()
                  : "Not scheduled"}
                {action.isOverdue ? " · Overdue" : ""}
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-3xl bg-stone-950 p-6 text-white">
          <h2 className="font-semibold">Available actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {action.availableCommands
              .filter(
                (command): command is ActionCenterMutationInput["operation"] =>
                  actionable.has(command),
              )
              .map((command) => (
                <button
                  key={command}
                  disabled={pending}
                  onClick={() => ["return-for-correction", "fail", "retry", "reopen"].includes(command) ? setReasonOperation(command) : run(command)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50"
                >
                  {command.replace("-", " ")}
                </button>
              ))}
            {!action.availableCommands.some((c) => actionable.has(c)) ? (
              <p className="text-sm text-stone-400">
                No lifecycle commands available.
              </p>
            ) : null}
          </div>
          {message ? (
            <p role="alert" className="mt-4 text-sm text-amber-300">
              {message}
            </p>
          ) : null}
          {reasonOperation ? <form className="mt-5 rounded-2xl border border-stone-700 bg-stone-900 p-4" onSubmit={(event) => { event.preventDefault(); run(reasonOperation, reason); }}><label className="block text-sm font-semibold" htmlFor="action-reason">Reason for {reasonOperation.replaceAll("-", " ")}</label><textarea id="action-reason" required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-3 min-h-24 w-full rounded-xl border border-stone-600 bg-stone-950 p-3 text-sm text-white"/><div className="mt-3 flex gap-3"><button disabled={pending || !reason.trim()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50">Confirm</button><button type="button" onClick={() => { setReasonOperation(null); setReason(""); }} className="rounded-xl border border-stone-600 px-4 py-2 text-sm">Cancel</button></div></form> : null}
        </section>
      </div>
    </main>
  );
}
