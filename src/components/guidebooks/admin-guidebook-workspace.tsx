import Link from "next/link";
import { getGuidebookStudioRequest } from "@/app/actions/guidebook-studio";
import { AdminGuidebookNavigation } from "./admin-guidebook-navigation";
import { LibraryOverviewSection } from "./canonical-library-workspace";

export type AdminGuidebookView =
  | "overview"
  | "guidebooks"
  | "content-library"
  | "experience-components"
  | "templates"
  | "media"
  | "analytics"
  | "settings";

const titleByView: Record<AdminGuidebookView, [string, string]> = {
  overview: [
    "Guidebook Studio",
    "Create, manage, and publish premium guest experiences.",
  ],
  guidebooks: ["Guidebooks", "Manage guidebooks across every property."],
  "content-library": [
    "Content Library",
    "Govern reusable hospitality content and its usage.",
  ],
  "experience-components": [
    "Experience Components",
    "Manage reusable guest-facing interface blocks.",
  ],
  templates: [
    "Templates",
    "Choose consistent structures for branded guest experiences.",
  ],
  media: [
    "Media Library",
    "Manage approved assets and understand where they are used.",
  ],
  analytics: [
    "Guest engagement",
    "Understand privacy-safe usage across published guidebooks.",
  ],
  settings: [
    "Studio settings",
    "Configure publishing governance and portal defaults.",
  ],
};

export async function AdminGuidebookWorkspace({
  view,
}: Readonly<{ view: AdminGuidebookView }>) {
  const result = await getGuidebookStudioRequest(undefined, {
    pageSize: 50,
    sort: "updated",
  });
  const [title, description] = titleByView[view];
  if (!result.ok)
    return (
      <main className="mx-auto max-w-7xl px-5 py-10">
        <section
          role="alert"
          className="rounded-3xl border border-amber-200 bg-amber-50 p-7"
        >
          <h1 className="text-2xl font-semibold">
            Guidebook Studio is unavailable
          </h1>
          <p className="mt-2 text-sm text-amber-950">
            The active workspace could not be authorized for Guidebook Studio.
            Published guest experiences remain unchanged.
          </p>
        </section>
      </main>
    );

  const { projection } = result;
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
            Guest experience CMS
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-stone-600">{description}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/guidebooks"
            className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            View customer workspace
          </Link>
          {projection.permissions.manage && projection.entitlements.create ? (
            <Link
              href="/dashboard/guidebooks/new"
              className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
            >
              + New guidebook
            </Link>
          ) : null}
        </div>
      </header>
      <AdminGuidebookNavigation current={view} />
      {view === "overview" ? <Overview projection={projection} /> : null}
      {view === "guidebooks" ? <GuidebookList projection={projection} /> : null}
      {view === "analytics" ? <Analytics projection={projection} /> : null}
      {view === "settings" ? <Settings /> : null}
    </main>
  );
}

type Projection = Extract<
  Awaited<ReturnType<typeof getGuidebookStudioRequest>>,
  { ok: true }
