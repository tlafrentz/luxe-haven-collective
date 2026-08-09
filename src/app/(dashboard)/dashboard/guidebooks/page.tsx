import Link from "next/link";
import {
  GuidebookPageHeader,
  GuidebookMetricCard,
  GuidebookStatusBadge,
} from "@/components/guidebooks/guidebook-ui";
import { getGuidebookStudioRequest } from "@/app/actions/guidebook-studio";
import { filterGuidebookLibrary } from "@/features/guidebook-studio";
import { GuidebookEmptyState } from "@/components/guidebooks/guidebook-empty-state";
export default async function GuidebookWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    property?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams,
    page = Math.max(1, Number(params.page) || 1),
    result = await getGuidebookStudioRequest(undefined, {
      page,
      pageSize: 25,
      q: params.q,
      status: params.status,
      sort: params.sort,
      propertyId: params.property,
    });
  if (!result.ok) {
    const denied = result.code === "permission_denied",
      entitlement = result.code === "entitlement_required";
    return (
      <main className="mx-auto max-w-5xl py-10">
        <section
          role="alert"
          className="rounded-3xl border border-amber-200 bg-amber-50 p-7"
        >
          <h1 className="text-xl font-semibold">
            {denied
              ? "Guidebook Studio access denied"
              : entitlement
                ? "Guidebook Studio is not enabled"
                : "Guidebook Studio could not be loaded"}
          </h1>
          <p className="mt-2 text-sm text-amber-950">
            {denied
              ? "Your active workspace or role does not include Guidebook Studio."
              : entitlement
                ? "This workspace does not currently include Guidebook Studio. Published guest experiences remain available."
                : "Guidebook data did not complete loading. Published guidebooks remain online; retry, then share the diagnostic details with support if the problem continues."}
          </p>
          {"correlationId" in result ? (
            <p className="mt-3 font-mono text-xs">
              Diagnostic {result.diagnosticCode} · Correlation{" "}
              {result.correlationId}
            </p>
          ) : null}
          <div className="mt-4 flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border px-4 py-2 text-sm font-semibold"
            >
              Return to dashboard
            </Link>
            <Link
              href="/dashboard/settings"
              className="rounded-full border px-4 py-2 text-sm font-semibold"
            >
              {denied ? "Review access" : "Workspace settings"}
            </Link>
          </div>
        </section>
      </main>
    );
  }
  const sort =
      params.sort === "updated" ||
      params.sort === "published" ||
      params.sort === "status"
        ? params.sort
        : "property",
    library = filterGuidebookLibrary(result.projection.library, {
      query: params.q,
      status: params.status,
      sort,
    }),
    selected = result.projection.library.find(
      (item) =>
        item.property.id === (params.property ?? library[0]?.property.id),
    ),
    canCreate =
      result.projection.permissions.manage &&
      result.projection.entitlements.create;
  return (
    <main className="mx-auto max-w-7xl space-y-7 py-8">
      <GuidebookPageHeader
        eyebrow="Guest experience operations"
        title="Guidebook Operations"
        description="See exactly what guest experience is published for every property, what has changed, and what requires attention."
        actions={canCreate ? (
          <Link
            href="/dashboard/guidebooks/new"
            className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Create Guidebook
          </Link>
        ) : null}
      />
      {result.projection.onboarding === "not-entitled" ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
          <h2 className="text-xl font-semibold">
            Guidebook Studio isn&apos;t enabled for this workspace
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-amber-950">
            Unlock Guidebook Studio to create and publish digital guest
            guidebooks. Property information and existing public experiences
            remain unchanged.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/dashboard/billing"
              className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Upgrade
            </Link>
            <Link
              href="/dashboard/settings"
              className="rounded-full border bg-white px-5 py-2.5 text-sm font-semibold"
            >
              Request Access
            </Link>
          </div>
        </section>
      ) : null}
      <section
        aria-label="Portfolio summary"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <GuidebookMetricCard
          label="Properties"
          value={result.projection.portfolio.totalProperties}
        />
        <GuidebookMetricCard
          label="Published"
          value={result.projection.portfolio.publishedGuidebooks}
        />
        <GuidebookMetricCard
          label="Drafts"
          value={result.projection.portfolio.draftGuidebooks}
        />
        <GuidebookMetricCard
          label="Needs attention"
          value={result.projection.portfolio.requiringAttention}
        />
        <GuidebookMetricCard
          label="Unpublished"
          value={result.projection.portfolio.unpublishedProperties}
        />
        <GuidebookMetricCard
          label="Last published"
          value={
            result.projection.portfolio.lastPublishedAt
              ? new Date(
                  result.projection.portfolio.lastPublishedAt,
                ).toLocaleDateString()
              : "Never"
          }
        />
      </section>
      <form className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4">
        <label className="text-sm font-medium">
          Search
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Property, guidebook, version…"
            className="mt-1 block w-full rounded-xl border px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          Status
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="mt-1 block w-full rounded-xl border px-3 py-2"
          >
            <option value="">All guidebooks</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="needs-attention">Needs attention</option>
            <option value="unpublished">Unpublished</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Sort
          <select
            name="sort"
            defaultValue={sort}
            className="mt-1 block w-full rounded-xl border px-3 py-2"
          >
            <option value="property">Property</option>
            <option value="updated">Updated</option>
            <option value="published">Published</option>
            <option value="status">Status</option>
          </select>
        </label>
        <button className="self-end rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
          Apply filters
        </button>
      </form>
      {result.projection.onboarding === "entitled-empty" ? (
        <GuidebookEmptyState
          hasProperties={result.projection.portfolio.totalProperties > 0}
          addPropertyHref="/dashboard/workspace/connected-systems"
          createHref="/dashboard/guidebooks/new"
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,.8fr)]">
          <section
            aria-labelledby="library-title"
            className="overflow-hidden rounded-3xl border bg-white"
          >
            <div className="border-b px-5 py-4">
              <h2 id="library-title" className="font-semibold">
                Guidebook Library
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                {library.length} properties match the current workspace view.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Property</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Draft</th>
                    <th className="px-4 py-3">Public URL</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {library.map((item) => (
                    <tr
                      key={item.property.id}
                      className={`border-t ${selected?.property.id === item.property.id ? "bg-emerald-50" : "hover:bg-stone-50"}`}
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={selectionHref(params, item.property.id)}
                          className="font-semibold text-stone-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          {item.property.name}
                        </Link>
                        <p className="mt-1 text-xs capitalize text-stone-500">
                          {item.health.label}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <GuidebookStatusBadge value={item.badgeState} />
                      </td>
                      <td className="px-4 py-4">
                        {item.currentVersion || "—"}
                      </td>
                      <td className="px-4 py-4">
                        {item.draftAvailable ? "Available" : "—"}
                      </td>
                      <td className="px-4 py-4 capitalize">
                        {item.publicUrl.status}
                      </td>
                      <td className="px-4 py-4">
                        {new Date(item.lastUpdatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!library.length ? (
              <div className="p-10 text-center">
                <p className="font-semibold">
                  No properties match these filters.
                </p>
                <p className="mt-2 text-sm text-stone-500">
                  Clear filters to restore the portfolio view.
                </p>
              </div>
            ) : null}
          </section>
          <PropertyPanel
            item={selected}
            canCreate={canCreate}
            canManage={result.projection.permissions.manage}
            canPublish={
              result.projection.entitlements.publish &&
              result.projection.entitlements.host
            }
          />
        </div>
      )}
      <nav
        aria-label="Guidebook library pages"
        className="flex items-center justify-between rounded-2xl border bg-white px-5 py-4 text-sm"
      >
        <span>
          Page {result.pagination.page} · {result.pagination.total} matching
          properties
        </span>
        <span className="flex gap-2">
          {result.pagination.hasPrevious ? (
            <Link
              className="rounded-full border px-4 py-2 font-semibold"
              href={pageHref(params, page - 1)}
            >
              Previous
            </Link>
          ) : null}
          {result.pagination.hasNext ? (
            <Link
              className="rounded-full border px-4 py-2 font-semibold"
              href={pageHref(params, page + 1)}
            >
              Next
            </Link>
          ) : null}
        </span>
      </nav>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border bg-white p-6">
          <h2 className="font-semibold">Recent Activity</h2>
          {result.projection.recentActivity.length ? (
            <ol className="mt-4 space-y-3">
              {result.projection.recentActivity.slice(0, 8).map((activity) => (
                <li
                  className="border-l-2 border-amber-400 pl-3"
                  key={activity.id}
                >
                  <p className="text-sm font-semibold capitalize">
                    {activity.eventType.replaceAll("-", " ")}
                  </p>
                  <p className="text-sm text-stone-600">{activity.summary}</p>
                  <time className="text-xs text-stone-500">
                    {new Date(activity.occurredAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-stone-500">
              No guidebook activity has been recorded yet.
            </p>
          )}
        </section>
        <section className="rounded-3xl border bg-white p-6">
          <h2 className="font-semibold">Suggested Actions</h2>
          {selected?.suggestedActions.length ? (
            <ul className="mt-4 space-y-3">
              {selected.suggestedActions.map((action) => (
                <li className="rounded-xl bg-stone-50 p-4" key={action.key}>
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-semibold">{action.label}</p>
                    <span className="text-xs font-semibold capitalize text-amber-800">
                      {action.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600">{action.reason}</p>
                  <Link
                    href={action.href}
                    className="mt-2 inline-block text-xs font-semibold underline"
                  >
                    Open action →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              This property&apos;s guidebook is operationally current.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
function PropertyPanel({
  item,
  canCreate,
  canManage,
  canPublish,
}: {
  item: ReturnType<typeof filterGuidebookLibrary>[number] | undefined;
  canCreate: boolean;
  canManage: boolean;
  canPublish: boolean;
}) {
  if (!item)
    return (
      <aside className="rounded-3xl border bg-white p-6">
        <h2 className="font-semibold">Property Details</h2>
        <p className="mt-3 text-sm text-stone-500">
          Select a property to inspect its guest experience.
        </p>
      </aside>
    );
  return (
    <aside className="space-y-5">
      <section className="rounded-3xl border bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          {item.status.replaceAll("-", " ")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{item.property.name}</h2>
        <p className="mt-2 text-sm text-stone-600">
          {item.property.address ||
            [item.property.city, item.property.state]
              .filter(Boolean)
              .join(", ") ||
            "Address unavailable"}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Fact label="Version" value={String(item.currentVersion || "None")} />
          <Fact
            label="Draft"
            value={item.draftAvailable ? "Available" : "None"}
          />
          <Fact
            label="Published"
            value={
              item.lastPublishedAt
                ? new Date(item.lastPublishedAt).toLocaleDateString()
                : "Never"
            }
          />
          <Fact label="Public URL" value={item.publicUrl.status} />
          <Fact
            label="Required content"
            value={`${item.requiredSections.complete}/${item.requiredSections.total}`}
          />
          <Fact label="Health" value={item.health.label} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {item.guidebook ? (
            <>
              <Link
                href={`/dashboard/guidebooks/${item.guidebook.id}/edit`}
                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
              >
                {canManage ? "Manage in Guidebook Studio" : "View details"}
              </Link>
              <Link
                href={`/guidebooks/${item.guidebook.id}/preview?viewport=desktop`}
                className="rounded-full border px-4 py-2 text-sm font-semibold"
              >
                Preview
              </Link>
              {item.publicUrl.path ? (
                <Link
                  href={item.publicUrl.path}
                  className="rounded-full border px-4 py-2 text-sm font-semibold"
                >
                  Open public guide
                </Link>
              ) : null}
            </>
          ) : canCreate ? (
            <Link
              href={`/dashboard/guidebooks/new?property=${item.property.id}`}
              className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Create in Guidebook Studio
            </Link>
          ) : null}
        </div>
        {item.status === "ready" && !canPublish ? (
          <p className="mt-3 text-xs text-amber-800">
            The draft is ready. Publishing access or hosting must be enabled
            before it can go live.
          </p>
        ) : null}
      </section>
      <section
        className={`rounded-3xl border p-6 ${item.health.requiresAttention ? "border-amber-200 bg-amber-50" : "bg-white"}`}
      >
        <h2 className="font-semibold">Guidebook Health</h2>
        <p className="mt-2 text-sm font-semibold capitalize">
          {item.health.label}
        </p>
        {item.health.reasons.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {item.health.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-sm text-stone-600">{item.health.recovery}</p>
      </section>
    </aside>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-1 capitalize">{value}</dd>
    </div>
  );
}
function selectionHref(
  params: { q?: string; status?: string; sort?: string },
  property: string,
) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.sort) query.set("sort", params.sort);
  query.set("property", property);
  return `?${query}`;
}
function pageHref(
  params: { q?: string; status?: string; sort?: string },
  page: number,
) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.sort) query.set("sort", params.sort);
  query.set("page", String(page));
  return `?${query}`;
}
