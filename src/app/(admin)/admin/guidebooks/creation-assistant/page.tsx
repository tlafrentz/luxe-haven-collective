import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listCustomerWorkspacesAction,
  listWorkspacePropertiesAction,
} from "@/app/actions/guidebook-admin-creation";
import {
  cancelAssistantJobAction,
  cleanupControlledGuidebookPropertyAction,
  createAssistantJobAction,
  enqueueAssistantExtractionAction,
  enqueueAssistantGenerationAction,
  enqueueAssistantRegenerationAction,
  getAssistantInternalProjection,
  getControlledProvisioningProjection,
  provisionControlledGuidebookPropertyAction,
  restoreAssistantRevisionAction,
  reviewAssistantFactAction,
  uploadAssistantSourceAction,
} from "@/app/actions/guidebook-creation-assistant";
import { readCreationCapability } from "@/features/guidebook-creation-assistant/runtime";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    workspace?: string;
    property?: string;
    job?: string;
  }>;
}) {
  const q = await searchParams,
    { user } = await requireRole(["admin"]),
    provisioning = await getControlledProvisioningProjection(),
    customers = await listCustomerWorkspacesAction(),
    properties = q.workspace
      ? await listWorkspacePropertiesAction(q.workspace)
      : [],
    capability =
      q.workspace && q.property
        ? await readCreationCapability({
            workspaceId: q.workspace,
            propertyId: q.property,
            actorId: user.id,
          })
        : null,
    projection = q.job ? await getAssistantInternalProjection(q.job) : null,
    db = createAdminClient(),
    relation =
      "artifact:guidebook_library_artifacts!guidebook_library_versions_artifact_id_fkey",
    { data: templates } = await db
      .from("guidebook_library_versions")
      .select(`id,version_number,${relation}!inner(name,artifact_type,status)`)
      .in("status", ["approved", "published"])
      .eq("artifact.artifact_type", "template")
      .eq("artifact.status", "published");
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-700">
          Internal controlled verification
        </p>
        <h1 className="mt-2 text-4xl font-semibold">
          Guidebook Creation Assistant
        </h1>
        <p className="mt-2 text-stone-600">
          This route is not linked from the customer interface. AI creates a
          draft; humans review; nothing auto-publishes.
        </p>
      </header>
      {provisioning.available ? (
        <ControlledPropertyProvisioning projection={provisioning} />
      ) : null}
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">1. Authorized context</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`?workspace=${c.id}`}
                className="block rounded-lg border p-3"
              >
                {c.name}
              </Link>
            ))}
          </div>
          <div>
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`?workspace=${q.workspace}&property=${p.id}`}
                className="block rounded-lg border p-3"
              >
                {p.name} · {p.location}
              </Link>
            ))}
          </div>
        </div>
      </section>
      {capability ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-semibold">Capability gate</h2>
          <p
            className={
              capability.internalAvailable
                ? "mt-3 text-emerald-700"
                : "mt-3 text-amber-700"
            }
          >
            {capability.internalAvailable
              ? "Internal vertical-slice access ready"
              : "Fail closed"}
          </p>
          {capability.reasons.length ? (
            <p className="mt-2 text-sm">
              Blocked: {capability.reasons.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}
      {capability?.internalAvailable && !projection ? (
        <form
          action={createAssistantJobAction}
          className="rounded-2xl border bg-white p-6"
        >
          <input type="hidden" name="workspaceId" value={q.workspace} />
          <input type="hidden" name="propertyId" value={q.property} />
          <input
            type="hidden"
            name="idempotencyKey"
            value={crypto.randomUUID()}
          />
          <label className="block font-semibold">
            Approved template
            <select
              name="templateVersionId"
              required
              className="mt-2 min-h-11 w-full rounded-lg border px-3"
            >
              {(templates ?? []).map((t) => (
                <option key={String(t.id)} value={String(t.id)}>
                  {String(
                    (
                      t.artifact as unknown as {
                        name: string;
                      }
                    ).name,
                  )}{" "}
                  v{String(t.version_number)}
                </option>
              ))}
            </select>
          </label>
          <button className="mt-4 rounded-lg bg-stone-950 px-5 py-3 font-semibold text-white">
            Create internal job
          </button>
        </form>
      ) : null}
      {projection ? <Workspace projection={projection} /> : null}
    </main>
  );
}
function ControlledPropertyProvisioning({
  projection,
}: {
  projection: Extract<
    Awaited<ReturnType<typeof getControlledProvisioningProjection>>,
    { available: true }
  >;
}) {
  const run = projection.runs[0];
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
      <h2 className="font-semibold">
        Controlled Guidebook property provisioning
      </h2>
      <p className="mt-2 text-sm text-stone-700">
        Canonical private property creation for the selected customer and active
        Guidebook grant. This does not create HPM enrollment or public listing
        state.
      </p>
      {run ? (
        <div className="mt-5 space-y-5">
          {projection.customers.flatMap((customer) =>
            customer.entitlements.map((entitlement) => (
              <form
                action={provisionControlledGuidebookPropertyAction}
                key={String(entitlement.id)}
                className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3"
              >
                <input
                  type="hidden"
                  name="customerAccountId"
                  value={String(customer.id)}
                />
                <input
                  type="hidden"
                  name="workspaceId"
                  value={String(customer.tenant_id)}
                />
                <input
                  type="hidden"
                  name="entitlementId"
                  value={String(entitlement.id)}
                />
                <input
                  type="hidden"
                  name="expectedCustomerStatus"
                  value="active"
                />
                <input
                  type="hidden"
                  name="expectedEntitlementRevision"
                  value={String(entitlement.revision)}
                />
                <input
                  type="hidden"
                  name="verificationRunId"
                  value={String(run.id)}
                />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={`controlled-guidebook-property:${String(run.id)}:${String(entitlement.id)}`}
                />
                <p className="md:col-span-3 text-sm">
                  <strong>{String(customer.display_name)}</strong> · grant{" "}
                  {String(entitlement.id)} · run {String(run.id)}
                </p>
                <label className="text-sm font-semibold">
                  Internal name
                  <input
                    name="internalName"
                    required
                    defaultValue="Creation Assistant Controlled Property"
                    className="mt-1 min-h-11 w-full rounded-lg border px-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Public display name
                  <input
                    name="publicDisplayName"
                    required
                    defaultValue="Controlled Guidebook Property"
                    className="mt-1 min-h-11 w-full rounded-lg border px-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Property type
                  <input
                    name="propertyType"
                    required
                    defaultValue="vacation_rental"
                    className="mt-1 min-h-11 w-full rounded-lg border px-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  City
                  <input
                    name="city"
                    required
                    defaultValue="Verification City"
                    className="mt-1 min-h-11 w-full rounded-lg border px-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Region
                  <input
                    name="region"
                    required
                    defaultValue="TX"
                    className="mt-1 min-h-11 w-full rounded-lg border px-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Time zone
                  <input
                    name="timeZone"
                    required
                    defaultValue="America/Chicago"
                    className="mt-1 min-h-11 w-full rounded-lg border px-3"
                  />
                </label>
                <label className="text-sm font-semibold md:col-span-2">
                  Reason
                  <input
                    name="reason"
                    required
                    defaultValue="Controlled Creation Assistant production verification"
                    className="mt-1 min-h-11 w-full rounded-lg border px-3"
                  />
                </label>
                <button className="min-h-11 self-end rounded-lg bg-stone-950 px-4 font-semibold text-white">
                  Provision controlled property
                </button>
              </form>
            )),
          )}
          {projection.properties.map((property) => {
            const allocation = Array.isArray(
              property.property_entitlement_allocations,
            )
              ? property.property_entitlement_allocations.find(
                  (value) => value.status === "reserved",
                )
              : null;
            return (
              <form
                action={cleanupControlledGuidebookPropertyAction}
                key={String(property.id)}
                className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[1fr_2fr_auto]"
              >
                <input
                  type="hidden"
                  name="propertyId"
                  value={String(property.id)}
                />
                <input
                  type="hidden"
                  name="workspaceId"
                  value={String(property.owner_id)}
                />
                <input
                  type="hidden"
                  name="expectedAllocationRevision"
                  value={String(allocation?.revision ?? 0)}
                />
                <p className="text-sm">
                  <strong>{String(property.name)}</strong>
                  <br />
                  <span className="font-mono text-xs">
                    {String(property.id)}
                  </span>
                </p>
                <input
                  name="reason"
                  required
                  defaultValue="Controlled production verification cleanup complete"
                  className="min-h-11 rounded-lg border px-3"
                />
                <button
                  disabled={!allocation}
                  className="min-h-11 rounded-lg border px-4 font-semibold disabled:opacity-50"
                >
                  Clean up exactly
                </button>
              </form>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-amber-800">
          No active controlled production-verification run is available.
        </p>
      )}
    </section>
  );
}
function Workspace({
  projection,
}: {
  projection: NonNullable<
    Awaited<ReturnType<typeof getAssistantInternalProjection>>
  >;
}) {
  const job = projection.job as Record<string, unknown>,
    jobId = String(job.id),
    workspaceId = String(job.workspace_id),
    propertyId = String(job.property_id),
    revision = Number(job.resulting_draft_revision ?? 0);
  return (
    <>
      <section className="rounded-2xl border bg-white p-6">
        <div className="flex justify-between">
          <h2 className="font-semibold">Job · {String(job.state)}</h2>
          <span className="text-sm">Stage: {String(job.current_stage)}</span>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Correlation: {String(job.correlation_id)}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={uploadAssistantSourceAction}>
            <input type="hidden" name="jobId" value={jobId} />
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.docx,.txt,image/jpeg,image/png,image/webp"
            />
            <button className="rounded-lg border px-4 py-2">
              Upload source
            </button>
          </form>
          <form action={enqueueAssistantExtractionAction}>
            <input type="hidden" name="jobId" value={jobId} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`extract:${jobId}`}
            />
            <button className="rounded-lg border px-4 py-2">
              Queue extraction
            </button>
          </form>
          <form action={cancelAssistantJobAction}>
            <input type="hidden" name="jobId" value={jobId} />
            <button className="rounded-lg border px-4 py-2">Cancel</button>
          </form>
        </div>
        <ul className="mt-4 text-sm">
          {projection.sources.map((s) => (
            <li key={String(s.id)}>
              {String(s.original_filename)} · {String(s.extraction_status)}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">2. Review facts and sources</h2>
        <div className="mt-4 space-y-3">
          {projection.facts.map((f) => (
            <form
              action={reviewAssistantFactAction}
              key={String(f.id)}
              className="rounded-lg border p-4"
            >
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="factId" value={String(f.id)} />
              <p className="font-semibold">
                {String(f.category)} · {String(f.field_key)}
              </p>
              <p className="text-sm">
                {String(f.display_value ?? "Missing")} ·{" "}
                {String(f.review_status)} · source{" "}
                {String(f.source_location ?? "—")}
              </p>
              <input
                name="correctedValue"
                placeholder="Correction, if needed"
                className="mt-2 min-h-11 rounded-lg border px-3"
              />
              {f.high_risk ? (
                <label className="ml-3 text-sm">
                  <input type="checkbox" name="confirmHighRisk" value="true" />{" "}
                  I confirm this operational fact
                </label>
              ) : null}
              <button
                name="decision"
                value="confirmed"
                className="ml-3 rounded-lg border px-3 py-2"
              >
                Accept
              </button>
              <button
                name="decision"
                value="rejected"
                className="ml-2 rounded-lg border px-3 py-2"
              >
                Reject
              </button>
            </form>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">3. Generate and resume</h2>
        <form action={enqueueAssistantGenerationAction} className="mt-3">
          <input type="hidden" name="jobId" value={jobId} />
          <input
            type="hidden"
            name="idempotencyKey"
            value={`generate:${jobId}`}
          />
          <input
            name="title"
            defaultValue="Guest Guide"
            className="min-h-11 rounded-lg border px-3"
          />
          <button className="ml-3 rounded-lg bg-stone-950 px-4 py-3 text-white">
            Queue draft generation
          </button>
        </form>
        <ul className="mt-4 text-sm">
          {projection.work.map((w) => (
            <li key={String(w.id)}>
              {String(w.stage)} · {String(w.status)} · attempts{" "}
              {String(w.attempts)}
            </li>
          ))}
        </ul>
        {job.guidebook_id ? (
          <Link
            href={`/admin/guidebooks/${String(job.guidebook_id)}/edit`}
            className="mt-4 inline-flex rounded-lg bg-emerald-900 px-5 py-3 font-semibold text-white"
          >
            Open saved draft in shared Builder →
          </Link>
        ) : null}
      </section>
      {job.guidebook_id ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-semibold">4. Regenerate or restore</h2>
          <form
            action={enqueueAssistantRegenerationAction}
            className="mt-3 flex gap-2"
          >
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="expectedRevision" value={revision} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`regen:${jobId}:${revision}`}
            />
            <input
              name="sectionId"
              required
              placeholder="Stable Builder section ID"
              className="min-h-11 rounded-lg border px-3"
            />
            <button className="rounded-lg border px-4">
              Queue section regeneration
            </button>
          </form>
          {projection.artifacts.map((a) => (
            <form
              action={restoreAssistantRevisionAction}
              key={String(a.id)}
              className="mt-2"
            >
              <input type="hidden" name="jobId" value={jobId} />
              <input
                type="hidden"
                name="sourceRevision"
                value={String(a.draft_revision)}
              />
              <input type="hidden" name="expectedRevision" value={revision} />
              <button className="rounded-lg border px-4 py-2">
                Restore revision {String(a.draft_revision)} as a new draft
              </button>
            </form>
          ))}
        </section>
      ) : null}
      <p className="text-xs text-stone-500">
        Workspace {workspaceId} · Property {propertyId}
      </p>
    </>
  );
}
