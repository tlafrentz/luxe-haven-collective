"use client";

import { useActionState } from "react";
import {
  approveControlledOfferAction,
  approveControlledProductAction,
  approveControlledRequirementAction,
  assignControlledOfferAction,
  submitControlledRequirementAction,
  approvePropertyPackageAction,
  approveRoomPackageAction,
  validatePropertyPackageAction,
  validateRoomPackageAction,
  createControlledAlternateOfferAction,
  submitProductReviewAction,
  requestProductChangesAction,
  retireProductAction,
  type FurnishingGovernanceState,
} from "@/app/actions/furnishing-catalog-governance";

const button = "rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const field = "rounded-xl border px-3 py-2 text-sm";

function Status({ state }: { state: FurnishingGovernanceState }) {
  return <p role="status" aria-live="polite" className={`min-h-5 text-sm ${state.ok === false ? "text-red-700" : "text-emerald-700"}`}>{state.message ?? ""}</p>;
}

export function CreateControlledAlternateOfferControl({ contextId }: Readonly<{ contextId: string }>) {
  const [state, action, pending] = useActionState(createControlledAlternateOfferAction, {});
  return <form action={action} className="space-y-2"><input type="hidden" name="commandContextId" value={contextId}/><button className={button} disabled={pending}>{pending ? "Creating…" : "Create controlled alternate offer"}</button><Status state={state}/></form>;
}

export function PackageGovernanceControl({ kind, validationContextId, approvalContextId }: Readonly<{ kind: "room" | "property"; validationContextId: string; approvalContextId: string }>) {
  const validate = kind === "room" ? validateRoomPackageAction : validatePropertyPackageAction;
  const approve = kind === "room" ? approveRoomPackageAction : approvePropertyPackageAction;
  const [validationState, validationAction, validating] = useActionState(validate, {});
  const [approvalState, approvalAction, approving] = useActionState(approve, {});
  return <div className="grid gap-3 sm:grid-cols-2"><form action={validationAction} className="space-y-2"><input type="hidden" name="commandContextId" value={validationContextId}/><button className={button} disabled={validating}>{validating ? "Validating…" : "Validate governed package"}</button><Status state={validationState}/></form><form action={approvalAction} className="space-y-2"><input type="hidden" name="commandContextId" value={approvalContextId}/><input required minLength={3} name="reason" aria-label="Governed approval reason" className={field} placeholder="Approval reason"/><button className={button} disabled={approving}>{approving ? "Approving…" : "Approve governed package"}</button><Status state={approvalState}/></form></div>;
}

export function RequirementGovernanceControl({ submitContextId, approvalContextId, status }: Readonly<{ submitContextId: string; approvalContextId: string; status: string }>) {
  const [submitState, submitAction, submitting] = useActionState(submitControlledRequirementAction, {});
  const [approvalState, approvalAction, approving] = useActionState(approveControlledRequirementAction, {});
  if (status === "approved") return <p className="text-sm font-semibold text-emerald-700">Governed approval complete</p>;
  if (status === "draft") return <form action={submitAction} className="space-y-1"><input type="hidden" name="commandContextId" value={submitContextId}/><button className={button} disabled={submitting}>{submitting ? "Submitting…" : "Submit for review"}</button><Status state={submitState}/></form>;
  return <form action={approvalAction} className="space-y-1"><input type="hidden" name="commandContextId" value={approvalContextId}/><input required minLength={3} name="reason" className={field} placeholder="Approval reason"/><button className={button} disabled={approving}>{approving ? "Approving…" : "Approve requirement"}</button><Status state={approvalState}/></form>;
}

export function CatalogApprovalControl({ contextId, targetType, label }: Readonly<{ contextId: string; targetType: "product" | "offer"; label: string }>) {
  const serverAction = targetType === "product" ? approveControlledProductAction : approveControlledOfferAction;
  const [state, action, pending] = useActionState(serverAction, {});
  return <form action={action} className="space-y-2 rounded-xl border p-3">
    <input type="hidden" name="commandContextId" value={contextId} />
    <label className="block text-sm font-medium">Approval reason<input required minLength={3} name="reason" className={`${field} mt-1 w-full`} /></label>
    <button className={button} disabled={pending}>{pending ? "Approving…" : label}</button>
    <Status state={state} />
  </form>;
}

export function ProductReviewControl({ operation, contextId, revision }: { operation: "submit" | "changes_requested" | "retire"; contextId: string; revision: number }) {
  const serverAction = operation === "submit" ? submitProductReviewAction : operation === "retire" ? retireProductAction : requestProductChangesAction;
  const [state, action, pending] = useActionState(serverAction, {});
  const needsReason = operation !== "submit";
  const label = operation === "submit" ? "Submit for review" : operation === "retire" ? "Retire product" : "Request changes";
  return <form action={action} className="space-y-2"><input type="hidden" name="commandContextId" value={contextId}/><input type="hidden" name="revision" value={revision}/>{needsReason ? <label className="block text-sm font-medium">Reason<input required minLength={3} name="reason" className={`${field} mt-1 w-full`} /></label> : null}<button className={`${button} ${operation === "retire" ? "border-red-300 text-red-800" : ""}`} disabled={pending}>{pending ? "Saving…" : label}</button><Status state={state}/></form>;
}

export function OfferAssignmentControl({ contextId }: Readonly<{ contextId: string }>) {
  const [state, action, pending] = useActionState(assignControlledOfferAction, {});
  return <form action={action} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-3">
    <input type="hidden" name="commandContextId" value={contextId} />
    <label className="text-sm font-medium">Assignment<select name="role" className={`${field} mt-1 w-full`}><option value="preferred">Preferred</option><option value="alternate">Alternate</option></select></label>
    <label className="text-sm font-medium">Rank<input required min={1} type="number" name="rank" defaultValue={1} className={`${field} mt-1 w-full`} /></label>
    <button className={`${button} self-end`} disabled={pending}>{pending ? "Assigning…" : "Assign governed offer"}</button>
    <div className="sm:col-span-3"><Status state={state} /></div>
  </form>;
}
