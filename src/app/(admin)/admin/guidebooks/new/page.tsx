import Link from "next/link";
import { AdminGuidebookNavigation } from "@/components/guidebooks/admin-guidebook-navigation";
import {
  createGuidebookAsAdminAction,
  listCustomerWorkspacesAction,
  listWorkspacePropertiesAction,
} from "@/app/actions/guidebook-admin-creation";
import { listGuidebookProducersAction } from "@/app/actions/guidebook-change-requests";

export const dynamic = "force-dynamic";

export default async function NewAdminGuidebookPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; property?: string; q?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
          Guidebook Studio
        </p>
        <h1 className="mt-2 text-4xl font-semibold">New guidebook</h1>
        <p className="mt-2 text-stone-600">
          Create a guidebook on behalf of a customer.
        </p>
      </header>
      <AdminGuidebookNavigation current="guidebooks" />

      <nav className="text-xs text-stone-500">
        <Link href="/admin/guidebooks/new">1. Customer</Link>
        {params.workspace ? (
          <>
            <span className="mx-2">›</span>
            <Link href={`/admin/guidebooks/new?workspace=${params.workspace}`}>
              2. Property
            </Link>
          </>
        ) : null}
        {params.workspace && params.property ? (
          <>
            <span className="mx-2">›</span>
            <span>3. Details</span>
          </>
        ) : null}
      </nav>

      {!params.workspace ? (
        <WorkspaceStep query={params.q} />
      ) : !params.property ? (
        <PropertyStep workspaceId={params.workspace} />
      ) : (
        <DetailsStep workspaceId={params.workspace} propertyId={params.property} />
      )}

      <Link
        href="/admin/guidebooks/guidebooks"
        className="inline-flex text-sm font-semibold text-emerald-800"
      >
        Cancel
      </Link>
    </main>
  );
}

async function WorkspaceStep({ query }: { query?: string }) {
  const customers = await listCustomerWorkspacesAction(query);
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">Select a customer</h2>
      <form method="get" className="mt-4">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name or email…"
          className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"
        />
      </form>
      {customers.length ? (
        <ul className="mt-5 divide-y divide-stone-100">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/admin/guidebooks/new?workspace=${customer.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:text-emerald-800"
              >
                <span>
                  <span className="block font-semibold">{customer.name}</span>
                  <span className="block text-xs text-stone-500">
                    {customer.email ?? "No email on file"}
                  </span>
                </span>
                <span className="text-sm font-semibold">Select →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-stone-500">No customers match.</p>
      )}
    </section>
  );
}

async function PropertyStep({ workspaceId }: { workspaceId: string }) {
  const properties = await listWorkspacePropertiesAction(workspaceId);
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">Select a property</h2>
      {properties.length ? (
        <ul className="mt-5 divide-y divide-stone-100">
          {properties.map((property) => (
            <li
              key={property.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <span>
                <span className="block font-semibold">{property.name}</span>
                <span className="block text-xs text-stone-500">
                  {property.location || "No location on file"}
                </span>
              </span>
              {property.existingGuidebookId ? (
                <Link
                  href={`/admin/guidebooks/${property.existingGuidebookId}`}
                  className="text-sm font-semibold text-stone-500 underline"
                >
                  Guidebook exists →
                </Link>
              ) : (
                <Link
                  href={`/admin/guidebooks/new?workspace=${workspaceId}&property=${property.id}`}
                  className="text-sm font-semibold text-emerald-800"
                >
                  Select →
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-stone-500">
          This customer has no properties yet. Add one from their workspace
          before creating a guidebook.
        </p>
      )}
      <Link
        href="/admin/guidebooks/new"
        className="mt-5 inline-flex text-sm font-semibold text-stone-500 underline"
      >
        ← Choose a different customer
      </Link>
    </section>
  );
}

async function DetailsStep({
  workspaceId,
  propertyId,
}: {
  workspaceId: string;
  propertyId: string;
}) {
  const producers = await listGuidebookProducersAction();
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">Guidebook details</h2>
      <form action={createGuidebookAsAdminAction} className="mt-5 space-y-4">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <label className="block text-sm font-medium text-stone-700">
          Title
          <input
            name="title"
            required
            placeholder="e.g. Mesa Modern Guest Guidebook"
            className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Authoring mode
          <select
            name="authoringMode"
            defaultValue="managed"
            className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"
          >
            <option value="managed">Managed service (Luxe Haven produces it)</option>
            <option value="self">Self-authoring (customer edits directly)</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Assigned producer
          <select
            name="producerId"
            defaultValue=""
            className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"
          >
            <option value="">Unassigned</option>
            {producers.map((producer) => (
              <option key={producer.id} value={producer.id}>
                {producer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Target publish date
          <input
            type="date"
            name="targetPublishDate"
            className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"
          />
        </label>
        <button className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white">
          Create guidebook
        </button>
      </form>
      <Link
        href={`/admin/guidebooks/new?workspace=${workspaceId}`}
        className="mt-5 inline-flex text-sm font-semibold text-stone-500 underline"
      >
        ← Choose a different property
      </Link>
    </section>
  );
}
