import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFurnishingStudio,
  updateFurnishingProjectAction,
} from "@/app/actions/furnishing-studio";
import {
  Badge,
  FurnishingHeader,
  Money,
} from "@/components/furnishing/furnishing-navigation";
import { PROJECT_PHASES, PROJECT_STATUSES } from "@/features/furnishing-studio";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: projectId } = { id: (await params).projectId },
    tab = (await searchParams).tab ?? "overview",
    data = await getFurnishingStudio(),
    p = data.projects.find(
      (x: Record<string, unknown>) => x.id === projectId,
    ) as Record<string, unknown> | undefined;
  if (!p) notFound();
  const budget = (p.budget ?? {}) as Record<string, unknown>,
    orders = data.orders.filter(
      (x: Record<string, unknown>) => x.project_id === projectId,
    ),
    installs = data.installations.filter(
      (x: Record<string, unknown>) => x.project_id === projectId,
    ),
    activity = data.activity.filter(
      (x: Record<string, unknown>) => x.project_id === projectId,
    ),
    tabs = [
      "overview",
      "selections",
      "budget",
      "procurement",
      "installation",
      "files",
      "activity",
    ];
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title={String(p.name)}
        description={`${String((p.properties as Record<string, unknown>)?.name ?? "Property")} · ${String(p.project_lead ?? "Unassigned lead")}`}
        current="projects"
      />
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/admin/furnishing">Furnishing Studio</Link> ›{" "}
        <Link href="/admin/furnishing/projects">Projects</Link> ›{" "}
        {String(p.name)}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <Badge value={String(p.status)} />
        <Badge value={String(p.phase)} />
        <span className="text-sm text-stone-500">
          Target {String(p.target_install_date ?? "not set")}
        </span>
      </div>
      <nav className="overflow-x-auto border-b">
        <div className="flex min-w-max gap-6">
          {tabs.map((x) => (
            <Link
              key={x}
              href={`?tab=${x}`}
              className={`border-b-2 py-3 text-sm font-semibold capitalize ${tab === x ? "border-emerald-700" : "border-transparent text-stone-500"}`}
            >
              {x}
            </Link>
          ))}
        </div>
      </nav>
      {tab === "overview" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-4">
            <Card l="Budget">
              <Money value={budget.target} />
            </Card>
            <Card l="Committed">
              <Money
                value={orders.reduce(
                  (n: number, x: Record<string, unknown>) =>
                    n + Number(x.total),
                  0,
                )}
              />
            </Card>
            <Card l="Progress">{String(p.progress)}%</Card>
            <Card l="Install tasks">{installs.length}</Card>
          </section>
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-semibold">Phase progression</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-5">
              {[
                "design",
                "selections",
                "procurement",
                "installation",
                "complete",
              ].map((x) => (
                <div
                  key={x}
                  className={`rounded-xl p-4 text-sm font-semibold capitalize ${x === p.phase ? "bg-emerald-800 text-white" : "bg-stone-100"}`}
                >
                  {x}
                </div>
              ))}
            </div>
          </section>
          <StateForm p={p} />
        </>
      ) : null}
      {tab === "selections" ? (
        <JsonList
          title="Approved project selections"
          values={Array.isArray(p.selections) ? p.selections : []}
          empty="No property-specific selections have been approved."
        />
      ) : null}
      {tab === "budget" ? (
        <section className="grid gap-4 md:grid-cols-3">
          {Object.entries(budget).map(([k, v]) => (
            <Card key={k} l={k.replaceAll("_", " ")}>
              <Money value={v} />
            </Card>
          ))}
        </section>
      ) : null}
      {tab === "procurement" ? (
        <JsonList
          title="Procurement orders"
          values={orders}
          empty="No purchase orders exist for this project."
        />
      ) : null}
      {tab === "installation" ? (
        <JsonList
          title="Installation checklist"
          values={installs}
          empty="No installation tasks are scheduled."
        />
      ) : null}
      {tab === "files" ? (
        <JsonList
          title="Project files"
          values={[]}
          empty="No files have been uploaded."
        />
      ) : null}
      {tab === "activity" ? (
        <JsonList
          title="Activity history"
          values={activity}
          empty="No activity has been recorded."
        />
      ) : null}
    </main>
  );
}
function StateForm({ p }: { p: Record<string, unknown> }) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-semibold">Project state</h2>
      <form
        action={updateFurnishingProjectAction}
        className="mt-4 flex flex-wrap gap-3"
      >
        <input type="hidden" name="projectId" value={String(p.id)} />
        <select
          name="status"
          defaultValue={String(p.status)}
          className="rounded-xl border px-3 py-2"
        >
          {PROJECT_STATUSES.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          name="phase"
          defaultValue={String(p.phase)}
          className="rounded-xl border px-3 py-2"
        >
          {PROJECT_PHASES.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input name="authorizeException" type="checkbox" />
          Authorize punch-list exception
        </label>
        <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
          Record change
        </button>
      </form>
    </section>
  );
}
function Card({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <p className="text-xs font-bold uppercase text-stone-500">{l}</p>
      <p className="mt-3 text-2xl font-semibold">{children}</p>
    </article>
  );
}
function JsonList({
  title,
  values,
  empty,
}: {
  title: string;
  values: Record<string, unknown>[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {values.length ? (
        <div className="mt-4 space-y-3">
          {values.map((x, i) => (
            <article
              key={String(x.id ?? i)}
              className="rounded-xl bg-stone-50 p-4"
            >
              <p className="font-semibold">
                {String(
                  x.name ?? x.po_number ?? x.item_name ?? x.summary ?? "Record",
                )}
              </p>
              <p className="mt-1 text-sm capitalize text-stone-500">
                {String(x.status ?? x.event_type ?? "")}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-stone-50 p-8 text-center text-stone-500">
          {empty}
        </p>
      )}
    </section>
  );
}
