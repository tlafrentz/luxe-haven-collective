import Link from "next/link";
import {
  associateProviderReviewMessageAction,
  getGuestCommunicationInbox,
} from "@/app/actions/guest-communications";
import { CommunicationContextRefresh } from "@/components/communications/communication-context-refresh";

export default async function GuestCommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    page?: string;
    property?: string;
    stage?: string;
    priority?: string;
    guidebookLink?: string;
  }>;
}) {
  const params = await searchParams;
  const result = await getGuestCommunicationInbox({
    query: params.q,
    status: params.status,
    sort: params.sort,
    page: Number(params.page) || 1,
    propertyId: params.property,
    stage: params.stage,
    priority: params.priority,
  });
  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-5 py-5">
      <CommunicationContextRefresh />
      <header className="flex items-end justify-between gap-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Guest Communications
        </p>
        <h1 className="sr-only">Guest Communications</h1>
        <p className="mt-1 max-w-3xl text-xs text-stone-600">
          Conversations connect guest messages with the reservation, property,
          Guidebook, and operational follow-through.
        </p></div><Link href="/dashboard/workspace/connected-systems" className="inline-flex min-h-10 items-center rounded-full bg-stone-950 px-5 text-xs font-semibold text-white">Manage connection</Link>
      </header>
      <form className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <label className="text-[10px] font-medium text-stone-700">
          Search
          <span className="sr-only">
            {" "}
            by guest, property, reservation, or booking ID
          </span>
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Guest, property, reservation…"
            className="mt-1 block min-h-10 w-full rounded-lg border border-stone-300 px-3 text-xs"
          />
        </label>
        <label className="text-[10px] font-medium text-stone-700">
          Status
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="mt-1 block min-h-10 w-full rounded-lg border border-stone-300 px-3 text-xs"
          >
            <option value="">All conversations</option>
            <option value="unread">Unread</option>
            <option value="waiting-on-guest">Waiting on guest</option>
            <option value="waiting-on-operator">Waiting on operator</option>
            <option value="open-issues">Open issues</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-[10px] font-medium text-stone-700">
          Sort
          <select
            name="sort"
            defaultValue={params.sort ?? "requires-reply"}
            className="mt-1 block min-h-10 w-full rounded-lg border border-stone-300 px-3 text-xs"
          >
            <option value="requires-reply">Requires reply</option>
            <option value="arrival-today">Arrival today</option>
            <option value="in-stay">In stay</option>
            <option value="departure-today">Departure today</option>
            <option value="recent">Recently active</option>
          </select>
        </label>
        <label className="text-[10px] font-medium text-stone-700">
          Property
          <select
            name="property"
            defaultValue={params.property ?? ""}
            className="mt-1 block min-h-10 w-full rounded-lg border border-stone-300 px-3 text-xs"
          >
            <option value="">All properties</option>
            {result.ok
              ? result.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))
              : null}
          </select>
        </label>
        <label className="text-[10px] font-medium text-stone-700">
          Reservation stage
          <select
            name="stage"
            defaultValue={params.stage ?? ""}
            className="mt-1 block min-h-10 w-full rounded-lg border border-stone-300 px-3 text-xs"
          >
            <option value="">All stages</option>
            <option value="arrival-today">Arrival today</option>
            <option value="in-stay">In stay</option>
            <option value="departure-today">Departure today</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </label>
        <label className="text-[10px] font-medium text-stone-700">
          Priority
          <select
            name="priority"
            defaultValue={params.priority ?? ""}
            className="mt-1 block min-h-10 w-full rounded-lg border border-stone-300 px-3 text-xs"
          >
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
        <button className="sr-only">
          Filter
        </button>
      </form>
      {result.ok && result.reviewQueue.length ? (
        <section
          aria-label="Provider review queue"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <h2 className="font-semibold">Messages requiring review</h2>
          <p className="mt-1 text-sm text-amber-950">
            These provider events could not be associated deterministically.{" "}
            {result.canReviewProviderMessages
              ? "Choose the correct canonical conversation; no duplicate conversation has been created."
              : "A communications manager must associate them. Existing conversations remain available."}
          </p>
          <ul className="mt-4 space-y-3">
            {result.reviewQueue.map((item) => (
              <li key={item.id} className="rounded-xl bg-white p-4">
                <p className="text-sm font-semibold capitalize">
                  {String(item.reason).replaceAll("-", " ")}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {item.provider} ·{" "}
                  {item.reservation_reference ?? "reservation unknown"} ·{" "}
                  {new Date(item.occurred_at).toLocaleString()}
                </p>
                {result.canReviewProviderMessages ? (
                  <form
                    action={associateProviderReviewMessageAction}
                    className="mt-3 flex flex-wrap gap-2"
                  >
                    <input type="hidden" name="reviewId" value={item.id} />
                    <select
                      required
                      name="conversationId"
                      aria-label="Conversation to associate"
                      className="min-w-64 rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="">Select conversation…</option>
                      {result.conversations.map((conversation) => (
                        <option key={conversation.id} value={conversation.id}>
                          {conversation.guestName} · {conversation.propertyName}{" "}
                          · {conversation.reservation_id}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white">
                      Associate message
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!result.ok ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"
        >
          <h2 className="font-semibold">Guest Communications is unavailable</h2>
          <p className="mt-1">
            Your role may not include this workspace. Reservations and existing
            messages remain unchanged.
          </p>
          <Link
            href="/dashboard"
            className="mt-2 inline-block font-semibold underline"
          >
            Return to dashboard
          </Link>
        </div>
      ) : !result.provider?.connected && result.conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <h2 className="text-lg font-semibold">No provider connected</h2>
          <p className="mt-2 text-sm text-stone-600">
            Guest Communications requires a connected reservation or messaging
            provider.
          </p>
          <Link
            href="/dashboard/settings/integrations"
            className="mt-4 inline-block rounded-full border px-4 py-2 font-semibold"
          >
            Connect provider
          </Link>
        </div>
      ) : result.conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold">No conversations</h2>
          <p className="mt-2 text-sm text-stone-600">
            Conversations will appear automatically when reservations
            synchronize.
          </p>
          <Link
            href="/dashboard/bookings"
            className="mt-4 inline-block rounded-full border px-4 py-2 font-semibold"
          >
            Import reservations
          </Link>
        </div>
      ) : (
        <section
          aria-label="Guest queue"
          className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
        >
          <div className="border-b bg-stone-50 px-5 py-3">
            <h2 className="font-semibold">Guest queue</h2>
            {params.guidebookLink ? (
              <p className="mt-1 text-sm text-stone-600">
                Choose an authorized conversation. The guidebook link will be
                inserted into its draft and will not be sent.
              </p>
            ) : null}
          </div>
          {result.conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/dashboard/communications/${conversation.id}${params.guidebookLink ? `?guidebookLink=${encodeURIComponent(params.guidebookLink)}` : ""}`}
              className="grid gap-3 border-b border-stone-100 p-5 outline-none last:border-0 hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-600 lg:grid-cols-[1.1fr_1fr_1.5fr_auto]"
            >
              <span>
                <span className="block font-semibold text-stone-950">
                  {conversation.guestName}
                </span>
                <span className="text-sm text-stone-500">
                  {conversation.propertyName} · {conversation.reservation_id}
                </span>
              </span>
              <span className="text-sm text-stone-600">
                <span className="block capitalize">
                  {conversation.stayStatus.replaceAll("-", " ")}
                </span>
                <span>
                  Waiting on {conversation.waitingOn} ·{" "}
                  <strong className="capitalize">
                    {conversation.priority}
                  </strong>
                </span>
              </span>
              <span className="min-w-0 text-sm text-stone-600">
                <span className="block truncate">
                  {conversation.lastMessage}
                </span>
                <span className="text-xs">
                  {conversation.bookingSource} · {conversation.channel}
                </span>
              </span>
              <span className="text-right text-sm text-stone-500">
                {conversation.unread_count ? (
                  <strong className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">
                    {conversation.unread_count} unread
                  </strong>
                ) : null}
                <span className="mt-2 block">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(conversation.last_activity_at))}
                </span>
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
