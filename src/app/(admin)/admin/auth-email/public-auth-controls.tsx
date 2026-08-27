"use client";

import { useFormStatus } from "react-dom";
import { setPublicAuthModeAction } from "@/app/actions/auth-email-operations";

function ModeButton({ mode, current }: Readonly<{ mode: "closed" | "invite_only" | "broad_beta"; current: string }>) {
  const { pending } = useFormStatus();
  return <button disabled={pending || mode===current} className={`rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${mode==="closed" ? "bg-red-700 text-white" : "border bg-white"}`}>{pending ? "Applying…" : mode.replaceAll("_", " ")}</button>;
}
export function PublicAuthControls({ mode, version }: Readonly<{ mode: string; version: number }>) {
  return <div className="space-y-5">
    <p role="status" aria-live="polite" className="text-sm">Current mode: <strong>{mode.replaceAll("_", " ")}</strong>. Emergency close does not terminate existing sessions or disable Admin invitations.</p>
    {(["closed","invite_only","broad_beta"] as const).map(target => <form key={target} action={setPublicAuthModeAction} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
      <input type="hidden" name="targetMode" value={target}/><input type="hidden" name="expectedVersion" value={version}/>
      <input type="hidden" name="correlationId" value={crypto.randomUUID()}/><input type="hidden" name="idempotencyKey" value={`beta-email-mode:${crypto.randomUUID()}`}/>
      <label className="text-sm font-medium">Confirmation<input name="confirmation" required pattern="CONFIRM" placeholder="Type CONFIRM" className="mt-1 block w-full rounded-lg border px-3 py-2"/></label>
      <label className="text-sm font-medium">Reason<input name="reason" required minLength={8} maxLength={500} className="mt-1 block w-full rounded-lg border px-3 py-2"/></label>
      <ModeButton mode={target} current={mode}/>
    </form>)}
  </div>;
}
