import { notFound } from "next/navigation";
import { requireReleaseControlAccess } from "@/features/furnishing-studio/server-release-control-access";
import { createClient } from "@/lib/supabase/server";
import { FurnishingHeader } from "@/components/furnishing/furnishing-navigation";
export default async function ControlEventPage({
  params,
}: PageProps<"/admin/furnishing/release-controls/history/[eventId]">) {
  await requireReleaseControlAccess("view");
  const { eventId } = await params;
  const { data } = await (await createClient())
    .from("furnishing_activation_audit_events")
    .select(
      "id,event_type,workspace_id,actor_id,actor_role,reason_code,correlation_id,idempotency_key,policy_version,before_state,after_state,safe_metadata,occurred_at",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!data) notFound();
  return (
    <main className="space-y-8 px-4 pb-12 sm:px-6">
      <FurnishingHeader
        title="Control event"
        description="Immutable technical evidence for one governed control action."
        current="release-controls"
      />
      <section className="rounded-2xl border bg-white p-5">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Item label="Event" value={data.event_type} />
          <Item label="Scope" value={data.workspace_id || "Global"} />
          <Item label="Actor role" value={data.actor_role || "System"} />
          <Item label="Reason" value={data.reason_code} />
          <Item label="Policy" value={data.policy_version} />
          <Item
            label="Timestamp"
            value={new Date(data.occurred_at).toLocaleString()}
          />
          <Item label="Correlation" value={data.correlation_id} />
          <Item
            label="Idempotency identity"
            value={data.idempotency_key || "Not recorded"}
          />
        </dl>
        <details className="mt-6 rounded-xl bg-stone-50 p-4">
          <summary className="cursor-pointer font-semibold">
            Technical state evidence
          </summary>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(
              {
                before: data.before_state,
                after: data.after_state,
                metadata: data.safe_metadata,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </section>
    </main>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
