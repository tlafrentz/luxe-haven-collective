import Link from "next/link";

import {
  getContactInquiries,
  type ContactInquiryRecord,
} from "@/lib/contact-inquiries";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getMetadataValue(
  inquiry: ContactInquiryRecord,
  key: string,
): string | null {
  const value = inquiry.metadata?.[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function StatusBadge({
  status,
}: {
  status: ContactInquiryRecord["status"];
}) {
  const styles = {
    new: "border-sky-300/20 bg-sky-500/10 text-sky-200",
    reviewed: "border-amber-300/20 bg-amber-500/10 text-amber-200",
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

export default async function AdminInquiriesPage() {
  const inquiries = await getContactInquiries();

  const newCount = inquiries.filter(
    (inquiry) => inquiry.status === "new",
  ).length;

  const notaryCount = inquiries.filter(
    (inquiry) => inquiry.inquiry_type === "Texas notary service",
  ).length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/45">
            Lead management
          </p>

          <h1 className="mt-3 font-serif text-4xl md:text-5xl">
            Inquiries
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55">
            Review hospitality, owner, guest, and Texas notary inquiries
            submitted through the public website.
          </p>
        </div>

        <Link
          href="/contact"
          className="inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          View Public Form
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-white/45">Total inquiries</p>
          <p className="mt-2 font-serif text-4xl">
            {inquiries.length}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-white/45">New</p>
          <p className="mt-2 font-serif text-4xl">{newCount}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-white/45">
            Notary requests
          </p>
          <p className="mt-2 font-serif text-4xl">
            {notaryCount}
          </p>
        </div>
      </section>

      {inquiries.length ? (
        <section className="grid gap-5">
          {inquiries.map((inquiry) => {
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

            return (
              <article
                key={inquiry.id}
                className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-serif text-2xl">
                        {inquiry.name}
                      </h2>

                      <StatusBadge status={inquiry.status} />
                    </div>

                    <p className="mt-2 text-sm font-semibold text-white/75">
                      {inquiry.inquiry_type}
                    </p>

                    <p className="mt-1 text-xs text-white/35">
                      Received {formatDate(inquiry.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/inquiries/${inquiry.id}`}
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Open Inquiry
                    </Link>

                    <a
                      href={`mailto:${inquiry.email}`}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-950"
                    >
                      Email
                    </a>

                    {inquiry.phone ? (
                      <a
                        href={`tel:${inquiry.phone}`}
                        className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        Call
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                      Contact details
                    </p>

                    <dl className="mt-4 grid gap-3 text-sm">
                      <div>
                        <dt className="text-white/35">Email</dt>
                        <dd className="mt-1 break-all text-white/75">
                          {inquiry.email}
                        </dd>
                      </div>

                      {inquiry.phone ? (
                        <div>
                          <dt className="text-white/35">
                            Phone
                          </dt>
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
                        <dt className="text-white/35">
                          Source
                        </dt>
                        <dd className="mt-1 capitalize text-white/75">
                          {inquiry.source.replaceAll("_", " ")}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                      Message
                    </p>

                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/70">
                      {inquiry.message}
                    </p>
                  </div>
                </div>

                {preferredDate ||
                appointmentLocation ||
                documentType ||
                signerCount ? (
                  <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-500/[0.06] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/70">
                      Notary appointment details
                    </p>

                    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
                          <dt className="text-white/35">
                            Location
                          </dt>
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
                          <dt className="text-white/35">
                            Signers
                          </dt>
                          <dd className="mt-1 text-white/75">
                            {signerCount}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-white/15 p-12 text-center">
          <h2 className="font-serif text-3xl">
            No inquiries yet
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/45">
            New website inquiries will appear here after visitors
            submit the contact or notary request form.
          </p>
        </div>
      )}
    </div>
  );
}
