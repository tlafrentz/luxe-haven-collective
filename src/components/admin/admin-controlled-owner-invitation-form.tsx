"use client";

import { useState, useTransition } from "react";
import {
  inviteControlledWorkspaceOwnerAction,
  type AdminWorkspaceInvitationResult,
} from "@/app/actions/admin-workspace-invitations";

export function AdminControlledOwnerInvitationForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminWorkspaceInvitationResult | null>(
    null,
  );

  return (
    <form
      className="mt-5 grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (
          !window.confirm(
            "Send one governed Owner invitation to this exact workspace?",
          )
        )
          return;
        setResult(null);
        startTransition(async () => {
          setResult(
            await inviteControlledWorkspaceOwnerAction({
              workspaceId: String(form.get("workspaceId") ?? ""),
              email: String(form.get("email") ?? ""),
              reason: String(form.get("reason") ?? ""),
              correlationId: crypto.randomUUID(),
              idempotencyKey: `admin-owner-invite:${crypto.randomUUID()}`,
              confirmation: "INVITE_CONTROLLED_OWNER",
            }),
          );
        });
      }}
    >
      <label className="grid gap-2 text-sm font-semibold">
        Controlled workspace ID
        <input
          name="workspaceId"
          required
          className="min-h-11 rounded-lg border px-3 font-normal"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Controlled owner email
        <input
          name="email"
          type="email"
          required
          className="min-h-11 rounded-lg border px-3 font-normal"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold md:col-span-2">
        Auditable reason
        <textarea
          name="reason"
          required
          minLength={8}
          maxLength={500}
          className="min-h-24 rounded-lg border p-3 font-normal"
        />
      </label>
      <div className="flex flex-wrap items-center gap-4 md:col-span-2">
        <button
          disabled={pending}
          className="min-h-11 rounded-lg bg-stone-950 px-5 font-semibold text-white disabled:opacity-50"
        >
          {pending
            ? "Sending controlled invitation…"
            : "Invite controlled Owner"}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={
            result?.ok ? "text-sm text-emerald-800" : "text-sm text-red-700"
          }
        >
          {result?.message ??
            "No invitation is sent until you review the browser confirmation."}
        </p>
      </div>
    </form>
  );
}
