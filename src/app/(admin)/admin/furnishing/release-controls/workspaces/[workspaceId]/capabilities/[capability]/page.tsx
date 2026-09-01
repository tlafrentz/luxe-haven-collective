import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReleaseControlAccess } from "@/features/furnishing-studio/server-release-control-access";
import { createClient } from "@/lib/supabase/server";
import { FurnishingHeader } from "@/components/furnishing/furnishing-navigation";
import {
  RELEASE_CAPABILITIES,
  capabilityLabel,
  rollbackBlocker,
  type CapabilityProjection,
  type ReleaseCapability,
} from "@/features/furnishing-studio/release-controls";
import ControlAction from "../../control-action";

export default async function CapabilityDetailPage({
  params,
}: PageProps<"/admin/furnishing/release-controls/workspaces/[workspaceId]/capabilities/[capability]">) {
  const { workspaceId, capability: raw } = await params;
  await requireReleaseControlAccess("view", workspaceId);
  if (!RELEASE_CAPABILITIES.includes(raw as ReleaseCapability)) notFound();
  const capability = raw as ReleaseCapability,
    db = await createClient();
  const [releaseResponse, verificationResponse, ...responses] =
    await Promise.all([
      db.rpc("resolve_furnishing_activation_control", {
        p_target: "global",
        p_target_id: "global",
        p_tenant_id: null,
      }),
      db
        .from("furnishing_activation_capabilities")
        .select("capability,verification_state"),
      ...RELEASE_CAPABILITIES.map((name) =>
        db.rpc("resolve_furnishing_activation_control", {
          p_target: "capability",
          p_target_id: name,
          p_tenant_id: workspaceId,
        }),
      ),
    ]);
  if (
    responses.some(
      ({ data }) =>
        (data as { status?: string } | null)?.status === "forbidden",
    )
  )
    notFound();
  const items: CapabilityProjection[] = RELEASE_CAPABILITIES.map(
    (name, index) => {
      const row = responses[index].data as { state?: string; version?: number };
      return {
        capability: name,
        enabled: row?.state === "internal",
        verification:
          verificationResponse.data?.find((value) => value.capability === name)
            ?.verification_state === "verified"
            ? "verified"
            : "unverified",
        version: Number(row?.version ?? 0),
      };
    },
  );
  const item = items.find((entry) => entry.capability === capability)!,
    blocker = rollbackBlocker(capability, items);
  const release = releaseResponse.data as {
    version?: number;
    policyVersion?: string;
  } | null;
  return (
    <div className="space-y-8 px-4 pb-12 sm:px-6">
      <FurnishingHeader
        title={capabilityLabel(capability)}
        description="Capability state, bounded verification, and guarded rollback details."
        current="release-controls"
      />
      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold">Authoritative state</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Item label="Capability" value={capabilityLabel(capability)} />
            <Item
              label="State"
              value={
                item.enabled ? "Enabled — verification required" : "Disabled"
              }
            />
            <Item label="Version" value={String(item.version)} />
            <Item label="External effect" value="Unavailable" />
          </dl>
          <p className="mt-5 text-sm text-stone-600">
            Verification reads the bounded capability and denial boundaries. It
            creates no furnishing lifecycle record.
          </p>
        </article>
        <article className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold">Rollback</h2>
          {blocker ? (
            <p className="mt-3 text-amber-900">Unavailable: {blocker}</p>
          ) : (
            <p className="mt-3 text-stone-600">
              This capability is eligible for guarded rollback. A reason and
              current authoritative version are required.
            </p>
          )}
          <p className="mt-4 text-sm">
            Rollback preserves all product, package, design, budget,
            procurement, delivery, installation, and audit evidence.
          </p>
          {item.enabled ? (
            <div className="mt-5">
              <ControlAction
                action="disable"
                workspaceId={workspaceId}
                capability={capability}
                releaseVersion={Number(release?.version ?? 0)}
                targetVersion={item.version}
                policyVersion={release?.policyVersion ?? "fs008a-v1"}
                disabledReason={blocker}
              />
            </div>
          ) : (
            <p className="mt-5 text-sm font-semibold">
              This capability is already disabled.
            </p>
          )}
        </article>
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Verification boundary</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          <li>Authorized bounded query succeeds.</li>
          <li>Wrong-workspace and anonymous queries fail closed.</li>
          <li>No lifecycle record is created automatically.</li>
          <li>
            No retailer, cart, order, payment, notification, delivery, or
            installation effect occurs.
          </li>
        </ul>
      </section>
      <Link
        href={`/admin/furnishing/release-controls/workspaces/${workspaceId}`}
        className="inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold"
      >
        Back to activation sequence
      </Link>
    </div>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
