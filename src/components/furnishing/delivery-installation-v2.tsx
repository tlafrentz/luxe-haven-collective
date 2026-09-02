import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Badge, FurnishingHeader } from "./furnishing-navigation";
import {
  approveCompletion,
  createTrackingProject,
  recordInstallation,
  recordOrderEvidence,
  recordMaterialInstallationCorrection,
  recordPropertyInspection,
  recordReceipt,
} from "@/app/(admin)/admin/furnishing/installations/actions";

type Row = Record<string, unknown>;
const notice = (
  <aside
    className="rounded-2xl border border-amber-300 bg-amber-50 p-4"
    role="status"
  >
    <strong>No order or external service action is created here.</strong>
    <p className="mt-1 text-sm text-stone-700">
      Every ordered, shipped, delivered, installed, or inspected state requires
      classified evidence. Manual evidence is never shown as provider-confirmed.
    </p>
  </aside>
);

export async function TrackingLibrary() {
  await requireRole(["admin"]);
  const db = createAdminClient();
  const { data, error } = await db
    .from("furnishing_installation_projects")
    .select(
      "id,tracking_status,current_tracking_version,created_at,property_id,workspace_id,fsux7_planned_lines(planned_quantity),fsux7_tracking_exceptions(id,status,severity)",
    )
    .not("source_readiness_snapshot_id", "is", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error("INSTALLATION_LIBRARY_LOAD_FAILED");
  return (
    <div className="space-y-6">
      <FurnishingHeader
        current="installations"
        title="Delivery and Installation Tracking"
        description="Reconcile externally evidenced orders, shipments, physical receipt, room placement, installation, inspection, and completion."
        action={
          <Link
            className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 font-semibold text-white"
            href="/admin/furnishing/installations/new"
          >
            Create tracking project
          </Link>
        }
      />
      {notice}
      <div className="grid gap-4">
        {(data ?? []).map((p: Row) => {
          const issues = ((p.fsux7_tracking_exceptions as Row[]) ?? []).filter(
            (x) => x.status === "open",
          );
          return (
            <article
              className="rounded-2xl border bg-white p-5"
              key={String(p.id)}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">
                    Property tracking · {String(p.id).slice(0, 8)}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    {((p.fsux7_planned_lines as Row[]) ?? []).length} planned
                    lines · {issues.length} unresolved exceptions
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge value={String(p.tracking_status)} />
                  <Link
                    className="inline-flex min-h-11 items-center font-semibold text-emerald-800"
                    href={`/admin/furnishing/installations/${p.id}`}
                  >
                    Open
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
        {!data?.length ? (
          <div className="rounded-2xl border bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">No tracking projects yet</h2>
            <p className="mt-2 text-stone-600">
              Create one from an approved Procurement Readiness snapshot. No
              order will be created.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export async function NewTrackingProject() {
  await requireRole(["admin"]);
  const db = await createClient();
  const { data, error } = await db
    .from("fsux6_readiness_snapshots")
    .select(
      "id,baseline_id,readiness_version_id,snapshot_digest,created_at,furnishing_procurement_baselines!inner(id,readiness_status,current_readiness_version_id,archived_at,furnishing_installation_projects(id,tracking_status,archived_at))",
    )
    .eq("furnishing_procurement_baselines.readiness_status", "approved")
    .is("furnishing_procurement_baselines.archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error("INSTALLATION_SOURCE_LOAD_FAILED");
  const sources = (data ?? []).filter((snapshot: Row) => {
    const baseline = snapshot.furnishing_procurement_baselines as Row | null;
    const related = baseline?.furnishing_installation_projects as
      | Row
      | Row[]
      | null
      | undefined;
    const projects = Array.isArray(related)
      ? related
      : related
        ? [related]
        : [];
    return (
      baseline?.current_readiness_version_id ===
        snapshot.readiness_version_id &&
      !projects.some(
        (project) =>
          project.archived_at !== null ||
          project.tracking_status === "complete",
      )
    );
  });
  return (
    <div className="space-y-6">
      <FurnishingHeader
        current="installations"
        title="Create tracking project"
        description="Choose an immutable approved Procurement Readiness snapshot."
      />
      {notice}
      <div className="grid gap-4">
        {sources.map((s: Row) => {
          const baseline = s.furnishing_procurement_baselines as Row | null,
            related = baseline?.furnishing_installation_projects as
              | Row
              | Row[]
              | null
              | undefined,
            used = Array.isArray(related) ? related[0] : related;
          return (
            <form
              action={createTrackingProject}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"
              key={String(s.id)}
            >
              <input type="hidden" name="snapshotId" value={String(s.id)} />
              <input
                type="hidden"
                name="idempotency"
                value={`snapshot-${String(s.id)}`}
              />
              <div>
                <strong>Readiness snapshot {String(s.id).slice(0, 8)}</strong>
                <p className="text-sm text-stone-600">
                  Digest {String(s.snapshot_digest).slice(0, 16)}…
                </p>
              </div>
              {used ? (
                <Link
                  href={`/admin/furnishing/installations/${used.id}`}
                  className="inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold"
                >
                  Open existing
                </Link>
              ) : (
                <button className="min-h-11 rounded-xl bg-emerald-800 px-4 font-semibold text-white">
                  Create project
                </button>
              )}
            </form>
          );
        })}
        {!sources.length ? (
          <div className="rounded-2xl border bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">
              No eligible readiness snapshots
            </h2>
            <p className="mt-2 text-stone-600">
              Approve a current Procurement Readiness version before creating
              installation tracking.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export async function TrackingDetail({
  id,
  section = "overview",
  entityId,
}: {
  id: string;
  section?: string;
  entityId?: string;
}) {
  await requireRole(["admin"]);
  const db = createAdminClient();
  const { data: p } = await db
    .from("furnishing_installation_projects")
    .select("*")
    .eq("id", id)
    .not("source_readiness_snapshot_id", "is", null)
    .is("archived_at", null)
    .maybeSingle();
  if (!p) notFound();
  const [
    plannedResult,
    ordersResult,
    shipmentsResult,
    deliveriesResult,
    allocationsResult,
    eventsResult,
    exceptionsResult,
    inspectionsResult,
    snapshotsResult,
  ] = await Promise.all([
    db
      .from("fsux7_planned_lines")
      .select("*")
      .eq("installation_project_id", id),
    db
      .from("fsux7_order_evidence")
      .select(
        "*,furnishing_procurement_orders(*,furnishing_procurement_order_lines(*))",
      )
      .eq("installation_project_id", id),
    db
      .from("furnishing_shipments")
      .select("*")
      .eq("installation_project_id", id),
    db
      .from("fsux7_delivery_events")
      .select("*")
      .eq("installation_project_id", id),
    db
      .from("fsux7_room_allocations")
      .select("*")
      .eq("installation_project_id", id),
    db
      .from("fsux7_installation_events")
      .select("*")
      .eq("installation_project_id", id),
    db
      .from("fsux7_tracking_exceptions")
      .select("*")
      .eq("installation_project_id", id),
    db.from("fsux7_inspections").select("*").eq("installation_project_id", id),
    db
      .from("fsux7_completion_snapshots")
      .select("id,snapshot_digest,created_at")
      .eq("installation_project_id", id),
  ]);
  const results = [
    plannedResult,
    ordersResult,
    shipmentsResult,
    deliveriesResult,
    allocationsResult,
    eventsResult,
    exceptionsResult,
    inspectionsResult,
    snapshotsResult,
  ];
  if (results.some((result) => result.error))
    throw new Error("INSTALLATION_PROJECTION_LOAD_FAILED");
  const [
    planned,
    orders,
    shipments,
    deliveries,
    allocations,
    events,
    exceptions,
    inspections,
    snapshots,
  ] = results.map((result) => result.data);
  const links = [
    ["Overview", ""],
    ["Orders", "/orders"],
    ["Shipments", "/shipments"],
    ["Deliveries", "/deliveries"],
    ["Rooms", "/rooms"],
    ["Exceptions", "/exceptions"],
    ["Inspection", "/inspection"],
    ["Completion", "/completion"],
  ];
  const props = {
    p: p as Row,
    planned: planned ?? [],
    orders: orders ?? [],
    shipments: shipments ?? [],
    deliveries: deliveries ?? [],
    allocations: allocations ?? [],
    events: events ?? [],
    exceptions: exceptions ?? [],
    inspections: inspections ?? [],
    snapshots: snapshots ?? [],
  };
  return (
    <div className="space-y-6">
      <FurnishingHeader
        current="installations"
        title={
          section === "overview"
            ? "Delivery and installation project"
            : section[0].toUpperCase() + section.slice(1)
        }
        description={`Tracking version ${p.current_tracking_version} · ${String(p.tracking_status).replaceAll("_", " ")}`}
      />
      {notice}
      <nav
        aria-label="Tracking project sections"
        className="flex flex-wrap gap-2"
      >
        {links.map(([label, path]) => (
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 font-semibold focus-visible:ring-2 focus-visible:ring-emerald-700"
            href={`/admin/furnishing/installations/${id}${path}`}
            key={label}
          >
            {label}
          </Link>
        ))}
      </nav>
      <TrackingSection section={section} entityId={entityId} {...props} />
    </div>
  );
}

function TrackingSection({
  section,
  p,
  planned,
  orders,
  shipments,
  deliveries,
  allocations,
  events,
  exceptions,
  inspections,
  snapshots,
  entityId,
}: {
  section: string;
  p: Row;
  planned: Row[];
  orders: Row[];
  shipments: Row[];
  deliveries: Row[];
  allocations: Row[];
  events: Row[];
  exceptions: Row[];
  inspections: Row[];
  snapshots: Row[];
  entityId?: string;
}) {
  if (section === "orders" || section === "order")
    return (
      <>
        <Cards
          title="Governed order evidence"
          rows={
            entityId
              ? orders.filter(
                  (x) => String(x.procurement_order_id) === entityId,
                )
              : orders
          }
          fields={[
            "evidence_class",
            "verification_state",
            "ordering_party",
            "created_at",
          ]}
        />
        {planned[0] ? (
          <form
            action={recordOrderEvidence}
            className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2"
          >
            <h2 className="text-xl font-semibold sm:col-span-2">
              Record off-platform order evidence
            </h2>
            <input type="hidden" name="projectId" value={String(p.id)} />
            <input
              type="hidden"
              name="expected"
              value={String(p.current_tracking_version)}
            />
            <input
              type="hidden"
              name="plannedLineId"
              value={String(planned[0].id)}
            />
            <input
              type="hidden"
              name="retailerId"
              value={String(planned[0].retailer_id)}
            />
            <input
              required
              name="externalOrderNumber"
              className="min-h-11 rounded-xl border px-3"
              placeholder="External order reference"
            />
            <input
              required
              name="orderingParty"
              className="min-h-11 rounded-xl border px-3"
              placeholder="Ordering party"
            />
            <input
              required
              name="orderDate"
              type="date"
              className="min-h-11 rounded-xl border px-3"
            />
            <input
              required
              name="quantity"
              type="number"
              min="1"
              className="min-h-11 rounded-xl border px-3"
              placeholder="Quantity"
            />
            <input type="hidden" name="unitPriceMinor" value="0" />
            <input type="hidden" name="orderTotalMinor" value="0" />
            <select
              name="evidenceClass"
              className="min-h-11 rounded-xl border px-3"
            >
              <option value="manually_recorded">Manually recorded</option>
              <option value="customer_reported">Customer reported</option>
              <option value="operator_verified">Operator verified</option>
              <option value="document_verified">Document verified</option>
              <option value="controlled_test">Controlled test</option>
            </select>
            <input
              name="evidenceReference"
              className="min-h-11 rounded-xl border px-3"
              placeholder="Private evidence reference"
            />
            <button className="min-h-11 rounded-xl bg-emerald-800 px-4 font-semibold text-white sm:col-span-2">
              Record evidence
            </button>
          </form>
        ) : null}
      </>
    );
  if (section === "shipments" || section === "shipment")
    return (
      <Cards
        title="Shipment evidence"
        rows={
          entityId
            ? shipments.filter((x) => String(x.id) === entityId)
            : shipments
        }
        fields={[
          "status",
          "evidence_class",
          "verification_state",
          "tracking_number",
        ]}
      />
    );
  if (section === "deliveries")
    return (
      <Cards
        title="Delivery events"
        rows={deliveries}
        fields={["state", "evidence_class", "event_at", "condition_summary"]}
      />
    );
  if (section === "rooms")
    return (
      <>
        <Cards
          title="Room allocations"
          rows={allocations}
          fields={["location", "quantity", "destination_room_id"]}
        />
        <Cards
          title="Installation evidence"
          rows={events}
          fields={[
            "event_type",
            "quantity",
            "evidence_class",
            "installer_description",
          ]}
        />
      </>
    );
  if (section === "exceptions")
    return (
      <Cards
        title="Exceptions"
        rows={exceptions}
        fields={["category", "severity", "status", "required_resolution"]}
      />
    );
  if (section === "inspection")
    return (
      <>
        <Cards
          title="Inspection evidence"
          rows={inspections}
          fields={[
            "inspection_type",
            "result",
            "template_version",
            "external_inspector",
          ]}
        />
        {planned.map((line) => (
          <form
            action={recordPropertyInspection}
            className="mt-4 grid gap-3 rounded-2xl border bg-white p-5"
            key={String(line.id)}
          >
            <input type="hidden" name="projectId" value={String(p.id)} />
            <input
              type="hidden"
              name="expected"
              value={String(p.current_tracking_version)}
            />
            <input type="hidden" name="inspectionType" value="item" />
            <input type="hidden" name="plannedLineId" value={String(line.id)} />
            <input
              type="hidden"
              name="quantity"
              value={String(line.planned_quantity)}
            />
            <input type="hidden" name="result" value="passed" />
            <input type="hidden" name="evidenceClass" value="controlled_test" />
            <label className="text-sm font-medium">
              Inspector for line {String(line.sku ?? line.id).slice(0, 20)}
              <input
                required
                name="externalInspector"
                className="mt-1 min-h-11 w-full rounded-xl border px-3"
              />
            </label>
            <button className="min-h-11 rounded-xl border px-4 font-semibold">
              Record line inspection
            </button>
          </form>
        ))}
        <form
          action={recordPropertyInspection}
          className="mt-4 grid gap-3 rounded-2xl border bg-white p-5"
        >
          <input type="hidden" name="projectId" value={String(p.id)} />
          <input
            type="hidden"
            name="expected"
            value={String(p.current_tracking_version)}
          />
          <input type="hidden" name="inspectionType" value="property" />
          <input type="hidden" name="result" value="passed" />
          <input type="hidden" name="evidenceClass" value="controlled_test" />
          <label className="text-sm font-medium">
            Property inspector identity or description
            <input
              required
              name="externalInspector"
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
            />
          </label>
          <button className="min-h-11 rounded-xl border px-4 font-semibold">
            Record property inspection
          </button>
        </form>
      </>
    );
  if (section === "completion")
    return (
      <section className="space-y-4 rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Completion review</h2>
        {snapshots.length ? (
          <p className="rounded-xl bg-emerald-50 p-4">
            Immutable completion snapshot:{" "}
            <code>{String(snapshots[0].snapshot_digest)}</code>
          </p>
        ) : null}
        {p.tracking_status !== "complete" ? (
          <form action={approveCompletion}>
            <input type="hidden" name="projectId" value={String(p.id)} />
            <input
              type="hidden"
              name="expected"
              value={String(p.current_tracking_version)}
            />
            <button className="min-h-11 rounded-xl bg-emerald-800 px-4 font-semibold text-white">
              Approve installation completion
            </button>
          </form>
        ) : null}
        {events[0] && p.tracking_status === "complete" ? (
          <form
            action={recordMaterialInstallationCorrection}
            className="grid gap-3 rounded-xl border border-amber-300 p-4"
          >
            <input type="hidden" name="projectId" value={String(p.id)} />
            <input
              type="hidden"
              name="expected"
              value={String(p.current_tracking_version)}
            />
            <input type="hidden" name="sourceId" value={String(events[0].id)} />
            <input
              type="hidden"
              name="reason"
              value="Controlled material correction verification"
            />
            <label className="text-sm font-medium">
              Corrected installer identity
              <input
                required
                name="externalActor"
                className="mt-1 min-h-11 w-full rounded-xl border px-3"
              />
            </label>
            <button className="min-h-11 rounded-xl border border-amber-500 px-4 font-semibold">
              Record material correction
            </button>
          </form>
        ) : null}
      </section>
    );
  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-4">
        {[
          ["Planned lines", planned.length],
          ["Order records", orders.length],
          ["Physical receipts", allocations.length],
          [
            "Open exceptions",
            exceptions.filter((x) => x.status === "open").length,
          ],
        ].map(([k, v]) => (
          <div className="rounded-2xl bg-stone-100 p-4" key={String(k)}>
            <dt className="text-sm text-stone-600">{k}</dt>
            <dd className="text-2xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <Cards
        title="Planned baseline"
        rows={planned}
        fields={["sku", "variant", "planned_quantity", "priority"]}
      />
      {orders[0] ? (
        <EvidenceActions p={p} planned={planned[0]} order={orders[0]} />
      ) : null}
    </>
  );
}
function EvidenceActions({
  p,
  planned,
  order,
}: {
  p: Row;
  planned?: Row;
  order: Row;
}) {
  const canonical = order.furnishing_procurement_orders as Row | null,
    lines =
      (canonical?.furnishing_procurement_order_lines as Row[] | undefined) ??
      [],
    line = lines[0];
  return (
    <section className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2">
      <h2 className="text-xl font-semibold sm:col-span-2">
        Receipt and installation evidence
      </h2>
      {line ? (
        <form action={recordReceipt} className="space-y-3">
          <input type="hidden" name="projectId" value={String(p.id)} />
          <input
            type="hidden"
            name="expected"
            value={String(p.current_tracking_version)}
          />
          <input type="hidden" name="orderLineId" value={String(line.id)} />
          <input type="hidden" name="evidenceClass" value="manually_recorded" />
          <input type="hidden" name="disposition" value="accepted" />
          <label className="block text-sm font-medium">
            Physically received quantity
            <input
              required
              name="quantity"
              type="number"
              min="1"
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
            />
          </label>
          <button className="min-h-11 rounded-xl border px-4 font-semibold">
            Record physical receipt
          </button>
        </form>
      ) : null}
      {planned ? (
        <form action={recordInstallation} className="space-y-3">
          <input type="hidden" name="projectId" value={String(p.id)} />
          <input
            type="hidden"
            name="expected"
            value={String(p.current_tracking_version)}
          />
          <input
            type="hidden"
            name="plannedLineId"
            value={String(planned.id)}
          />
          <input type="hidden" name="evidenceClass" value="manually_recorded" />
          <label className="block text-sm font-medium">
            Installed quantity
            <input
              required
              name="quantity"
              type="number"
              min="1"
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
            />
          </label>
          <input
            required
            name="externalActor"
            className="min-h-11 w-full rounded-xl border px-3"
            placeholder="Installer identity or description"
          />
          <button className="min-h-11 rounded-xl border px-4 font-semibold">
            Record installation evidence
          </button>
        </form>
      ) : null}
    </section>
  );
}
function Cards({
  title,
  rows,
  fields,
}: {
  title: string;
  rows: Row[];
  fields: string[];
}) {
  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      {rows.length ? (
        <div className="mt-4 grid gap-3">
          {rows.map((r, i) => (
            <article className="rounded-xl border p-4" key={String(r.id ?? i)}>
              {fields.map((f) => (
                <p className="text-sm" key={f}>
                  <span className="font-medium">{f.replaceAll("_", " ")}:</span>{" "}
                  {String(r[f] ?? "Not recorded")}
                </p>
              ))}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-stone-600">No evidence recorded.</p>
      )}
    </section>
  );
}
