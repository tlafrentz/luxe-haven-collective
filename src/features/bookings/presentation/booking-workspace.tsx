"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarCheck,
  CalendarClock,
  Clock3,
  Hotel,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import {
  WorkspaceContent,
  WorkspaceEmptyState,
  WorkspaceHeader,
  WorkspaceOverview,
  WorkspacePage,
  WorkspaceSupporting,
} from "@/components/application-layout";
import type {
  Booking,
  BookingFilters,
  BookingLifecycleStatus,
  BookingReadModel,
} from "@/features/bookings";
import type { ReservationContext } from "@/features/reservation-context";
import type {
  OperationalDataQuality,
  WorkspaceOperationalDataHealth,
} from "@/platform/operational-data-quality";
import type { OperationalContextValue } from "@/components/product/operational";

const statusLabels: Record<BookingLifecycleStatus, string> = {
  upcoming: "Upcoming",
  "arriving-today": "Arriving Today",
  "checked-in": "Checked In",
  "in-stay": "In Stay",
  "checking-out-today": "Checking Out Today",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Never synchronized";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClasses(status: BookingLifecycleStatus): string {
  if (status === "cancelled") return "bg-rose-50 text-rose-800";
  if (status === "arriving-today" || status === "checking-out-today")
    return "bg-amber-50 text-amber-900";
  if (status === "checked-in" || status === "in-stay")
    return "bg-teal-50 text-teal-800";
  if (status === "completed") return "bg-stone-100 text-stone-600";
  return "bg-blue-50 text-blue-800";
}

