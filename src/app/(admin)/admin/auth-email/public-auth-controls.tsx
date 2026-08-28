"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { setPublicAuthModeAction, type PublicAuthModeActionState } from "@/app/actions/auth-email-operations";

const initialPublicAuthModeActionState: PublicAuthModeActionState = { status: "idle" };

function ModeButton({ mode, current }: Readonly<{ mode: "closed" | "invite_only" | "broad_beta"; current: string }>) {
  const { pending } = useFormStatus();
  return <button disabled={pending || mode===current} className={`rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${mode==="closed" ? "bg-red-700 text-white" : "border bg-white"}`}>{pending ? "Applying…" : mode.replaceAll("_", " ")}</button>;
}
function ModeForm({ target, current, version }: Readonly<{ target: "closed" | "invite_only" | "broad_beta"; current: string; version: number }>) {
  const router = useRouter();
  const notice = useRef<HTMLParagraphElement>(null);
  const [reason, setReason] = useState("");
  const [state, action] = useActionState(setPublicAuthModeAction, initialPublicAuthModeActionState);
  useEffect(() => {
    if (state.status === "version_conflict") {
      router.refresh();
      notice.current?.focus();
    }
  }, [router, state.status]);
  return <form action={action} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
    <input type="hidden" name="targetMode" value={target}/><input type="hidden" name="expectedVersion" value={version}/>
    <input type="hidden" name="correlationId" value={crypto.randomUUID()}/><input type="hidden" name="idempotencyKey" value={`beta-email-mode:${crypto.randomUUID()}`}/>
    <label className="text-sm font-medium">Confirmation<input name="confirmation" required pattern="CONFIRM" placeholder="Type CONFIRM" className="mt-1 block w-full rounded-lg border px-3 py-2"/></label>
    <label className="text-sm font-medium">Reason<input name="reason" required minLength={8} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2"/></label>
    <ModeButton mode={target} current={current}/>
    {state.message ? <p ref={notice} role={state.status === "version_conflict" ? "alert" : "status"} aria-live={state.status === "version_conflict" ? "assertive" : "polite"} tabIndex={state.status === "version_conflict" ? -1 : undefined} className="md:col-span-3 rounded-lg bg-amber-50 p-3 text-sm">{state.message}{state.status === "version_conflict" && state.currentMode ? ` Current mode: ${state.currentMode.replaceAll("_", " ")}; version ${state.currentVersion}.` : ""}</p> : null}
  </form>;
}
export function PublicAuthControls({ mode, version }: Readonly<{ mode: string; version: number }>) {
  return <div className="space-y-5">
    <p role="status" aria-live="polite" className="text-sm">Current mode: <strong>{mode.replaceAll("_", " ")}</strong>. Emergency close does not terminate existing sessions or disable Admin invitations.</p>
    {(["closed","invite_only","broad_beta"] as const).map(target => <ModeForm key={target} target={target} current={mode} version={version}/>)}
  </div>;
}