>["projection"];
function Card({
  label,
  value,
  note,
}: Readonly<{ label: string; value: string | number; note?: string }>) {
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      {note ? <p className="mt-2 text-xs text-emerald-700">{note}</p> : null}
    </article>
  );
}
function Overview({ projection }: Readonly<{ projection: Projection }>) {
  const published = projection.library.filter((x) => x.status === "published");
  const archived = projection.library.filter(
    (x) => x.status === "archived",
  ).length;
  const operations = [
    [
      "Published",
      published.length,
      published.length
        ? "Live guest experiences"
        : "Publish your first guidebook",
      "/admin/guidebooks/guidebooks",
      "View guidebooks",
    ],
    [
      "Draft",
      projection.portfolio.draftGuidebooks,
      projection.portfolio.draftGuidebooks
        ? "In progress"
        : "No drafts in progress",
      "/admin/guidebooks/guidebooks?status=draft",
      "Continue editing",
    ],
    [
      "Needs review",
      projection.portfolio.requiringAttention,
      projection.portfolio.requiringAttention
        ? "Requires attention"
        : "Everything is current",
      "/admin/guidebooks/guidebooks?status=needs-update",
      "Review guidebooks",
    ],
    [
      "Archived",
      archived,
      archived ? "Not in use" : "No archived guidebooks",
      "/admin/guidebooks/guidebooks?status=archived",
      "View archived",
    ],
    [
      "Property coverage",
      `${published.length}/${projection.portfolio.totalProperties}`,
      `${projection.portfolio.unpublishedProperties} ${projection.portfolio.unpublishedProperties === 1 ? "property has" : "properties have"} no published guidebook`,
      "/admin/guidebooks/guidebooks",
      "View coverage",
    ],
  ] as const;
  const attention = [...projection.library]
    .sort(
      (a, b) =>
        Number(b.health.requiresAttention) - Number(a.health.requiresAttention),
    )
    .slice(0, 5);
  return (
    <>
      <LibraryOverviewSection />
      <section aria-labelledby="guidebook-operations">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">
            Guidebook operations
          </p>
          <h2 id="guidebook-operations" className="mt-1 text-xl font-semibold">
            Publishing and property coverage
          </h2>
        </div>
        <div className="mt-4 grid overflow-hidden rounded-2xl border bg-white sm:grid-cols-2 xl:grid-cols-5">
          {operations.map(([label, value, note, href, action]) => (
            <article
              key={label}
              className="border-b p-5 last:border-b-0 sm:border-r xl:border-b-0"
            >
              <p className="text-xs font-semibold text-stone-600">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
              <p className="mt-1 min-h-8 text-xs text-stone-500">{note}</p>
              <Link
                href={href}
                className="mt-2 inline-flex text-xs font-semibold text-emerald-800"
              >
                {action} →
              </Link>
            </article>
          ))}
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">
                Guidebooks requiring attention
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                What should I work on next?
              </h2>
            </div>
            <Link
              href="/admin/guidebooks/guidebooks"
              className="text-sm font-semibold text-emerald-800"
            >
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {attention.map((item) => (
              <div
                key={item.property.id}
                className="grid gap-3 rounded-xl border bg-stone-50 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    role="img"
                    aria-label={`${item.property.name} property`}
                    className="hidden size-16 shrink-0 rounded-lg bg-stone-200 bg-cover bg-center sm:block"
                    style={
                      item.property.featuredImage
                        ? {
                            backgroundImage: `url(${item.property.featuredImage})`,
                          }
                        : undefined
                    }
                  />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {item.guidebook?.title ?? item.property.name}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {item.property.name} ·{" "}
                      <span
                        className={
                          item.health.requiresAttention
                            ? "font-semibold text-amber-800"
                            : "font-semibold text-emerald-800"
                        }
                      >
                        {item.health.requiresAttention
                          ? "Needs attention"
                          : "Healthy"}
                      </span>
                    </p>
                    {item.requiredSections.missing.length ? (
                      <p className="mt-2 text-xs text-stone-600">
                        <strong>Missing:</strong>{" "}
                        {item.requiredSections.missing
                          .slice(0, 4)
                          .map(humanize)
                          .join(", ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-stone-600">
                        Ready for its next publishing step.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Status value={item.status} />
                  <Link
                    href={
                      item.suggestedActions[0]?.href ??
                      (item.guidebook
                        ? `/dashboard/guidebooks/${item.guidebook.id}`
                        : `/dashboard/guidebooks/new?property=${item.property.id}`)
                    }
                    className="rounded-lg border border-emerald-700 bg-white px-3 py-2 text-xs font-semibold text-emerald-800"
                  >
                    {item.suggestedActions[0]?.label ?? "Open guidebook"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">
            Recent activity
          </p>
          <h2 className="mt-1 text-xl font-semibold">Recent activity</h2>
          <div className="mt-5 space-y-4">
            {projection.recentActivity.length ? (
              projection.recentActivity.slice(0, 7).map((item) => (
                <div key={item.id} className="border-l-2 border-amber-400 pl-3">
                  <p className="text-sm font-semibold">
                    {businessActivity(item.summary, item.eventType)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {relativeTime(item.occurredAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-stone-50 p-5 text-sm text-stone-500">
                No guidebook activity has been recorded.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-5 py-4 text-sm text-stone-600">
        <p>
          Guidebook Studio helps you deliver consistent, branded guest
          experiences. Build once in the libraries, publish everywhere.
        </p>
        <Link
          href="/admin/guidebooks/content"
          className="font-semibold text-emerald-800"
        >
          Learn more about Guidebook Studio →
        </Link>
      </section>
    </>
  );
}

function humanize(value: string) {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function businessActivity(summary: string, eventType: string) {
  if (/guidebook command/i.test(summary))
    return /fail/i.test(summary)
      ? "Guidebook update failed"
      : "Guidebook updated";
  const normalized = summary
    .replaceAll(/\bcommand\b/gi, "update")
    .replaceAll(/\bentered\b/gi, "started")
    .replaceAll(/\bcompleted\b/gi, "completed");
  if (/publish/i.test(eventType) && !/publish/i.test(normalized))
    return "Guidebook published";
  return normalized;
}

function relativeTime(value: string) {
  const seconds = Math.round((Date.parse(value) - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}
function GuidebookList({ projection }: Readonly<{ projection: Projection }>) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap gap-3 border-b p-4">
        <input
          aria-label="Search guidebooks"
          placeholder="Search guidebooks…"
          className="min-w-64 flex-1 rounded-xl border px-3 py-2"
        />
        <select
          aria-label="Status filter"
          className="rounded-xl border px-3 py-2"
        >
          <option>All statuses</option>
          <option>Draft</option>
          <option>Published</option>
          <option>Archived</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">
            Guidebooks in the active workspace
          </caption>
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="p-4">Guidebook</th>
              <th className="p-4">Property</th>
              <th className="p-4">Status</th>
              <th className="p-4">Coverage</th>
              <th className="p-4">Last updated</th>
              <th className="p-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {projection.library.map((item) => (
              <tr key={item.property.id} className="border-t">
                <td className="p-4 font-semibold">
                  {item.guidebook?.title ?? "Not created"}
                </td>
                <td className="p-4">{item.property.name}</td>
                <td className="p-4">
                  <Status value={item.status} />
                </td>
                <td className="p-4">
                  {item.requiredSections.complete}/{item.requiredSections.total}{" "}
                  sections
                </td>
                <td className="p-4 text-stone-600">
                  {new Date(item.lastUpdatedAt).toLocaleDateString()}
                </td>
                <td className="p-4 text-right">
                  {item.guidebook ? (
                    <Link
                      className="font-semibold text-emerald-800"
                      href={`/admin/guidebooks/${item.guidebook.id}`}
                    >
                      Edit
                    </Link>
                  ) : (
                    <Link
                      className="font-semibold text-emerald-800"
                      href={`/dashboard/guidebooks/new?property=${item.property.id}`}
                    >
                      Create
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ContentLibrary({ projection }: Readonly<{ projection: Projection }>) {
  const keys = new Map<string, number>();
  projection.library.forEach((item) =>
    item.requiredSections.missing.forEach((key) =>
      keys.set(key, (keys.get(key) ?? 0) + 1),
    ),
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_.65fr]">
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Reusable content readiness</h2>
        <p className="mt-2 text-sm text-stone-600">
          Coverage is derived from canonical guidebook sections. Shared
          propagation remains disabled until a reusable-content record exists.
        </p>
        <div className="mt-5 divide-y">
          {[
            "Wi-Fi",
            "Parking",
            "House Rules",
            "Amenities",
            "Emergency",
            "Restaurants",
            "Transportation",
            "Checkout",
          ].map((label) => (
            <div key={label} className="flex items-center justify-between py-4">
              <div>
                <p className="font-semibold">{label}</p>
                <p className="text-xs text-stone-500">
                  Used across property guidebooks
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">
                {projection.library.length -
                  (keys.get(label.toLowerCase()) ?? 0)}{" "}
                guidebooks
              </span>
            </div>
          ))}
        </div>
      </section>
      <GovernedEmpty
        title="Shared content propagation is not configured"
        description="Creating one reusable block that updates many published guidebooks requires an explicit versioned content model and per-guidebook approval state."
        action="Existing property content remains authoritative"
      />
    </div>
  );
}
function Templates() {
  return (
    <section>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Luxury", "Premium editorial presentation"],
          ["Boutique", "Warm, character-led layout"],
          ["Beach", "Light destination experience"],
          ["Urban", "Compact city-first navigation"],
          ["Family", "Practical stay planning"],
          ["Cabin", "Natural, relaxed styling"],
          ["Minimal", "Focused essential content"],
          ["Custom", "Workspace-owned theme"],
        ].map(([name, note], index) => (
          <article
            key={name}
            className="overflow-hidden rounded-2xl border bg-white"
          >
            <div
              className={`h-32 ${index % 3 === 0 ? "bg-stone-900" : index % 3 === 1 ? "bg-[#e8ddc9]" : "bg-[#dbeceb]"}`}
            />
            <div className="p-5">
              <h2 className="font-semibold">{name}</h2>
              <p className="mt-1 text-sm text-stone-500">{note}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-amber-700">
                Design system preview
              </p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Template selection is preview-only until canonical template versions and
        publication approvals are persisted.
      </p>
    </section>
  );
}
function Analytics({ projection }: Readonly<{ projection: Projection }>) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Published guidebooks"
          value={projection.portfolio.publishedGuidebooks}
        />
        <Card
          label="Properties covered"
          value={projection.portfolio.totalProperties}
        />
        <Card
          label="Content needing attention"
          value={projection.portfolio.requiringAttention}
        />
        <Card label="Analytics status" value="Privacy safe" />
      </section>
      <GovernedEmpty
        title="Insufficient usage data"
        description="Engagement metrics appear only after canonical anonymous events are recorded for published guidebooks. Counts will not be presented as verified guests."
        action="No inferred or fabricated engagement data"
      />
    </>
  );
}
function Settings() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SettingCard
        title="Portal"
        items={[
          "Logo and brand colors",
          "Typography",
          "Footer content",
          "Default language",
        ]}
      />
      <SettingCard
        title="Publishing"
        items={[
          "Approval required",
          "Version history",
          "Archive policy",
          "Scheduled publishing",
        ]}
      />
      <SettingCard
        title="Integrations"
        items={[
          "Google Maps",
          "QR codes",
          "PDF delivery",
          "Property management systems",
        ]}
      />
      <SettingCard
        title="Permissions"
        items={["Administrator", "Editor", "Reviewer", "Owner preview"]}
      />
    </div>
  );
}
function SettingCard({
  title,
  items,
}: Readonly<{ title: string; items: string[] }>) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 divide-y">
        {items.map((item) => (
          <div key={item} className="flex items-center justify-between py-4">
            <span className="text-sm font-medium">{item}</span>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
              Default
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-stone-500">
        Configuration controls activate when the corresponding canonical
        settings contract is available.
      </p>
    </section>
  );
}
function GovernedEmpty({
  title,
  description,
  action,
}: Readonly<{ title: string; description: string; action: string }>) {
  return (
    <section className="grid min-h-56 place-items-center rounded-2xl border border-dashed bg-white p-8 text-center">
      <div>
        <div
          aria-hidden="true"
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-stone-100 text-xl"
        >
          ✓
        </div>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-stone-600">
          {description}
        </p>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-emerald-700">
          {action}
        </p>
      </div>
    </section>
  );
}
function Status({ value }: Readonly<{ value: string }>) {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">
      {value.replaceAll("-", " ")}
    </span>
  );
}
