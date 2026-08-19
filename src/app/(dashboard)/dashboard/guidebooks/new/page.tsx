import Link from "next/link";
import { createGuidebookAction, createGuidebookPropertyAction, listGuidebookPropertyOptionsAction } from "@/app/actions/guidebook-authoring";
import { getGuidebookStudioRequest } from "@/app/actions/guidebook-studio";
import { GuidebookPublishingWizard } from "@/features/guidebook-onboarding/guidebook-publishing-wizard";

// Auto-create's extraction/generation server actions trigger AI provider
// work inline (Hobby-plan crons only run daily, so cron-driven draining
// isn't viable) — allow up to the provider's own timeout budget.
export const maxDuration = 60;

export default async function NewGuidebookPage({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    propertyName?: string;
    propertyType?: string;
    bedrooms?: string;
    guestCapacity?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    timezone?: string;
  }>;
}) {
  const params = await searchParams;
  const result = await getGuidebookStudioRequest(undefined, {
    propertyId: params.property,
  });

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-2xl py-10">
        <section
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-6"
        >
          Guidebook Studio is unavailable. Existing publications remain
          unchanged.
        </section>
      </main>
    );
  }

  if (!result.projection.permissions.manage) {
    return (
      <main className="mx-auto max-w-2xl py-10">
        <h1 className="text-2xl font-semibold">
          Guidebook creation is unavailable
        </h1>
        <p className="mt-2 text-stone-600">
          Your role can view guidebooks but cannot create or edit them.
        </p>
        <Link
          href="/dashboard/guidebooks"
          className="mt-4 inline-block font-semibold underline"
        >
          Return to Guidebook Studio
        </Link>
      </main>
    );
  }

  if (!result.entitlements.create) {
    return (
      <main className="mx-auto max-w-2xl py-10">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
          <h1 className="text-2xl font-semibold">
            Guidebook Studio isn&apos;t enabled
          </h1>
          <p className="mt-2 text-sm">
            Unlock guidebook creation for this workspace, or request access from
            an administrator.
          </p>
          <div className="mt-5 flex gap-3">
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
      </main>
    );
  }

  const eligible = await listGuidebookPropertyOptionsAction(result.workspaceId);

  return (
    <GuidebookPublishingWizard
      workspaceId={result.workspaceId}
      properties={eligible}
      createAction={createGuidebookAction}
      createPropertyAction={createGuidebookPropertyAction}
      initialPropertyId={
        eligible.some((property) => property.id === params.property)
          ? params.property
          : undefined
      }
      initialPropertyFields={{
        name: params.propertyName ?? "",
        propertyType: params.propertyType ?? "single_family_home",
        bedrooms: params.bedrooms ?? "",
        guestCapacity: params.guestCapacity ?? "2",
        address: params.address ?? "",
        city: params.city ?? "",
        state: params.state ?? "",
        country: params.country ?? "US",
        timezone: params.timezone ?? "America/Chicago",
      }}
    />
  );
}
