import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelSimpleFurnishingProjectAction,
  completeSimpleFurnishingProjectAction,
  createProcurementChecklistAction,
  startSimpleInstallationAction,
  updateProcurementChecklistLineAction,
  updateSimpleInstallationLineAction,
} from "@/app/actions/furnishing-simple-workflow";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { FurnishingHeader } from "./furnishing-navigation";
import { ProjectWorkspace } from "./project-workspace-v1";

type Row = Record<string, unknown>;
const text = (value: unknown) => String(value ?? "");
const money = (value: unknown, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(value ?? 0) / 100,
  );
const stages = [
  "draft",
  "ready_for_review",
  "approved",
  "procurement",
  "installation",
  "completed",
];

export async function SimplifiedProjectWorkspace({
  id,
  customer = false,
}: {
  id: string;
  customer?: boolean;
}) {
  await requireUser();
  const client = await createClient();
  const { data, error } = await client.rpc("get_furnishing_simple_project", {
    p_project: id,
  });
  if (error || !data) notFound();
  const projection = data as Row,
    project = projection.project as Row,
    workflow = projection.workflow as Row | null,
    budget = projection.budget as Row | null,
    procurement = (projection.procurementLines ?? []) as Row[],
    installation = (projection.installationLines ?? []) as Row[],
    activity = (projection.activity ?? []) as Row[],
    stage = text(projection.stage),
    stageIndex = stages.indexOf(stage),
    procurementDone = procurement.filter((line) =>
      ["ordered", "received", "issue"].includes(text(line.status)),
    ).length,
    installationDone = installation.filter((line) => {
      const item = line.item as Row;
      return (
        Number(line.installed_quantity) >= Number(item.required_quantity) ||
        line.exception_accepted === true
      );
    }).length,
    blockers = installation.filter((line) => {
      const item = line.item as Row;
      return (
        Number(line.installed_quantity) < Number(item.required_quantity) &&
        line.exception_accepted !== true
      );
    });
  if (["draft", "ready_for_review"].includes(stage))
    return <ProjectWorkspace projectId={id} customer={customer} />;
  return (
    <div className="space-y-8">
      <FurnishingHeader
        current="projects"
        title={text(project.name)}
        description={`Current stage: ${stage.replaceAll("_", " ")}`}
      />
      <nav aria-label="Project sections" className="flex flex-wrap gap-2">
        {["Plan", "Budget", "Procurement", "Installation", "Activity"].map(
          (label) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 font-semibold focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              {label}
            </a>
          ),
        )}
      </nav>
      <ol
        aria-label="Furnishing project stages"
        className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {stages.map((item, index) => (
          <li
            key={item}
            aria-current={item === stage ? "step" : undefined}
            className={`rounded-xl border p-3 text-sm font-semibold ${index <= stageIndex ? "border-emerald-700 bg-emerald-50" : "bg-white"}`}
          >
            {item.replaceAll("_", " ")}
          </li>
        ))}
      </ol>
      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Project summary"
      >
        <Summary
          label="Budget total"
          value={money(
            budget?.estimated_total_minor,
            text(budget?.currency || "USD"),
          )}
        />
        <Summary
          label="Procurement progress"
          value={`${procurementDone}/${procurement.length}`}
        />
        <Summary
          label="Installation progress"
          value={`${installationDone}/${installation.length}`}
        />
      </section>
      <section id="plan" className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Plan</h2>
        <p className="mt-2 text-sm text-stone-600">
          The approved design snapshot is the authoritative source for
          procurement. Historical plan lineage is read-only.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="font-semibold text-emerald-800"
            href={`/admin/furnishing/workspaces/${id}/selections`}
          >
            Review selections
          </Link>
          <Link
            className="font-semibold text-emerald-800"
            href={`/admin/furnishing/workspaces/${id}/review`}
          >
            Review and approve plan
          </Link>
        </div>
      </section>
      <section id="budget" className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Budget</h2>
        <p className="mt-2 text-2xl font-semibold">
          {money(
            budget?.estimated_total_minor,
            text(budget?.currency || "USD"),
          )}
        </p>
        <p className="mt-1 text-sm text-stone-600">
          Approval never authorizes or places a purchase.
        </p>
      </section>
      <section id="procurement" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Procurement checklist</h2>
          <p className="text-sm text-stone-600">
            Record manual progress only. No order, payment, retailer request, or
            provider action occurs.
          </p>
        </div>
        {stage === "approved" ? (
          <form
            action={createProcurementChecklistAction}
            className="rounded-2xl border bg-white p-5"
          >
            <input type="hidden" name="projectId" value={id} />
            <input
              type="hidden"
              name="expected"
              value={text(project.optimistic_version)}
            />
            <button className="min-h-11 rounded-xl bg-emerald-800 px-4 font-semibold text-white">
              Create procurement checklist
            </button>
          </form>
        ) : null}
        {procurement.map((line) => {
          const item = line.item as Row;
          return (
            <form
              action={updateProcurementChecklistLineAction}
              key={text(line.id)}
              className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-[2fr_1fr_2fr_auto]"
            >
              <input type="hidden" name="projectId" value={id} />
              <input type="hidden" name="lineId" value={text(line.id)} />
              <input
                type="hidden"
                name="expected"
                value={text(line.optimistic_version)}
              />
              <div>
                <h3 className="font-semibold">{text(item.product_name)}</h3>
                <p className="text-sm text-stone-600">
                  {text(item.required_quantity)} ×{" "}
                  {money(item.budgeted_unit_price_minor, text(item.currency))} ·{" "}
                  {text(item.retailer_source)}
                </p>
              </div>
              <label className="text-sm font-medium">
                Status
                <select
                  name="status"
                  defaultValue={text(line.status)}
                  className="mt-1 min-h-11 w-full rounded-xl border px-3"
                >
                  {["not_started", "ordered", "received", "issue"].map(
                    (option) => (
                      <option key={option}>{option}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="text-sm font-medium">
                Notes
                <input
                  name="notes"
                  defaultValue={text(line.notes)}
                  className="mt-1 min-h-11 w-full rounded-xl border px-3"
                />
              </label>
              <button className="min-h-11 self-end rounded-xl border px-4 font-semibold">
                Save
              </button>
            </form>
          );
        })}
        {stage === "procurement" && procurement.length ? (
          <form
            action={startSimpleInstallationAction}
            className="rounded-2xl border bg-white p-5"
          >
            <input type="hidden" name="projectId" value={id} />
            <input
              type="hidden"
              name="expected"
              value={text(workflow?.optimistic_version)}
            />
            <button className="min-h-11 rounded-xl bg-emerald-800 px-4 font-semibold text-white">
              Start installation tracking
            </button>
          </form>
        ) : null}
      </section>
      <section id="installation" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Installation</h2>
          <p className="text-sm text-stone-600">
            TVs and mounts are tracked as ordinary required lines.
          </p>
        </div>
        {installation.map((line) => {
          const item = line.item as Row;
          return (
            <form
              action={updateSimpleInstallationLineAction}
              key={text(line.id)}
              className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              <input type="hidden" name="projectId" value={id} />
              <input type="hidden" name="lineId" value={text(line.id)} />
              <input
                type="hidden"
                name="expected"
                value={text(line.optimistic_version)}
              />
              <div className="lg:col-span-4">
                <h3 className="font-semibold">{text(item.product_name)}</h3>
                <p className="text-sm text-stone-600">
                  Required: {text(line.required_quantity)}
                </p>
              </div>
              <Field
                name="receivedQuantity"
                label="Received quantity"
                type="number"
                value={text(line.received_quantity)}
              />
              <Field
                name="installedQuantity"
                label="Installed quantity"
                type="number"
                value={text(line.installed_quantity)}
              />
              <Select
                name="deliveryStatus"
                label="Delivery status"
                value={text(line.delivery_status)}
                options={["pending", "received", "partial", "issue"]}
              />
              <Select
                name="installationStatus"
                label="Installation status"
                value={text(line.installation_status)}
                options={["not_started", "installed", "issue"]}
              />
              <Field
                name="issueNote"
                label="Issue note"
                value={text(line.issue_note)}
              />
              <Field
                name="evidenceAttachment"
                label="Evidence attachment"
                value={text(line.evidence_attachment)}
              />
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="exceptionAccepted"
                  defaultChecked={line.exception_accepted === true}
                />
                Accept unresolved exception
              </label>
              <button className="min-h-11 rounded-xl border px-4 font-semibold">
                Save installation line
              </button>
            </form>
          );
        })}
        {stage === "installation" ? (
          <form
            action={completeSimpleFurnishingProjectAction}
            className="rounded-2xl border bg-white p-5"
          >
            <input type="hidden" name="projectId" value={id} />
            <input
              type="hidden"
              name="expected"
              value={text(workflow?.optimistic_version)}
            />
            {blockers.length ? (
              <p role="alert" className="mb-3 text-sm text-amber-800">
                {blockers.length} required line(s) remain unresolved.
              </p>
            ) : null}
            <button className="min-h-11 rounded-xl bg-emerald-800 px-4 font-semibold text-white">
              Complete furnishing project
            </button>
          </form>
        ) : null}
      </section>
      <section id="activity" className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Activity</h2>
        <ol className="mt-3 divide-y">
          {activity.map((event) => (
            <li key={text(event.id)} className="py-3">
              <p className="font-medium">
                {text(event.event_type).replaceAll("_", " ")}
              </p>
              <time className="text-xs text-stone-500">
                {new Date(text(event.occurred_at)).toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      </section>
      {!["completed", "cancelled"].includes(stage) ? (
        <form
          action={cancelSimpleFurnishingProjectAction}
          className="rounded-2xl border border-red-200 bg-white p-5"
        >
          <input type="hidden" name="projectId" value={id} />
          <input
            type="hidden"
            name="expected"
            value={text(
              workflow?.optimistic_version ?? project.optimistic_version,
            )}
          />
          <p className="mb-3 text-sm text-stone-600">
            Cancellation stops this project without deleting its approved
            snapshot or activity history.
          </p>
          <button className="min-h-11 rounded-xl border border-red-700 px-4 font-semibold text-red-800">
            Cancel furnishing project
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-sm text-stone-600">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
function Field({
  name,
  label,
  value,
  type = "text",
}: {
  name: string;
  label: string;
  value: string;
  type?: string;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <input
        required={type === "number"}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.0001" : undefined}
        type={type}
        name={name}
        defaultValue={value}
        className="mt-1 min-h-11 w-full rounded-xl border px-3"
      />
    </label>
  );
}
function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="mt-1 min-h-11 w-full rounded-xl border px-3"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
