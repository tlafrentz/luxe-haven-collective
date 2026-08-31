import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { FurnishingHeader } from "./furnishing-navigation";
import { NewProjectWorkspace, ProjectWorkspace } from "./project-workspace-v1";
type Row = Record<string, unknown>;
const money = (value: unknown, currency = "USD") =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
        value / 100,
      )
    : "Not set";

export async function DesignWorkspaceLibrary() {
  await requireRole(["admin"]);
  const db = createAdminClient();
  const { data, error } = await db
    .from("furnishing_projects")
    .select(
      "id,name,design_workspace_status,target_budget_minor,target_budget_currency,target_launch_date,updated_at,properties(name,property_type),furnishing_budgets(estimated_total_minor,lifecycle_status)",
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error("DESIGN_WORKSPACE_LOAD_FAILED");
  return (
    <div className="space-y-6">
      <FurnishingHeader
        current="projects"
        title="Design Workspaces"
        description="Create property-specific furnishing plans, selections, reviews, and reproducible budgets."
      />
      <div className="flex flex-wrap gap-3">
        <Link
          className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 font-semibold text-white"
          href="/admin/furnishing/workspaces/new"
        >
          Start Design Workspace
        </Link>
        <Link
          className="inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold"
          href="/admin/furnishing/budgets"
        >
          View budgets
        </Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Workspace</th>
              <th className="p-4">Property</th>
              <th className="p-4">State</th>
              <th className="p-4">Budget</th>
              <th className="p-4">Target date</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((item: Row) => {
              const property = item.properties as Row | null,
                budgets = item.furnishing_budgets as Row[] | null;
              return (
                <tr className="border-b last:border-0" key={String(item.id)}>
                  <th className="p-4">{String(item.name)}</th>
                  <td className="p-4">
                    {String(property?.name ?? "Property")}
                  </td>
                  <td className="p-4">
                    <span className="rounded-full bg-emerald-50 px-2 py-1">
                      {String(item.design_workspace_status).replaceAll(
                        "_",
                        " ",
                      )}
                    </span>
                  </td>
                  <td className="p-4">
                    {money(
                      budgets?.[0]?.estimated_total_minor,
                      String(item.target_budget_currency),
                    )}{" "}
                    /{" "}
                    {money(
                      item.target_budget_minor,
                      String(item.target_budget_currency),
                    )}
                  </td>
                  <td className="p-4">
                    {String(item.target_launch_date ?? "Not set")}
                  </td>
                  <td className="p-4">
                    <Link
                      className="font-semibold text-emerald-800"
                      href={`/admin/furnishing/workspaces/${item.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export function NewDesignWorkspace() {
  return <NewProjectWorkspace customer={false} />;
}
export function DesignWorkspaceDetail({ id }: { id: string }) {
  return <ProjectWorkspace projectId={id} customer={false} />;
}

export async function DesignWorkspaceSection({
  id,
  section,
  roomId,
  versionId,
}: {
  id: string;
  section: string;
  roomId?: string;
  versionId?: string;
}) {
  await requireRole(["admin"]);
  const db = createAdminClient();
  const { data: project } = await db
    .from("furnishing_projects")
    .select("id,name,design_workspace_status,current_design_version_id")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  const labels: Record<string, string> = {
    brief: "Design brief",
    rooms: roomId ? "Room detail" : "Rooms and measurements",
    selections: "Product selections",
    review: "Design and budget review",
    version: "Approved design version",
  };
  return (
    <div className="space-y-6">
      <FurnishingHeader
        current="projects"
        title={labels[section] ?? "Design Workspace"}
        description={`${project.name} · ${String(project.design_workspace_status).replaceAll("_", " ")}`}
      />
      <nav
        aria-label="Design Workspace sections"
        className="flex flex-wrap gap-2"
      >
        {[
          ["Overview", ""],
          ["Brief", "/brief"],
          ["Rooms", "/rooms"],
          ["Selections", "/selections"],
          ["Review", "/review"],
        ].map(([label, path]) => (
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold"
            key={label}
            href={`/admin/furnishing/workspaces/${id}${path}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {section === "version" ? (
        <p className="rounded-2xl border bg-white p-6">
          Immutable version evidence: <code>{versionId}</code>. Approved
          snapshots preserve property, measurements, mood board, selections,
          price evidence, budget, and approvals.
        </p>
      ) : (
        <ProjectWorkspace projectId={id} customer={false} />
      )}
    </div>
  );
}

export async function BudgetLibrary() {
  await requireRole(["admin"]);
  const db = createAdminClient();
  const { data, error } = await db
    .from("furnishing_budgets")
    .select(
      "id,project_id,version_number,lifecycle_status,inclusion_basis,target_minimum_minor,target_maximum_minor,estimated_total_minor,currency,updated_at,furnishing_projects(name,properties(name))",
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error("DESIGN_BUDGET_LOAD_FAILED");
  return (
    <div className="space-y-6">
      <FurnishingHeader
        current="budgets"
        title="Budgets"
        description="Reconcile fixed-precision furnishing estimates, targets, price freshness, and approval state."
      />
      <div className="grid gap-4">
        {(data ?? []).map((budget: Row) => (
          <Link
            className="rounded-2xl border bg-white p-5"
            key={String(budget.id)}
            href={`/admin/furnishing/budgets/${budget.id}`}
          >
            <strong>
              {String(
                (budget.furnishing_projects as Row)?.name ?? "Design Workspace",
              )}
            </strong>
            <p className="mt-2 text-sm text-stone-600">
              {money(budget.estimated_total_minor, String(budget.currency))} ·{" "}
              {String(budget.inclusion_basis).replaceAll("_", " ")} ·{" "}
              {String(budget.lifecycle_status).replaceAll("_", " ")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
export async function BudgetDetail({
  id,
  review = false,
}: {
  id: string;
  review?: boolean;
}) {
  await requireRole(["admin"]);
  const db = createAdminClient();
  const { data } = await db
    .from("furnishing_budgets")
    .select("*,furnishing_projects(id,name,design_workspace_status)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  return (
    <div className="space-y-6">
      <FurnishingHeader
        current="budgets"
        title={review ? "Budget review" : "Budget detail"}
        description={`${data.furnishing_projects?.name} · version ${data.version_number}`}
      />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Products", data.product_subtotal_minor],
          ["Delivery", data.delivery_minor],
          ["Tax", data.tax_minor],
          ["Assembly", data.assembly_minor],
          ["Installation", data.installation_minor],
          ["Contingency", data.contingency_minor],
          ["Estimated total", data.estimated_total_minor],
          ["Target maximum", data.target_maximum_minor],
        ].map(([label, value]) => (
          <div className="rounded-2xl bg-white p-5" key={String(label)}>
            <p className="text-sm text-stone-600">{label}</p>
            <p className="mt-2 text-xl font-semibold">
              {money(value, data.currency)}
            </p>
          </div>
        ))}
      </section>
      <p className="rounded-2xl border bg-white p-5">
        Approval does not authorize spending or create procurement. Current
        inclusion basis:{" "}
        <strong>{String(data.inclusion_basis).replaceAll("_", " ")}</strong>.
      </p>
      <Link
        className="font-semibold text-emerald-800"
        href={`/admin/furnishing/workspaces/${data.project_id}`}
      >
        Open Design Workspace
      </Link>
    </div>
  );
}
