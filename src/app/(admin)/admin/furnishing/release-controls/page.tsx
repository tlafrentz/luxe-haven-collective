import Link from "next/link";
import { requireReleaseControlAccess } from "@/features/furnishing-studio/server-release-control-access";
import { createClient } from "@/lib/supabase/server";
import { FurnishingHeader } from "@/components/furnishing/furnishing-navigation";
import { releaseSafetyState } from "@/features/furnishing-studio/release-controls";
import GlobalEmergencyControl from "./global-emergency-control";

export default async function ReleaseControlsPage() {
  await requireReleaseControlAccess("view");
  const db = await createClient();
  const [{ data: releaseData }, { data: controlled }, { data: recent }] =
    await Promise.all([
      db.rpc("resolve_furnishing_activation_control", {
        p_target: "global",
        p_target_id: "global",
        p_tenant_id: null,
      }),
      db
        .from("furnishing_activation_workspaces")
        .select(
          "workspace_id,enabled,kill_switch,cohort,expires_at,revoked_at,optimistic_version,updated_at",
        )
        .order("updated_at", { ascending: false }),
      db
        .from("furnishing_activation_audit_events")
        .select("id,event_type,workspace_id,reason_code,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(8),
    ]);
  const release = releaseData as null | {
    status?: string;
    state?: string;
    version?: number;
    globalKillSwitch?: boolean;
    policyVersion?: string;
  };
  const safety = releaseSafetyState({
    globalKillSwitch: release?.globalKillSwitch !== false,
    suspended: release?.state === "paused",
    recoveryRequired: false,
    available: release?.status === "found",
  });
  return (
    <main className="space-y-8 px-4 pb-12 sm:px-6">
      <FurnishingHeader
        title="Release controls"
        description="Guide the controlled furnishing release through verified, reversible capability steps."
        current="release-controls"
      />
      <section
        aria-labelledby="release-summary"
        className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
      >
        <h2 id="release-summary" className="text-lg font-semibold">
          Current release summary
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Environment" value="Production" />
          <Summary
            label="Release mode"
            value={
              release?.state === "internal"
                ? "Internal"
                : release?.state === "paused"
                  ? "Suspended"
                  : "Disabled"
            }
          />
          <Summary label="Safety state" value={safety} />
          <Summary label="Public activation" value="Unavailable" />
          <Summary label="External execution" value="Unavailable" />
          <Summary label="Governing policy" value="FS-008A bounded release" />
          <Summary
            label="Authoritative version"
            value={String(release?.version ?? "Unavailable")}
          />
          <Summary
            label="Global safety control"
            value={release?.globalKillSwitch === false ? "Lifted" : "Engaged"}
          />
        </dl>
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
          <strong>
            Capability activation permits separately authorized workflows. It
            does not execute them.
          </strong>{" "}
          No retailer request, order, payment, notification, delivery, or
          installation effect becomes available here.
        </p>
      </section>
      <section aria-labelledby="controlled-workspaces">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="controlled-workspaces" className="text-2xl font-semibold">
              Controlled workspace
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Choose only from the server-authoritative controlled cohort.
            </p>
          </div>
          <Link
            href="/admin/furnishing/release-controls/history"
            className="min-h-11 rounded-xl border px-4 py-2.5 font-semibold"
          >
            View control history
          </Link>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(controlled ?? []).length ? (
            (controlled ?? []).map((row) => {
              const active =
                row.cohort &&
                !row.revoked_at &&
                (!row.expires_at || new Date(row.expires_at) > new Date());
              return (
                <article
                  key={row.workspace_id}
                  className="rounded-2xl border bg-white p-5"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Controlled workspace</h3>
                      <p className="mt-1 text-sm text-stone-600">
                        {active
                          ? "Active controlled cohort"
                          : row.revoked_at
                            ? "Cohort revoked"
                            : "Cohort expired"}
                      </p>
                    </div>
                    <span className="h-fit rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">
                      {row.kill_switch
                        ? "Protected"
                        : row.enabled
                          ? "Active"
                          : "Disabled"}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <Summary
                      label="Expiration"
                      value={
                        row.expires_at
                          ? new Date(row.expires_at).toLocaleDateString()
                          : "Not set"
                      }
                    />
                    <Summary
                      label="Version"
                      value={String(row.optimistic_version)}
                    />
                  </dl>
                  <Link
                    href={`/admin/furnishing/release-controls/workspaces/${row.workspace_id}`}
                    className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 py-2 font-semibold text-white"
                  >
                    Open release sequence
                  </Link>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed p-8">
              <h3 className="font-semibold">No controlled workspace</h3>
              <p className="mt-2 text-sm text-stone-600">
                An eligible, active controlled designation is required before
                bounded capabilities can be enabled.
              </p>
            </div>
          )}
        </div>
      </section>
      <section
        aria-labelledby="recent-history"
        className="rounded-2xl border bg-white p-5"
      >
        <h2 id="recent-history" className="text-xl font-semibold">
          Recent control history
        </h2>
        <ol className="mt-4 divide-y">
          {(recent ?? []).map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap justify-between gap-3 py-3 text-sm"
            >
              <span>
                <strong>{humanEvent(event.event_type)}</strong> ·{" "}
                {event.reason_code}
              </span>
              <time dateTime={event.occurred_at}>
                {new Date(event.occurred_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      </section>
      <GlobalEmergencyControl
        releaseId={String(
          (releaseData as { targetId?: string } | null)?.targetId ?? "global",
        )}
        version={Number(release?.version ?? 0)}
        engaged={release?.globalKillSwitch !== false}
        suspended={release?.state === "paused"}
      />
    </main>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-stone-950">{value}</dd>
    </div>
  );
}
function humanEvent(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
