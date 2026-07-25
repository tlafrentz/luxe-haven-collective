"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { acceptTeamInvitationAction, type TeamActionResult } from "@/app/actions/workspace-team-access";

export function AcceptWorkspaceInvitation({ workspaceId, token }: Readonly<{ workspaceId?: string; token?: string }>) {
  const [result, setResult] = useState<TeamActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  if (!workspaceId || !token) return <p className="text-sm text-amber-900">This invitation link is incomplete.</p>;
  return <div><div aria-live="polite" role="status">{result ? <p className={result.ok?"text-emerald-800":"text-red-700"}>{result.message}</p> : <p className="text-sm text-stone-600">Confirm while signed in with the invited email address. Access is not granted until you accept.</p>}</div>{result?.ok ? <Link href="/dashboard" className="mt-5 inline-flex rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white">Open workspace</Link> : <button disabled={pending} onClick={() => startTransition(async()=>setResult(await acceptTeamInvitationAction({workspaceId,token,commandId:crypto.randomUUID()})))} className="mt-5 min-h-11 rounded-full bg-stone-950 px-6 text-sm font-semibold text-white disabled:opacity-40">{pending?"Accepting…":"Accept invitation"}</button>}</div>;
}
