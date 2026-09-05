"use client";
import { useActionState } from "react";
import {
  executeAutomationWorkspaceCommand,
  type AutomationCommandResult,
} from "@/app/actions/automation-workspace";
import type { AutomationExperienceCommand } from "../application/automation-workspace-projections";

const initialState: AutomationCommandResult = { ok: false, message: "" };

export function AutomationCommandForm({
  command,
  interactive,
}: {
  command: AutomationExperienceCommand;
  interactive: boolean;
}) {
  const [state, action, pending] = useActionState(
    executeAutomationWorkspaceCommand,
    initialState,
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="command" value={command.type} />
      <input type="hidden" name="targetId" value={command.targetId} />
      <input
        type="hidden"
        name="expectedVersion"
        value={command.expectedVersion}
      />
      <input
        type="hidden"
        name="idempotencyKey"
        value={`au001d:${command.type}:${command.targetId}:v${command.expectedVersion}`}
      />
      {command.reason.required ? (
        <label className="block text-sm font-semibold">
          Reason
          <textarea
            name="reason"
            required
            minLength={command.reason.minimumLength}
            maxLength={command.reason.maximumLength}
            className="mt-1 min-h-24 w-full rounded-xl border p-3"
          />
        </label>
      ) : null}
      <button
        type="submit"
        disabled={!interactive || pending}
        className="min-h-11 rounded-full bg-stone-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {pending
          ? "Submitting…"
          : `Confirm ${command.label.toLocaleLowerCase()}`}
      </button>
      {!interactive ? (
        <p className="text-xs text-stone-500">
          Interaction is disabled for this cohort.
        </p>
      ) : null}
      {!state.ok && state.message ? (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
