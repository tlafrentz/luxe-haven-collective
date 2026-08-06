import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Home,
  PackageCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import type { getCustomerFurnishingStudio } from "@/app/actions/furnishing-studio";
import { CustomerFurnishingNavigation } from "@/components/furnishing/customer-furnishing-navigation";
import { projectProgress } from "@/features/furnishing-studio";

type Data = Awaited<ReturnType<typeof getCustomerFurnishingStudio>>;
type Row = Record<string, unknown>;
type Section =
  | "overview"
  | "projects"
  | "packages"
  | "procurement"
  | "installation"
  | "analytics"
  | "settings";
const fallback =
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85";

export function CustomerFurnishingWorkspace({
  section,
  data,
}: {
  section: Section;
  data: Data;
}) {
  return (
    <main className="mx-auto max-w-[92rem] space-y-7 py-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a7142]">
            Launch a property
          </p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl">
            Furnishing Studio
          </h1>
          <p className="mt-3 max-w-2xl text-stone-600">
            From first concept to a fully furnished, launch-ready property.
          </p>
        </div>
        <Link
          href="/dashboard/furnishing/new"
          className="inline-flex items-center gap-2 rounded-full bg-[#17483b] px-6 py-3 text-sm font-semibold text-white"
        >
          Start a project <ArrowRight className="size-4" />
        </Link>
      </header>
      <CustomerFurnishingNavigation current={section} />
      {section === "overview" ? <Overview data={data} /> : null}
      {section === "projects" ? <Projects data={data} /> : null}
      {section === "packages" ? <Packages data={data} /> : null}
      {section === "procurement" ? <Procurement data={data} /> : null}
      {section === "installation" ? <Installation data={data} /> : null}
      {section === "analytics" ? <Analytics data={data} /> : null}
      {section === "settings" ? <Settings /> : null}
    </main>
  );
}

