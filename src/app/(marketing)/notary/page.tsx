import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Texas Mobile Notary Services | Luxe Haven Collective",
  description:
    "Professional mobile and remote online notary services for individuals, families, real estate professionals, and businesses in Texas.",
};

const services = [
  {
    title: "Mobile Notary",
    description:
      "Convenient appointments at your home, office, hospital, senior community, or another agreed location.",
  },
  {
    title: "Remote Online Notarization",
    description:
      "Complete eligible notarizations through a secure audio-video session without traveling to an appointment.",
  },
  {
    title: "Real Estate Documents",
    description:
      "Professional notarization support for real estate, property, title, and related documents.",
  },
  {
    title: "Business & Personal Documents",
    description:
      "Acknowledgments, affidavits, sworn statements, powers of attorney, and other eligible documents.",
  },
];

const pricing = [
  {
    title: "Standard Notarial Act",
    price: "Up to $10",
    detail:
      "Texas-authorized fee for the first signature on an acknowledgment, oath, affirmation, or other eligible notarial act.",
  },
  {
    title: "Additional Signature",
    price: "Up to $1",
    detail:
      "For each additional signature notarized within the same acknowledgment.",
  },
  {
    title: "Standard Mobile Travel",
    price: "$40–$75",
    detail:
      "Travel and convenience fee for appointments during regular business hours. Final pricing depends on distance and appointment requirements.",
  },
  {
    title: "Urgent Appointment",
    price: "+$50",
    detail:
      "May apply when an appointment is requested with less than two hours’ notice.",
  },
  {
    title: "After-Hours or Holiday",
    price: "+$75–$100",
    detail:
      "May apply to late-night, early-morning, weekend, or holiday appointments.",
  },
  {
    title: "Remote Online Session",
    price: "Up to $25",
    detail:
      "Online notarization technology and session fee, in addition to any applicable statutory notarial fee.",
  },
];

const preparationSteps = [
  "Bring a current government-issued photo ID.",
  "Do not sign the document until instructed, when an in-person signature is required.",
  "Confirm that every signer who must appear will be present.",
  "Bring any witnesses required by the document.",
  "Contact the document recipient or an attorney with legal questions before the appointment.",
];

export default function NotaryPage() {
  return (
    <main>
      <PageHero
        eyebrow="Texas Notary Services"
        title="Professional notarization, brought to you."
        description="Reliable mobile and remote online notary appointments for personal, business, and real estate documents—with clear pricing and responsive service."
      />

      <section className="py-20">
        <div className="container-shell grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
              Convenient and dependable
            </p>

            <h2 className="mt-4 max-w-3xl font-serif text-4xl leading-tight md:text-5xl">
              Notary service designed around your schedule.
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Luxe Haven Collective provides professional mobile notary
              appointments throughout the Dallas–Fort Worth area, along with
              remote online appointments for eligible documents and signers.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {services.map((service) => (
                <article
                  key={service.title}
                  className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"
                >
                  <h3 className="font-serif text-2xl">{service.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {service.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-border bg-[#171412] p-7 text-primary-foreground shadow-xl lg:sticky lg:top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Request an appointment
            </p>

            <h2 className="mt-4 font-serif text-4xl">
              Tell us what you need notarized.
            </h2>

            <p className="mt-4 text-sm leading-7 text-primary-foreground/70">
              Share your preferred date, location, number of signers, and
              document type. We’ll confirm availability and provide an
              itemized quote before the appointment.
            </p>

            <Link
              href="/contact?service=notary"
              className="mt-7 block rounded-full bg-primary-foreground px-6 py-3 text-center text-sm font-semibold text-[#171412] transition hover:opacity-90"
            >
              Request Notary Service
            </Link>

            <p className="mt-4 text-center text-xs leading-5 text-primary-foreground/50">
              Please do not send Social Security numbers, identification
              numbers, account numbers, or complete legal documents through
              the website form.
            </p>
          </aside>
        </div>
      </section>

      <section className="border-y border-border bg-muted/30 py-20">
        <div className="container-shell">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
              Transparent pricing
            </p>

            <h2 className="mt-4 font-serif text-4xl md:text-5xl">
              Know what to expect before the appointment.
            </h2>

            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Notarial fees, travel fees, and optional convenience surcharges
              are itemized separately. Your total is confirmed before service.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pricing.map((item) => (
              <article
                key={item.title}
                className="rounded-[2rem] border border-border bg-background p-6"
              >
                <p className="text-sm font-semibold text-muted-foreground">
                  {item.title}
                </p>
                <p className="mt-3 font-serif text-4xl">{item.price}</p>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-background p-5 text-sm leading-7 text-muted-foreground">
            Mobile travel, waiting time, printing, witness coordination, and
            convenience charges are not fees for the notarial act itself.
            Applicable charges will be disclosed and agreed to before the
            appointment.
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container-shell grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
              Before your appointment
            </p>

            <h2 className="mt-4 font-serif text-4xl md:text-5xl">
              A little preparation keeps everything moving.
            </h2>

            <div className="mt-8 grid gap-4">
              {preparationSteps.map((step, index) => (
                <div
                  key={step}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-muted-foreground">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-7 md:p-9">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
              Important information
            </p>

            <h2 className="mt-4 font-serif text-3xl">
              What a notary can—and cannot—do.
            </h2>

            <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
              <p>
                A notary verifies identity, witnesses eligible signatures, and
                completes the appropriate notarial certificate.
              </p>

              <p>
                A Texas notary who is not an attorney cannot select your
                document, choose the type of notarization for you, prepare
                legal documents, or provide legal advice.
              </p>

              <p>
                The signer must be willing, aware, properly identified, and
                physically present for a traditional appointment or appear
                through an approved online notarization process.
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-background p-5 text-sm font-semibold leading-6">
              I am not an attorney licensed to practice law in Texas and may
              not give legal advice or accept fees for legal advice.
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-20">
        <div className="container-shell rounded-[2.5rem] bg-[#171412] px-7 py-12 text-center text-primary-foreground md:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
            Ready when you are
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl md:text-5xl">
            Request a convenient notary appointment.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-primary-foreground/70">
            Send the basic appointment details and receive availability and
            pricing before service.
          </p>
          <Link
            href="/contact?service=notary"
            className="mt-8 inline-flex rounded-full bg-primary-foreground px-7 py-3 text-sm font-semibold text-[#171412]"
          >
            Get Started
          </Link>
        </div>
      </section>
    </main>
  );
}
