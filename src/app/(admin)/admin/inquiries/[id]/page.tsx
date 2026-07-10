import Link from "next/link";

import {
  updateInquiryNotesAction,
  updateInquiryStatusAction,
} from "@/app/actions/inquiries";
import {
  getContactInquiry,
  type ContactInquiryRecord,
  type InquiryStatus,
} from "@/lib/contact-inquiries";

type Props = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    updated?: string;
  }>;
};

const statusOptions: Array<{
  value: InquiryStatus;
  label: string;
}> = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "responded", label: "Responded" },
  { value: "closed", label: "Closed" },
];

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getMetadataValue(
  inquiry: ContactInquiryRecord,
  key: string,
) {
  const value = inquiry.metadata?.[key];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return String(value);
}

function StatusBadge({
  status,
}: {
  status: InquiryStatus;
}) {
  const styles: Record<InquiryStatus, string> = {
    new: "border-sky-300/20 bg-sky-500/10 text-sky-200",
    reviewed:
      "border-amber-300/20 bg-amber-500/10 text-amber-200",
    responded:
      "border-emerald-300/20 bg-emerald-500/10 text-emerald-200",
    closed: "border-white/10 bg-white/5 text-white/50",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default async function AdminInquiryDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const query = await searchParams;

  const inquiry = await getContactInquiry(id);

  const preferredDate = getMetadataValue(
    inquiry,
    "preferred_date",
  );

  const appointmentLocation = getMetadataValue(
    inquiry,
    "appointment_location",
  );

  const documentType = getMetadataValue(
    inquiry,
    "document_type",
  );

  const signerCount = getMetadataValue(
    inquiry,
    "signer_count",
  );

  const statusAction =
    updateInquiryStatusAction.bind(null, inquiry.id);

  const notesAction =
    updateInquiryNotesAction.bind(null, inquiry.id);

  return (
    <div className="space-y-8">
      <Link
        href="/admin/inquiries"
        className="inline-flex text-sm font-semibold text-white/50 transition hover:text-white"
      >
        ← Back to inquiries
      </Link>

      {query.updated ? (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
          {query.updated === "notes"
            ? "Internal notes saved."
            : "Inquiry status updated."}
        </div>
      ) : null}

      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-4xl md:text-5xl">
              {inquiry.name}
            </h1>

            <StatusBadge status={inquiry.status} />
          </div>

          <p className="mt-3 text-lg font-semibold text-white/75">
            {inquiry.inquiry_type}
          </p>

          <p className="mt-2 text-sm text-white/40">
            Received {formatDate(inquiry.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={`mailto:${inquiry.email}`}
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-950"
          >
            Email Client
          </a>

          {inquiry.phone ? (
            <a
              href={`tel:${inquiry.phone}`}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Call Client
            </a>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-6">
          <section className="grid gap-5 md:grid-cols-2">
            <article className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
                Contact details
              </p>

              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="text-white/35">Email</dt>
                  <dd className="mt-1 break-all text-white/75">
                    {inquiry.email}
                  </dd>
                </div>

                {inquiry.phone ? (
                  <div>
                    <dt className="text-white/35">Phone</dt>
                    <dd className="mt-1 text-white/75">
                      {inquiry.phone}
                    </dd>
                  </div>
                ) : null}

                {inquiry.property_market ? (
                  <div>
                    <dt className="text-white/35">
                      Property market
                    </dt>
                    <dd className="mt-1 text-white/75">
                      {inquiry.property_market}
                    </dd>
                  </div>
                ) : null}

                <div>
                  <dt className="text-white/35">Source</dt>
                  <dd className="mt-1 capitalize text-white/75">
                    {inquiry.source.replaceAll("_", " ")}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
                Lead timeline
              </p>

              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="text-white/35">Received</dt>
                  <dd className="mt-1 text-white/75">
                    {formatDate(inquiry.created_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-white/35">
                    Last updated
                  </dt>
                  <dd className="mt-1 text-white/75">
                    {formatDate(inquiry.updated_at)}
                  </dd>
                </div>

                {inquiry.responded_at ? (
                  <div>
                    <dt className="text-white/35">
                      Responded
                    </dt>
                    <dd className="mt-1 text-white/75">
                      {formatDate(inquiry.responded_at)}
                    </dd>
                  </div>
                ) : null}

                {inquiry.closed_at ? (
                  <div>
                    <dt className="text-white/35">Closed</dt>
                    <dd className="mt-1 text-white/75">
                      {formatDate(inquiry.closed_at)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </article>
          </section>

          {(preferredDate ||
            appointmentLocation ||
            documentType ||
            signerCount) ? (
            <section className="rounded-[2rem] border border-amber-300/15 bg-amber-500/[0.06] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/70">
                Notary appointment details
              </p>

              <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
                {preferredDate ? (
                  <div>
                    <dt className="text-white/35">
                      Preferred date
                    </dt>
                    <dd className="mt-1 text-white/75">
                      {preferredDate}
                    </dd>
                  </div>
                ) : null}

                {appointmentLocation ? (
                  <div>
                    <dt className="text-white/35">Location</dt>
                    <dd className="mt-1 text-white/75">
                      {appointmentLocation}
                    </dd>
                  </div>
                ) : null}

                {documentType ? (
                  <div>
                    <dt className="text-white/35">
                      Document type
                    </dt>
                    <dd className="mt-1 text-white/75">
                      {documentType}
                    </dd>
                  </div>
                ) : null}

                {signerCount ? (
                  <div>
                    <dt className="text-white/35">Signers</dt>
                    <dd className="mt-1 text-white/75">
                      {signerCount}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
              Client message
            </p>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/70">
              {inquiry.message}
            </p>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
              Internal notes
            </p>

            <p className="mt-3 text-sm leading-6 text-white/45">
              These notes are visible only inside the Luxe Haven
              admin portal.
            </p>

            <form action={notesAction} className="mt-5">
              <textarea
                name="internalNotes"
                defaultValue={inquiry.internal_notes ?? ""}
                className="min-h-48 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/25 focus:border-white/30"
                placeholder="Add follow-up details, quote information, scheduling notes, or other internal context."
              />

              <button className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-950">
                Save Notes
              </button>
            </form>
          </section>
        </main>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 xl:sticky xl:top-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
              Inquiry status
            </p>

            <form action={statusAction} className="mt-5">
              <label className="grid gap-2 text-sm font-semibold">
                Current stage

                <select
                  name="status"
                  defaultValue={inquiry.status}
                  className="rounded-2xl border border-white/10 bg-stone-900 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  {statusOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button className="mt-4 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-950">
                Update Status
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                Quick actions
              </p>

              <div className="mt-4 grid gap-3">
                <a
                  href={`mailto:${inquiry.email}`}
                  className="rounded-full border border-white/15 px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/10"
                >
                  Send Email
                </a>

                {inquiry.phone ? (
                  <a
                    href={`tel:${inquiry.phone}`}
                    className="rounded-full border border-white/15 px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/10"
                  >
                    Call {inquiry.phone}
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