function Overview({ data }: { data: Data }) {
  const active = data.projects.filter(
    (item) => !["completed", "archived"].includes(String(item.status)),
  );
  const budget = data.projects.reduce(
    (sum, item) => sum + Number((item.budget as Row)?.target ?? 0),
    0,
  );
  const committed = data.orders.reduce(
    (sum, item) => sum + Number(item.total ?? 0),
    0,
  );
  const installed = data.installations.filter(
    (item) => item.status === "installed",
  ).length;
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Active projects"
          value={String(active.length)}
          icon={<Sparkles />}
        />
        <Metric
          label="Project budget"
          value={money(budget)}
          icon={<CircleDollarSign />}
        />
        <Metric
          label="Committed"
          value={money(committed)}
          icon={<PackageCheck />}
        />
        <Metric
          label="Items installed"
          value={String(installed)}
          icon={<CheckCircle2 />}
        />
        <Metric
          label="Launch ready"
          value={String(
            data.projects.filter((item) => item.phase === "complete").length,
          )}
          icon={<Clock3 />}
        />
      </section>
      {data.projects.length ? (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-3xl">Your launch projects</h2>
            <Link
              href="/dashboard/furnishing/projects"
              className="text-sm font-semibold text-[#17483b]"
            >
              View all projects →
            </Link>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {data.projects.slice(0, 4).map((project) => (
              <ProjectCard
                key={String(project.id)}
                project={project as Row}
                orders={data.orders.filter(
                  (item) => item.project_id === project.id,
                )}
                installations={data.installations.filter(
                  (item) => item.project_id === project.id,
                )}
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptyProject />
      )}
    </>
  );
}
function Projects({ data }: { data: Data }) {
  return data.projects.length ? (
    <div className="grid gap-5 lg:grid-cols-2">
      {data.projects.map((project) => (
        <ProjectCard
          key={String(project.id)}
          project={project as Row}
          orders={data.orders.filter((item) => item.project_id === project.id)}
          installations={data.installations.filter(
            (item) => item.project_id === project.id,
          )}
        />
      ))}
    </div>
  ) : (
    <EmptyProject />
  );
}
function Packages({ data }: { data: Data }) {
  return (
    <section>
      <h2 className="font-serif text-3xl">Furnishing packages</h2>
      <p className="mt-2 text-stone-600">
        Proven room systems tailored to hospitality properties and launch goals.
      </p>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {data.packages.map((pkg, index) => {
          const variants = data.variants.filter(
            (item) => item.package_id === pkg.id,
          );
          return (
            <article
              key={String(pkg.id)}
              className="overflow-hidden rounded-[1.5rem] border bg-white"
            >
              <div className="relative aspect-[16/10]">
                <Image
                  src={String(pkg.cover_image || fallback)}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7142]">
                  {["Essential", "Elevated", "Luxury"][index] ??
                    String(pkg.budget_tier)}
                </p>
                <h3 className="mt-2 font-serif text-2xl">{String(pkg.name)}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  {String(pkg.description)}
                </p>
                <p className="mt-5 text-2xl font-semibold">
                  {money(
                    Number(
                      variants[0]?.estimated_budget ?? pkg.starting_budget,
                    ),
                  )}
                </p>
                <p className="text-xs text-stone-400">starting estimate</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function Procurement({ data }: { data: Data }) {
  return (
    <section>
      <h2 className="font-serif text-3xl">Procurement & shipments</h2>
      <p className="mt-2 text-stone-600">
        Every approved order and delivery milestone in one place.
      </p>
      <div className="mt-6 space-y-4">
        {data.orders.length ? (
          data.orders.map((order) => (
            <article
              key={String(order.id)}
              className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-stone-400">
                  {String(order.po_number)}
                </p>
                <h3 className="mt-1 font-semibold">{String(order.vendor)}</h3>
              </div>
              <Status value={String(order.status)} />
              <div>
                <p className="text-xs text-stone-400">Estimated delivery</p>
                <p className="mt-1 text-sm font-semibold">
                  {order.estimated_delivery
                    ? date(order.estimated_delivery)
                    : "Scheduling"}
                </p>
              </div>
              <p className="font-serif text-xl">{money(Number(order.total))}</p>
            </article>
          ))
        ) : (
          <Empty
            title="No orders yet"
            description="Approved room designs will become a grouped shopping list before anything is ordered."
          />
        )}
      </div>
    </section>
  );
}
function Installation({ data }: { data: Data }) {
  const grouped = Object.groupBy(data.installations, (item) =>
    String(item.room),
  );
  return (
    <section>
      <h2 className="font-serif text-3xl">Installation</h2>
      <p className="mt-2 text-stone-600">
        Room-by-room receiving, placement, and launch preparation.
      </p>
      {data.installations.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {Object.entries(grouped).map(([room, tasks]) => {
            const values = tasks ?? [];
            const done = values.filter(
              (item) => item.status === "installed",
            ).length;
            return (
              <article key={room} className="rounded-2xl border bg-white p-6">
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.15em] text-[#9a7142]">
                      Room
                    </p>
                    <h3 className="mt-1 font-serif text-2xl">{room}</h3>
                  </div>
                  <span className="text-sm font-semibold">
                    {done}/{values.length}
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-[#3c816d]"
                    style={{
                      width: `${values.length ? (done / values.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <ul className="mt-5 space-y-2">
                  {values.slice(0, 5).map((task) => (
                    <li
                      key={String(task.id)}
                      className="flex items-center gap-2 text-sm text-stone-600"
                    >
                      {task.status === "installed" ? (
                        <CheckCircle2 className="size-4 text-emerald-700" />
                      ) : (
                        <Box className="size-4 text-stone-300" />
                      )}
                      {String(task.item_name)}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Installation begins after delivery"
          description="Receiving and room checklists will appear as products arrive."
        />
      )}
    </section>
  );
}
function Analytics({ data }: { data: Data }) {
  const completed = data.installations.filter(
    (item) => item.status === "installed",
  ).length;
  const total = data.installations.length;
  const delivered = data.orders.filter(
    (item) => item.status === "delivered",
  ).length;
  return (
    <section>
      <h2 className="font-serif text-3xl">Launch analytics</h2>
      <p className="mt-2 text-stone-600">
        Project momentum, budget completion, and readiness—not vanity metrics.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Project completion"
          value={`${average(data.projects.map((item) => Number(item.progress ?? projectProgress(String(item.phase) as never))))}%`}
          icon={<Sparkles />}
        />
        <Metric
          label="Installation completion"
          value={`${total ? Math.round((completed / total) * 100) : 0}%`}
          icon={<CheckCircle2 />}
        />
        <Metric
          label="Orders delivered"
          value={`${delivered}/${data.orders.length}`}
          icon={<Truck />}
        />
        <Metric
          label="Launch-ready properties"
          value={String(
            data.projects.filter((item) => item.phase === "complete").length,
          )}
          icon={<HomeIcon />}
        />
      </div>
    </section>
  );
}
function Settings() {
  return (
    <section>
      <h2 className="font-serif text-3xl">Studio settings</h2>
      <p className="mt-2 text-stone-600">
        Communication, approvals, and launch preferences.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[
          [
            "Project notifications",
            "Order shipped, item delayed, installation ready, and launch-ready alerts.",
          ],
          [
            "Budget approvals",
            "Require explicit approval before orders move into procurement.",
          ],
          [
            "Design collaboration",
            "Share mood boards and selection changes with project stakeholders.",
          ],
          [
            "Guidebook handoff",
            "Prepare property context for Guidebook Studio at launch readiness.",
          ],
        ].map(([title, description]) => (
          <article key={title} className="rounded-2xl border bg-white p-6">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {description}
            </p>
            <button className="mt-4 rounded-full border px-4 py-2 text-xs font-semibold">
              Configure
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  orders,
  installations,
}: {
  project: Row;
  orders: Row[];
  installations: Row[];
}) {
  const property = (project.properties as Row) ?? {};
  const installed = installations.filter(
    (item) => item.status === "installed",
  ).length;
  return (
    <Link
      href={`/dashboard/furnishing/projects/${String(project.id)}`}
      className="group overflow-hidden rounded-[1.5rem] border bg-white transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="grid sm:grid-cols-[180px_1fr]">
        <div className="relative min-h-48">
          <Image
            src={String(property.featured_image || fallback)}
            alt=""
            fill
            className="object-cover"
          />
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Status value={String(project.phase)} />
              <h3 className="mt-3 font-serif text-2xl">
                {String(project.name)}
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                {String(property.name ?? "Property launch")}
              </p>
            </div>
            <ArrowRight className="size-5 text-stone-300 transition group-hover:translate-x-1 group-hover:text-[#17483b]" />
          </div>
          <div className="mt-5 h-2 rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-[#3c816d]"
              style={{
                width: `${Number(project.progress ?? projectProgress(String(project.phase) as never))}%`,
              }}
            />
          </div>
          <div className="mt-4 flex justify-between text-xs text-stone-500">
            <span>{orders.length} orders</span>
            <span>
              {installed}/{installations.length} installed
            </span>
            <span>{money(Number((project.budget as Row)?.target ?? 0))}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
function EmptyProject() {
  return (
    <Empty
      title="Furnish beautifully. Launch faster."
      description="Start with a property, package, rooms, and target budget. Furnishing Studio will turn that brief into an executable launch project."
      action={
        <Link
          href="/dashboard/furnishing/new"
          className="rounded-full bg-[#17483b] px-6 py-3 text-sm font-semibold text-white"
        >
          Start your first project
        </Link>
      }
    />
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-dashed bg-[#faf8f3] p-10 text-center">
      <h3 className="font-serif text-3xl">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-500">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <span className="grid size-9 place-items-center rounded-xl bg-[#edf3ef] text-[#17483b] [&_svg]:size-4">
        {icon}
      </span>
      <p className="mt-5 text-xs font-bold uppercase tracking-[.15em] text-stone-400">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
    </article>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-[#edf3ef] px-3 py-1 text-xs font-semibold capitalize text-[#17483b]">
      {value.replaceAll("_", " ")}
    </span>
  );
}
function HomeIcon() {
  return <Home className="size-4" />;
}
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
const date = (value: unknown) =>
  new Date(String(value)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const average = (values: number[]) =>
  values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