export function BookingWorkspace({
  model,
  filters,
  selectedBooking,
  selectedContext,
  qualityByBookingId = {},
  qualitySummary,
  contextValue,
}: Readonly<{
  model: BookingReadModel;
  filters: BookingFilters;
  selectedBooking: Booking | null;
  selectedContext?: ReservationContext | null;
  qualityByBookingId?: Readonly<Record<string, OperationalDataQuality>>;
  qualitySummary?: WorkspaceOperationalDataHealth;
  contextValue?: OperationalContextValue;
}>) {
  const detailRef = useRef<HTMLElement>(null);
  const degraded = !["current", "never-synchronized"].includes(
    model.health.synchronizationStatus,
  );
  useEffect(() => {
    if (selectedBooking) detailRef.current?.focus();
  }, [selectedBooking]);

  return (
    <WorkspacePage width="wide" className="py-5 lg:py-5">
      <WorkspaceHeader
        eyebrow="Bookings"
        title="Bookings"
        description="See the reservations you are responsible for operating across your hospitality business."
        actions={
          <Link
            href="/dashboard/workspace/connected-systems"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-800 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Manage connection
          </Link>
        }
      />

      {degraded ? (
        <section
          aria-labelledby="sync-attention-title"
          className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center"
        >
          {contextValue?.propertyId ? (
            <input type="hidden" name="property" value={contextValue.propertyId} />
          ) : null}
          {contextValue?.startDate ? (
            <input type="hidden" name="start" value={contextValue.startDate} />
          ) : null}
          {contextValue?.endDate ? (
            <input type="hidden" name="end" value={contextValue.endDate} />
          ) : null}
          <AlertTriangle
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-amber-800"
          />
          <div className="flex-1">
            <h2 id="sync-attention-title" className="font-semibold text-amber-950">
              Bookings may be incomplete
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Last successful synchronization:{" "}
              {formatTimestamp(model.health.lastSuccessfulSync)}. Review the
              connection to restore current reservation data.
            </p>
          </div>
          <Link
            href="/dashboard/workspace/connected-systems"
            className="text-sm font-semibold text-amber-950 underline underline-offset-4"
          >
            Review connection
          </Link>
        </section>
      ) : null}

      <WorkspaceOverview className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <HealthCard
          icon={CalendarClock}
          label="Upcoming"
          value={model.health.upcoming}
        />
        <HealthCard
          icon={AlertTriangle}
          label="Data health"
          value={qualitySummary ? qualityLabel(qualitySummary.status) : "Awaiting analysis"}
          detail={
            qualitySummary
              ? `${qualitySummary.counts.trusted} trusted · ${qualitySummary.openIssues.warning + qualitySummary.openIssues.critical} issues`
              : "Data quality analysis has not completed"
          }
        />
        <HealthCard
          icon={ArrowDownToLine}
          label="Arriving today"
          value={model.health.arrivingToday}
        />
        <HealthCard icon={Hotel} label="In stay" value={model.health.inStay} />
        <HealthCard
          icon={CalendarCheck}
          label="Checking out"
          value={model.health.checkingOutToday}
        />
        <HealthCard
          icon={RefreshCw}
          label="Sync status"
          value={syncLabel(model.health.synchronizationStatus)}
          detail={formatTimestamp(model.health.lastSuccessfulSync)}
        />
      </WorkspaceOverview>

      <WorkspaceContent>
        <form
          method="get"
          aria-label="Booking filters"
          className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 lg:grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]"
        >
          {contextValue?.startDate ? <input type="hidden" name="from" value={contextValue.startDate} /> : null}
          {contextValue?.endDate ? <input type="hidden" name="to" value={contextValue.endDate} /> : null}
          <label className="relative">
            <span className="sr-only">Search guests or reservations</span>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-3.5 h-4 w-4 text-stone-400"
            />
            <input
              name="query"
              defaultValue={filters.query}
              placeholder="Guest or confirmation"
              className="min-h-11 w-full rounded-xl border border-stone-300 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-teal-600"
            />
          </label>
          <FilterSelect
            name="status"
            label="All statuses"
            value={filters.status}
            options={Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <FilterSelect
            name="source"
            label="All sources"
            value={filters.source}
            options={model.sources.map((source) => ({
              value: source,
              label: source,
            }))}
          />
          <button className="min-h-11 rounded-full bg-stone-950 px-5 text-sm font-semibold text-white hover:bg-stone-800">
            Apply
          </button>
        </form>

        {model.bookings.length === 0 ? (
          <WorkspaceEmptyState
            title={
              model.health.synchronizationStatus === "never-synchronized"
                ? "Guest reservations will appear here"
                : "No reservations match these filters"
            }
            description={
              model.health.synchronizationStatus === "never-synchronized"
                ? "Connect your hospitality platform to synchronize the reservations you are responsible for operating."
                : "Your booking connection is active. Adjust or clear the current filters to view other reservations."
            }
            action={
              <Link
                href={
                  model.health.synchronizationStatus === "never-synchronized"
                    ? "/dashboard/workspace/connected-systems"
                    : "/bookings"
                }
                className="inline-flex min-h-11 items-center rounded-full bg-stone-950 px-5 text-sm font-semibold text-white"
              >
                {model.health.synchronizationStatus === "never-synchronized"
                  ? "Manage connections"
                  : "Clear filters"}
              </Link>
            }
          />
        ) : (
          <div className="grid overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm xl:grid-cols-[minmax(0,1fr)_360px]">
            <BookingTable
              bookings={model.bookings}
              selectedId={selectedBooking?.id}
              qualityByBookingId={qualityByBookingId}
            />
            <BookingDetail
              detailRef={detailRef}
              booking={selectedBooking}
              context={selectedContext ?? null}
              quality={
                selectedBooking
                  ? qualityByBookingId[selectedBooking.id] ?? null
                  : null
              }
            />
          </div>
        )}
      </WorkspaceContent>

      <WorkspaceSupporting>
        <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-5">
          <Clock3 aria-hidden="true" className="h-5 w-5 text-stone-500" />
          <div>
            <h2 className="text-sm font-semibold text-stone-950">Recent sync</h2>
            <p className="mt-1 text-xs text-stone-500">
              {formatTimestamp(model.health.lastSuccessfulSync)} · Reservation
              provenance is retained in the operational read model.
            </p>
          </div>
        </div>
      </WorkspaceSupporting>
    </WorkspacePage>
  );
}

function HealthCard({
  icon: Icon,
  label,
  value,
  detail,
}: Readonly<{
  icon: typeof CalendarClock;
  label: string;
  value: string | number;
  detail?: string;
}>) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <Icon aria-hidden="true" className="h-4 w-4 text-stone-500" />
      <p className="mt-4 text-2xl font-semibold tabular-nums text-stone-950">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-stone-600">{label}</p>
      {detail ? (
        <p className="mt-2 truncate text-[11px] text-stone-400">{detail}</p>
      ) : null}
    </article>
  );
}

