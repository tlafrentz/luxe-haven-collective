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
  OperationalHealthSummary,
  OperationalQualityIndicator,
} from "@/components/product/operational";
import {
  filterOperationalProjection,
  getOperationalSurfaceProjection,
} from "@/features/operational-surfaces";
import { requireUser } from "@/lib/auth/session";

type HomePageProps = Readonly<{
  searchParams: Promise<{
    property?: string;
    start?: string;
    end?: string;
  }>;
}>;

export default async function HomePage({ searchParams }: HomePageProps) {
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

  return (
    <WorkspacePage width="wide">
      <WorkspaceHeader
        eyebrow="Operational home"
        title="Today in your hospitality business"
        description="Live arrivals, active stays, departures, synchronization, and issues from the same trusted operational records."
        actions={
          <Link
            href="/bookings"
            className="inline-flex min-h-11 items-center rounded-full bg-stone-950 px-5 text-sm font-semibold text-white"
          >
            View bookings
          </Link>
        }
      />
      <OperationalContextBar
        action="/dashboard"
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
      <WorkspaceOverview>
        <OperationalHealthSummary
          arrivals={projection.home.arrivalsToday}
          inStay={projection.home.guestsInStay}
          departures={projection.home.departuresToday}
          issues={projection.home.openOperationalIssues}
          synchronization={projection.synchronization}
        />
      </WorkspaceOverview>

      {projection.contexts.length === 0 &&
      projection.properties.length === 0 ? (
        <WorkspaceContent>
          <WorkspaceEmptyState
            title="No operational activity yet"
            description="Connect your hospitality platform to begin monitoring properties, reservations, guest stays, and synchronization health."
            action={
              <Link
                href="/dashboard/settings?section=connections"
                className="inline-flex min-h-11 items-center rounded-full bg-stone-950 px-5 text-sm font-semibold text-white"
              >
                Connect hospitality platform
              </Link>
            }
          />
        </WorkspaceContent>
      ) : (
        <>
          <WorkspaceContent aria-labelledby="operational-alerts-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2
                  id="operational-alerts-title"
                  className="text-xl font-semibold text-stone-950"
                >
                  Operational awareness
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Who needs attention, where, and why.
                </p>
              </div>
              <OperationalQualityIndicator status={projection.quality.status} />
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {!projection.contexts.some(
                (context) =>
                  context.stay.stage === "arriving-today" ||
                  context.operationalNeeds.length > 0,
              ) ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 lg:col-span-2">
                  <h3 className="font-semibold text-emerald-950">
                    Operations are current
                  </h3>
                  <p className="mt-1 text-sm text-emerald-800">
                    No guest stays or operational records require attention in
                    the selected context.
                  </p>
                </div>
              ) : null}
              {projection.contexts
                .filter(
                  (context) =>
                    context.stay.stage === "arriving-today" ||
                    context.operationalNeeds.length > 0,
                )
                .slice(0, 6)
                .map((context) => (
                  <article
                    key={context.bookingId}
                    className="rounded-2xl border border-stone-200 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
                          {context.stay.stage.replaceAll("-", " ")}
                        </p>
                        <h3 className="mt-2 font-semibold text-stone-950">
                          {context.guest.name.display}
                        </h3>
                        <p className="mt-1 text-sm text-stone-500">
                          {context.property.name}
                        </p>
                      </div>
                      <OperationalQualityIndicator
                        status={
                          projection.qualityByBookingId[context.bookingId]
                            ?.status ?? "unknown"
                        }
                      />
                    </div>
                    <p className="mt-4 text-xs leading-5 text-stone-500">
                      {context.operationalNeeds.length
                        ? context.operationalNeeds
                            .map((need) => need.replaceAll("-", " "))
                            .join(" · ")
                        : "Reservation context is ready for operation."}
                    </p>
                  </article>
                ))}
            </div>
          </WorkspaceContent>
          <WorkspaceActivity aria-labelledby="recent-activity-title">
            <h2
              id="recent-activity-title"
              className="text-xl font-semibold text-stone-950"
            >
              Recent operational activity
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Generated from reservation, property, and synchronization events.
            </p>
            <div className="mt-5">
              <OperationalActivityTimeline activities={projection.activity} />
            </div>
          </WorkspaceActivity>
        </>
      )}
    </WorkspacePage>
  );
}
