import Link from "next/link";
import {
  createProcurementOrderAction,
  getFurnishingStudio,
  updateInstallationStatusAction,
  updateOrderStatusAction,
} from "@/app/actions/furnishing-studio";
import { Badge, FurnishingHeader, Money } from "./furnishing-navigation";
type Studio = Awaited<ReturnType<typeof getFurnishingStudio>>;
type Row = Record<string, unknown>;
const sum = (rows: Row[], key: string) =>
  rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
export async function FurnishingWorkspace({
  view,
}: {
  view: "overview" | "projects" | "packages" | "procurement" | "installation";
}) {
  const data = await getFurnishingStudio();
  if (!data.ok)
    return (
      <main className="mx-auto max-w-7xl p-8">
        <section
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-6"
        >
          <h1 className="text-xl font-semibold">
            Furnishing Studio needs its database migration
          </h1>
          <p className="mt-2 text-sm">{data.error}</p>
        </section>
      </main>
    );
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      {view === "overview" ? <Overview data={data} /> : null}
      {view === "projects" ? <Projects data={data} /> : null}
      {view === "packages" ? <Packages data={data} /> : null}
      {view === "procurement" ? <Procurement data={data} /> : null}
      {view === "installation" ? <Installation data={data} /> : null}
    </main>
  );
}
function Overview({ data }: { data: Studio }) {
  const active = data.projects.filter(
      (x: Row) => !["completed", "archived"].includes(String(x.status)),
    ),
    totalBudget = data.projects.reduce(
      (n: number, x: Row) => n + (Number((x.budget as Row)?.target) || 0),
      0,
    ),
    spend = sum(data.orders as Row[], "total"),
    phase = (name: string) =>
      data.projects.filter((x: Row) => x.phase === name);
  return (
    <>
      <FurnishingHeader
        title="Furnishing Studio"
        description="Design, furnish, procure, and install exceptional hospitality interiors."
        current="overview"
        action={
          <Link
            href="/admin/furnishing/projects/new"
            className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
          >
            + New project
          </Link>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Active projects" value={active.length} />
        <Metric
          label="In progress"
          value={
            data.projects.filter((x: Row) => x.status === "in_progress").length
          }
        />
        <Metric
          label="Awaiting items"
          value={
            data.orders.filter(
              (x: Row) =>
                !["delivered", "cancelled", "returned", "refunded"].includes(
                  String(x.status),
                ),
            ).length
          }
        />
        <Metric
          label="Installed"
          value={
            data.installations.filter((x: Row) => x.status === "installed")
              .length
          }
        />
        <Metric label="Total budget" value={<Money value={totalBudget} />} />
        <Metric label="Committed" value={<Money value={spend} />} />
      </section>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_.7fr]">
        <Panel title="Budget overview">
          <p className="text-3xl font-semibold">
            <Money value={totalBudget} />
          </p>
          <p className="mt-1 text-sm text-stone-500">Across all projects</p>
          <div className="mt-5 space-y-3">
            <Bar label="Ordered" value={spend} total={totalBudget} />
            <Bar
              label="Remaining"
              value={Math.max(0, totalBudget - spend)}
              total={totalBudget}
            />
          </div>
        </Panel>
        <Panel title="Project pipeline">
          <div className="grid grid-cols-2 gap-3">
            {[
              "design",
              "selections",
              "procurement",
              "installation",
              "complete",
            ].map((x) => (
              <div key={x} className="rounded-xl bg-stone-50 p-3">
                <p className="text-xs font-semibold capitalize">{x}</p>
                <p className="mt-2 text-xl font-semibold">{phase(x).length}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Quick actions">
          <div className="space-y-2">
            {[
              ["New project", "/admin/furnishing/projects/new"],
              ["Browse packages", "/admin/furnishing/packages"],
              ["View procurement", "/admin/furnishing/procurement"],
              ["Installation schedule", "/admin/furnishing/installation"],
            ].map(([x, href]) => (
              <Link
                key={x}
                href={href}
                className="block rounded-xl border px-4 py-3 text-sm font-semibold"
              >
                {x}
              </Link>
            ))}
          </div>
        </Panel>
      </div>
      <ProjectTable projects={data.projects as Row[]} />
    </>
  );
}
function Projects({ data }: { data: Studio }) {
  return (
    <>
      <FurnishingHeader
        title="Projects"
        description="Property-specific implementations of reusable furnishing packages."
        current="projects"
        action={
          <Link
            href="/admin/furnishing/projects/new"
            className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
          >
            New project
          </Link>
        }
      />
      <Filter
        labels={[
          "Search projects",
          "All statuses",
          "All phases",
          "All properties",
          "All project leads",
        ]}
      />
      <ProjectTable projects={data.projects as Row[]} />
    </>
  );
}
function ProjectTable({ projects }: { projects: Row[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="border-b p-5">
        <h2 className="text-xl font-semibold">Active projects</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">Furnishing projects</caption>
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              {[
                "Project",
                "Property",
                "Phase",
                "Budget",
                "Progress",
                "Target install",
                "Lead",
                "",
              ].map((x) => (
                <th key={x} className="p-4">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.length ? (
              projects.map((row) => (
                <tr key={String(row.id)} className="border-t">
                  <td className="p-4 font-semibold">{String(row.name)}</td>
                  <td className="p-4">
                    {String((row.properties as Row)?.name ?? "—")}
                  </td>
                  <td className="p-4">
                    <Badge value={String(row.phase)} />
                  </td>
                  <td className="p-4">
                    <Money value={(row.budget as Row)?.target} />
                  </td>
                  <td className="p-4">{Number(row.progress)}%</td>
                  <td className="p-4">
                    {row.target_install_date
                      ? new Date(
                          String(row.target_install_date) + "T12:00:00",
                        ).toLocaleDateString()
                      : "Not set"}
                  </td>
                  <td className="p-4">
                    {String(row.project_lead ?? "Unassigned")}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/admin/furnishing/projects/${row.id}`}
                      className="font-semibold text-emerald-800"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-12 text-center text-stone-500">
                  No furnishing projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Packages({ data }: { data: Studio }) {
  return (
    <>
      <FurnishingHeader
        title="Packages"
        description="Reusable furnishing systems, variants, and hospitality product selections."
        current="packages"
        action={
          <Link
            href="/admin/furnishing/packages/new"
            className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
          >
            New package
          </Link>
        }
      />
      <Filter
        labels={[
          "Search packages",
          "All property types",
          "All styles",
          "All budget tiers",
          "All statuses",
        ]}
      />
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.packages.map((pkg: Row) => {
          const variants = data.variants.filter(
            (v: Row) => v.package_id === pkg.id,
          );
          return (
            <article
              key={String(pkg.id)}
              className="overflow-hidden rounded-2xl border bg-white"
            >
              <div className="h-40 bg-gradient-to-br from-stone-800 to-emerald-950" />
              <div className="p-5">
                <div className="flex justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {String(pkg.name)}
                    </h2>
                    <p className="mt-1 text-sm capitalize text-stone-500">
                      {String(pkg.property_type)} · {String(pkg.style)}
                    </p>
                  </div>
                  <Badge value={String(pkg.status)} />
                </div>
                <div className="mt-5 flex justify-between text-sm">
                  <span>
                    From{" "}
                    <strong>
                      <Money value={pkg.starting_budget} />
                    </strong>
                  </span>
                  <span>{variants.length} variants</span>
                </div>
                {variants[0] ? (
                  <Link
                    href={`/admin/furnishing/packages/${pkg.id}/variants/${variants[0].id}`}
                    className="mt-5 block rounded-xl border px-4 py-2.5 text-center text-sm font-semibold"
                  >
                    View package
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
function Procurement({ data }: { data: Studio }) {
  return (
    <>
      <FurnishingHeader
        title="Procurement"
        description="Orders, deliveries, backorders, returns, and durable purchasing history."
        current="procurement"
      />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          "ordered",
          "delivered",
          "partially_fulfilled",
          "shipped",
          "returned",
        ].map((status) => (
          <Metric
            key={status}
            label={status.replaceAll("_", " ")}
            value={data.orders.filter((x: Row) => x.status === status).length}
          />
        ))}
      </section>
      <Panel title="Create purchase order">
        <form
          action={createProcurementOrderAction}
          className="grid gap-3 md:grid-cols-4"
        >
          <select
            name="projectId"
            required
            className="rounded-xl border px-3 py-2"
          >
            <option value="">Project</option>
            {data.projects.map((x: Row) => (
              <option key={String(x.id)} value={String(x.id)}>
                {String(x.name)}
              </option>
            ))}
          </select>
          <input
            name="vendor"
            required
            placeholder="Vendor"
            className="rounded-xl border px-3 py-2"
          />
          <input
            name="total"
            type="number"
            min="0"
            step=".01"
            placeholder="Order total"
            className="rounded-xl border px-3 py-2"
          />
          <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
            Create order
          </button>
        </form>
      </Panel>
      <section className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr>
              {[
                "Order",
                "Project",
                "Vendor",
                "Total",
                "Status",
                "Estimated delivery",
                "Update",
              ].map((x) => (
                <th key={x} className="p-4">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.orders.map((x: Row) => (
              <tr key={String(x.id)} className="border-t">
                <td className="p-4">
                  <Link
                    className="font-semibold text-emerald-800"
                    href={`/admin/furnishing/procurement/orders/${x.id}`}
                  >
                    {String(x.po_number)}
                  </Link>
                </td>
                <td className="p-4">
                  {String((x.furnishing_projects as Row)?.name ?? "—")}
                </td>
                <td className="p-4">{String(x.vendor)}</td>
                <td className="p-4">
                  <Money value={x.total} />
                </td>
                <td className="p-4">
                  <Badge value={String(x.status)} />
                </td>
                <td className="p-4">
                  {String(x.estimated_delivery ?? "Not set")}
                </td>
                <td className="p-4">
                  <form action={updateOrderStatusAction} className="flex gap-2">
                    <input type="hidden" name="orderId" value={String(x.id)} />
                    <select
                      name="status"
                      defaultValue={String(x.status)}
                      className="rounded-lg border px-2 py-1"
                    >
                      <option value="ordered">Ordered</option>
                      <option value="shipped">Shipped</option>
                      <option value="partially_fulfilled">Partial</option>
                      <option value="delivered">Delivered</option>
                      <option value="returned">Returned</option>
                    </select>
                    <button className="text-xs font-semibold">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
function Installation({ data }: { data: Studio }) {
  return (
    <>
      <FurnishingHeader
        title="Installation"
        description="On-site schedules, room checklists, condition evidence, and punch work."
        current="installation"
      />
      <section className="grid gap-4 sm:grid-cols-4">
        {["pending", "ready", "installed", "damaged"].map((status) => (
          <Metric
            key={status}
            label={status}
            value={
              data.installations.filter((x: Row) => x.status === status).length
            }
          />
        ))}
      </section>
      <div className="space-y-3">
        {data.installations.length ? (
          data.installations.map((x: Row) => (
            <article
              key={String(x.id)}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"
            >
              <div>
                <p className="font-semibold">{String(x.item_name)}</p>
                <p className="text-sm text-stone-500">
                  {String((x.furnishing_projects as Row)?.name ?? "Project")} ·{" "}
                  {String(x.room)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/furnishing/installation/${x.id}`}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  Open
                </Link>
                <form
                  action={updateInstallationStatusAction}
                  className="flex gap-2"
                >
                  <input
                    type="hidden"
                    name="installationId"
                    value={String(x.id)}
                  />
                  <select
                    name="status"
                    defaultValue={String(x.status)}
                    className="rounded-xl border px-3 py-2"
                  >
                    <option value="pending">Pending</option>
                    <option value="ready">Ready</option>
                    <option value="installed">Installed</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                    <option value="deferred">Deferred</option>
                  </select>
                  <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                    Update
                  </button>
                </form>
              </div>
            </article>
          ))
        ) : (
          <Empty text="No installation tasks are scheduled." />
        )}
      </div>
    </>
  );
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </article>
  );
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function Bar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const width = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span>
          <Money value={value} />
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-stone-100">
        <div
          className="h-2 rounded-full bg-emerald-700"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
function Filter({ labels }: { labels: string[] }) {
  return (
    <form className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
      {labels.map((x, i) =>
        i === 0 ? (
          <input
            key={x}
            name="q"
            placeholder={x}
            className="min-w-56 flex-1 rounded-xl border px-3 py-2"
          />
        ) : (
          <select
            key={x}
            aria-label={x}
            className="rounded-xl border px-3 py-2"
          >
            <option>{x}</option>
          </select>
        ),
      )}
      <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
        Apply
      </button>
    </form>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <section className="rounded-2xl border border-dashed bg-white p-12 text-center text-stone-500">
      {text}
    </section>
  );
}
