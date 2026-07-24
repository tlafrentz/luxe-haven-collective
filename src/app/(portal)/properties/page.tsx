import Link from "next/link";

import {
  WorkspaceActivity,
  WorkspaceContent,
  WorkspaceEmptyState,
  WorkspaceHeader,
  WorkspaceOverview,
  WorkspacePage,
} from "@/components/application-layout";
import {
  OperationalActivityTimeline,
  OperationalContextBar,
  OperationalDegradedState,
  OperationalPropertyCard,
  OperationalQualityIndicator,
} from "@/components/product/operational";
import {
  filterOperationalProjection,
  getOperationalSurfaceProjection,
} from "@/features/operational-surfaces";
import { requireUser } from "@/lib/auth/session";

type PropertiesPageProps = Readonly<{
  searchParams: Promise<{
    property?: string;
    start?: string;
    end?: string;
  }>;
}>;

export default async function PropertiesPage({
  searchParams,
}: PropertiesPageProps) {
  const { user, profile } = await requireUser();
  const params = await searchParams;
  const fullProjection = await getOperationalSurfaceProjection({
    principal: {
      userId: user.id,
      workspaceId: user.id,
      role: profile?.role ?? "guest",
    },
    workspaceLabel: profile?.full_name
      ? `${profile.full_name}'s Workspace`
      : "Luxe Haven Workspace",
  });
  const projection = filterOperationalProjection(fullProjection, {
    propertyId: params.property,
    startDate: params.start,
    endDate: params.end,
  });
  const selected = params.property
    ? projection.properties.find(
        ({ property }) => property.id === params.property,
      ) ?? null
    : null;
  const connected = projection.properties.filter(
    ({ property }) => property.connectionState === "connected",
  ).length;
  const attention = projection.properties.filter(
    ({ quality }) => quality.status !== "trusted",
  ).length;

  return (
    <WorkspacePage width="wide">
      <WorkspaceHeader
        eyebrow="Business operations"
        title="Properties"
        description="Operate the hospitality assets you own using live reservations, stay context, connection state, and trusted data quality."
      />
      <OperationalContextBar
        action="/properties"
        value={{
          workspaceId: projection.workspace.id,
          workspaceLabel: projection.workspace.label,
          propertyId: params.property,
          startDate: params.start,
          endDate: params.end,
        }}
        properties={fullProjection.selectors.properties}
      />
      <OperationalDegradedState synchronization={projection.synchronization} />
      <WorkspaceOverview className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Properties" value={projection.properties.length} />
        <SummaryCard label="Connected" value={connected} />
        <SummaryCard label="Attention needed" value={attention} />
        <SummaryCard
          label="Last synchronization"
          value={
            projection.synchronization.lastSuccessfulAt
              ? new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(
                  new Date(projection.synchronization.lastSuccessfulAt),
                )
              : "Never"
          }
        />
      </WorkspaceOverview>

      {projection.properties.length === 0 ? (
        <WorkspaceContent>
          <WorkspaceEmptyState
            title="No properties available"
            description="Import properties from your connected hospitality platform to begin operating your portfolio."
            action={
              <Link
                href="/dashboard/settings?section=connections"
                className="inline-flex min-h-11 items-center rounded-full bg-stone-950 px-5 text-sm font-semibold text-white"
              >
                Import properties
              </Link>
            }
          />
        </WorkspaceContent>
      ) : (
        <WorkspaceContent aria-labelledby="property-list-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="property-list-title"
                className="text-xl font-semibold text-stone-950"
              >
                Operational properties
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Current guests, upcoming stays, synchronization, and attention.
              </p>
            </div>
            <OperationalQualityIndicator status={projection.quality.status} />
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {projection.properties.map((summary) => (
              <OperationalPropertyCard
                key={summary.property.id}
                summary={summary}
              />
            ))}
          </div>
        </WorkspaceContent>
      )}

      {selected ? (
        <WorkspaceContent aria-labelledby="property-detail-title">
          <h2
            id="property-detail-title"
            className="text-xl font-semibold text-stone-950"
          >
            {selected.property.name} operational detail
          </h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {selected.reservations.length ? (
              selected.reservations.map((context) => (
                <article
                  key={context.bookingId}
                  className="flex flex-col gap-3 border-b border-stone-200 p-5 last:border-b-0 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-stone-950">
                      {context.guest.name.display}
                    </h3>
                    <p className="mt-1 text-xs text-stone-500">
                      {context.stay.window.arrivalDate} –{" "}
                      {context.stay.window.departureDate} ·{" "}
                      {context.stay.stage.replaceAll("-", " ")}
                    </p>
                  </div>
                  <OperationalQualityIndicator
                    status={
                      projection.qualityByBookingId[context.bookingId]?.status ??
                      "unknown"
                    }
                  />
                </article>
              ))
            ) : (
              <p className="p-6 text-sm text-stone-500">
                No reservations fall within the selected operational context.
              </p>
            )}
          </div>
        </WorkspaceContent>
      ) : null}

      <WorkspaceActivity aria-labelledby="property-activity-title">
        <h2
          id="property-activity-title"
          className="text-xl font-semibold text-stone-950"
        >
          Property activity
        </h2>
        <div className="mt-5">
          <OperationalActivityTimeline
            activities={projection.activity.filter(
              (activity) =>
                !params.property || activity.propertyId === params.property,
            )}
          />
        </div>
      </WorkspaceActivity>
    </WorkspacePage>
  );
}

function SummaryCard({
  label,
  value,
}: Readonly<{ label: string; value: string | number }>) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-2xl font-semibold tabular-nums text-stone-950">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-stone-600">{label}</p>
    </article>
  );
}
