import Link from "next/link";
import { requireReleaseControlAccess } from "@/features/furnishing-studio/server-release-control-access";
import { createClient } from "@/lib/supabase/server";
import { FurnishingHeader } from "@/components/furnishing/furnishing-navigation";
export default async function ControlHistoryPage() {
  await requireReleaseControlAccess("view");
  const db = await createClient();
  const { data } = await db
    .from("furnishing_activation_audit_events")
    .select(
      "id,event_type,workspace_id,actor_role,reason_code,correlation_id,policy_version,before_state,after_state,occurred_at",
    )
    .order("occurred_at", { ascending: false })
    .limit(100);
  return (
    <main className="space-y-8 px-4 pb-12 sm:px-6">
      <FurnishingHeader
        title="Control history"
        description="Read-only projection of immutable release-control evidence."
        current="release-controls"
      />
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50">
              <tr>
                <Th>Event</Th>
                <Th>Scope</Th>
                <Th>Actor</Th>
                <Th>Reason</Th>
                <Th>Policy</Th>
                <Th>Time</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data ?? []).map((event) => (
                <tr key={event.id}>
                  <Td>
                    <Link
                      className="font-semibold underline"
                      href={`/admin/furnishing/release-controls/history/${event.id}`}
                    >
                      {event.event_type.replaceAll("_", " ")}
                    </Link>
                  </Td>
                  <Td>{event.workspace_id ? "Workspace" : "Global"}</Td>
                  <Td>{event.actor_role || "System"}</Td>
                  <Td>{event.reason_code}</Td>
                  <Td>{event.policy_version}</Td>
                  <Td>{new Date(event.occurred_at).toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