function BookingTable({
  bookings,
  selectedId,
  qualityByBookingId,
}: Readonly<{
  bookings: readonly Booking[];
  selectedId?: string;
  qualityByBookingId: Readonly<Record<string, OperationalDataQuality>>;
}>) {
  const selectBooking = (bookingId: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("booking", bookingId);
    window.location.assign(`/bookings?${params.toString()}`);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] text-left text-sm">
        <caption className="sr-only">Owner-scoped reservations</caption>
        <thead className="bg-stone-50 text-xs text-stone-500">
          <tr>
            {[
              "Arrival",
              "Departure",
              "Guest",
              "Property",
              "Status",
              "Source",
              "Nights",
              "Last sync",
              "Quality",
            ].map((heading) => (
              <th key={heading} scope="col" className="px-4 py-3 font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr
              key={booking.id}
              className={
                booking.id === selectedId
                  ? "border-t border-stone-200 bg-teal-50/60"
                  : "border-t border-stone-200 hover:bg-stone-50"
              }
              aria-selected={booking.id === selectedId}
              tabIndex={0}
              onClick={() => selectBooking(booking.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectBooking(booking.id);
                }
              }}
            >
              <td className="px-4 py-4">
                <Link
                  href={`/bookings?booking=${encodeURIComponent(booking.id)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectBooking(booking.id);
                  }}
                  className="font-semibold text-stone-950 hover:underline"
                >
                  {formatDate(booking.stay.arrival)}
                </Link>
              </td>
              <td className="px-4 py-4 text-stone-600">
                {formatDate(booking.stay.departure)}
              </td>
              <td className="px-4 py-4 text-stone-800">{booking.guest.name}</td>
              <td className="px-4 py-4 text-stone-600">
                {booking.property.name}
              </td>
              <td className="px-4 py-4">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(booking.status)}`}
                >
                  {statusLabels[booking.status]}
                </span>
              </td>
              <td className="px-4 py-4 text-stone-600">
                {booking.provider.source}
              </td>
              <td className="px-4 py-4 tabular-nums text-stone-600">
                {booking.stay.nights}
              </td>
              <td className="px-4 py-4 text-xs text-stone-500">
                {formatTimestamp(booking.provider.lastSynchronizedAt)}
              </td>
              <td className="px-4 py-4">
                <QualityIndicator quality={qualityByBookingId[booking.id]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookingDetail({
  booking,
  context,
  quality,
  detailRef,
}: Readonly<{
  booking: Booking | null;
  context: ReservationContext | null;
  quality: OperationalDataQuality | null;
  detailRef: React.RefObject<HTMLElement | null>;
}>) {
  if (!booking) return null;

  return (
    <aside
      ref={detailRef}
      tabIndex={-1}
      aria-labelledby="booking-detail-title"
      className="border-t border-stone-200 bg-stone-50 p-6 xl:border-l xl:border-t-0"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
        Reservation detail
      </p>
      <h2 id="booking-detail-title" className="mt-2 text-xl font-semibold">
        {booking.guest.name}
      </h2>
      <p className="mt-1 text-sm text-stone-500">{booking.property.name}</p>
      {context?.operationalNeeds.length ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
          <p className="font-semibold">Guest context needs attention</p>
          <p className="mt-1">
            {context.operationalNeeds
              .map((need) => operationalNeedLabel(need))
              .join(" · ")}
          </p>
        </div>
      ) : null}
      <dl className="mt-6 space-y-4 text-sm">
        <Detail label="Status" value={statusLabels[booking.status]} />
        {context ? (
          <Detail label="Stay stage" value={stayStageLabel(context.stay.stage)} />
        ) : null}
        <Detail
          label="Stay"
          value={`${formatDate(booking.stay.arrival)} – ${formatDate(booking.stay.departure)}`}
        />
        <Detail
          label="Guests"
          value={
            context
              ? partyLabel(context.party, booking.stay.nights)
              : `${booking.guest.partySize} · ${booking.stay.nights} nights`
          }
        />
        {context ? (
          <>
            <Detail
              label="Property timing"
              value={`${context.property.checkInTime} check-in · ${context.property.checkoutTime} checkout · ${context.property.timezone}`}
            />
            <Detail
              label="Contact options"
              value={contactLabel(context)}
            />
            <Detail
              label="Context freshness"
              value={`${capitalize(context.freshness.status)} · ${context.stay.window.timingConfidence} timing confidence`}
            />
          </>
        ) : null}
        <Detail
          label="Confirmation"
          value={booking.confirmationCode ?? "Not provided"}
        />
        <Detail label="Booking source" value={booking.provider.source} />
        <Detail label="Provider" value={booking.provider.provider} />
        <Detail
          label="Last synchronized"
          value={formatTimestamp(booking.provider.lastSynchronizedAt)}
        />
      </dl>
      <div className="mt-6 flex items-start gap-2 rounded-xl border border-stone-200 bg-white p-4">
        <UserRound
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 text-stone-500"
        />
        <div className="text-xs leading-5 text-stone-600">
          {context?.guest.contactPoints.length ? (
            context.guest.contactPoints.map((contact) => (
              <p key={contact.type}>
                {contact.type === "email" ? "Email" : "Phone"} available
              </p>
            ))
          ) : (
            <p>No direct guest contact provided</p>
          )}
        </div>
      </div>
      {quality ? (
        <section
          aria-labelledby="booking-quality-title"
          className="mt-6 border-t border-stone-200 pt-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            Source and data quality
          </p>
          <h3 id="booking-quality-title" className="mt-2 font-semibold text-stone-950">
            {qualityLabel(quality.status)}
          </h3>
          <div className="mt-4 space-y-3">
            {Object.entries(quality.dimensions).map(([name, result]) => (
              <div key={name} className="rounded-xl border border-stone-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold capitalize text-stone-700">
                    {name}
                  </p>
                  <span className="text-[11px] font-semibold text-stone-500">
                    {qualityLabel(result.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {result.impact}
                </p>
              </div>
            ))}
          </div>
          {quality.issues.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-950">
                Recommended attention
              </p>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-amber-900">
                {quality.issues.slice(0, 3).map((issue) => (
                  <li key={issue.code}>
                    {issue.impact} {issue.suggestedResolution}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-3 text-[11px] text-stone-400">
            Evaluated {formatTimestamp(quality.evaluatedAt)} · Policy{" "}
            {quality.policyVersion}
          </p>
        </section>
      ) : null}
    </aside>
  );
}

function QualityIndicator({
  quality,
}: Readonly<{ quality?: OperationalDataQuality }>) {
  if (!quality)
    return (
      <span className="text-xs text-stone-400" aria-label="Data quality unknown">
        Unknown
      </span>
    );
  const critical = ["degraded", "unusable"].includes(quality.status);
  return (
    <span
      aria-label={`Data quality: ${qualityLabel(quality.status)}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        critical
          ? "bg-rose-50 text-rose-800"
          : quality.status === "trusted"
            ? "bg-emerald-50 text-emerald-800"
            : "bg-amber-50 text-amber-900"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          critical
            ? "bg-rose-600"
            : quality.status === "trusted"
              ? "bg-emerald-600"
              : "bg-amber-600"
        }`}
      />
      {qualityLabel(quality.status)}
    </span>
  );
}

function qualityLabel(
  status: OperationalDataQuality["status"],
): string {
  return {
    trusted: "Trusted",
    "usable-with-gaps": "Usable with Gaps",
    "attention-needed": "Attention Needed",
    degraded: "Degraded",
    unusable: "Unusable",
    unknown: "Unknown",
  }[status];
}

function stayStageLabel(stage: ReservationContext["stay"]["stage"]): string {
  return stage
    .split("-")
    .map(capitalize)
    .join(" ");
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function operationalNeedLabel(
  need: ReservationContext["operationalNeeds"][number],
): string {
  return {
    "guest-details-incomplete": "Guest details incomplete",
    "contact-unavailable": "No usable contact method",
    "identity-review": "Guest identity needs review",
    "timing-confidence-reduced": "Property timezone fallback in use",
    "context-stale": "Guest context may be stale",
  }[need];
}

function partyLabel(
  party: ReservationContext["party"],
  nights: number,
): string {
  const parts = [
    party.adults === null ? null : `${party.adults} adults`,
    party.children === null ? null : `${party.children} children`,
    party.infants === null ? null : `${party.infants} infants`,
    party.pets === null ? null : `${party.pets} pets`,
  ].filter(Boolean);
  return `${parts.length ? parts.join(" · ") : `${party.totalGuests ?? "Unknown"} guests`} · ${nights} nights${party.inconsistent ? " · Party count needs review" : ""}`;
}

function contactLabel(context: ReservationContext): string {
  const channels = [
    context.contactAvailability.platformMessaging ? "Platform messaging" : null,
    context.contactAvailability.email ? "Email" : null,
    context.contactAvailability.sms ? "SMS" : null,
    context.contactAvailability.phone ? "Phone" : null,
  ].filter(Boolean);
  return channels.length ? channels.join(" · ") : "No direct contact available";
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs font-semibold text-stone-500">{label}</dt>
      <dd className="mt-1 font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: Readonly<{
  name: string;
  label: string;
  value?: string;
  options: readonly Readonly<{ value: string; label: string }>[];
}>) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function syncLabel(status: BookingReadModel["health"]["synchronizationStatus"]) {
  return {
    current: "Current",
    failed: "Failed",
    "never-synchronized": "Not connected",
    "sync-in-progress": "Syncing",
    stale: "Attention",
  }[status];
}
