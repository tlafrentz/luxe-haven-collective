"use client";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { addRoomPackageItemAction } from "@/app/actions/furnishing-packages";
type Option = { id: string; label: string };
type State = { ok: boolean; message: string };
async function act(_: State, form: FormData): Promise<State> {
  try { await addRoomPackageItemAction(form); return { ok: true, message: "Composition item added." }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "ROOM_PACKAGE_COMPOSITION_FAILED" }; }
}
function Submit() { const { pending } = useFormStatus(); return <button disabled={pending} className="inline-flex rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Adding…" : "Add requirement"}</button>; }
export function RoomPackageCompositionControl({ contextId, requirements, rules, products }: { contextId: string; requirements: Option[]; rules: Option[]; products: Option[] }) {
  const router = useRouter(), [state, action] = useActionState(act, { ok: false, message: "" });
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  const field = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm";
  return <form action={action} className="mt-4 grid gap-3 md:grid-cols-5">
    <input type="hidden" name="commandContextId" value={contextId} />
    <select required name="requirementId" className={field}><option value="">Requirement</option>{requirements.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select>
    <select required name="quantityRuleId" className={field}><option value="">Quantity rule</option>{rules.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select>
    <select name="priority" className={field}><option value="required">required</option><option value="recommended">recommended</option><option value="optional">optional</option></select>
    <select name="productId" className={field}><option value="">No product yet</option>{products.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select>
    <input type="hidden" name="substitutionPolicy" value="allowed" /><Submit />
    <p role="status" className={`${state.ok ? "text-emerald-700" : "text-red-700"} text-sm md:col-span-5`}>{state.message}</p>
  </form>;
}
