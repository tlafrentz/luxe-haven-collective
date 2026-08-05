import Link from "next/link";

const terms = [
  [
    "Acceptance of Terms",
    "By accessing or using our website, services, platform, booking experiences, or purchasing an offer, you agree to these Terms and any applicable order-specific terms.",
  ],
  [
    "Accounts & Registration",
    "You are responsible for providing accurate information, protecting account credentials, and notifying us promptly of suspected unauthorized access.",
  ],
  [
    "Services",
    "Service scope, deliverables, timing, responsibilities, and exclusions are defined in the applicable offer, proposal, statement of work, or confirmation.",
  ],
  [
    "Bookings & Stays",
    "Property bookings remain subject to availability, property rules, occupancy limits, platform terms, and the cancellation policy shown when booking.",
  ],
  [
    "Payments & Fees",
    "Prices, taxes, fees, payment timing, and billing terms are presented before purchase. Third-party payment providers securely process payment details.",
  ],
  [
    "Cancellation & Refunds",
    "Cancellation and refund eligibility depends on the purchased offer, booking, or signed agreement. Applicable policies are disclosed before commitment.",
  ],
  [
    "Guest Responsibilities",
    "Guests must follow property rules, respect occupancy limits, protect the property, and promptly report safety or maintenance concerns.",
  ],
  [
    "Intellectual Property",
    "Luxe Haven content, templates, systems, branding, and deliverables remain protected by applicable intellectual-property laws and license terms.",
  ],
  [
    "Limitation of Liability",
    "To the extent permitted by law, liability is limited according to the applicable agreement and excludes indirect or consequential losses.",
  ],
  [
    "Governing Law",
    "These Terms are governed by applicable law and any venue or dispute provisions stated in the agreement governing the relevant service.",
  ],
  [
    "Contact Us",
    "Questions about these Terms may be submitted through our contact page.",
  ],
] as const;

export default function TermsPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b py-14">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            Terms of service
          </p>
          <h1 className="mt-5 font-serif text-6xl">Terms of Service</h1>
          <p className="mt-4 text-sm text-stone-600">
            Last updated August 4, 2026
          </p>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-600">
            Please read these terms carefully before using our website,
            services, or platform.
          </p>
        </div>
      </section>
      <section className="py-14">
        <div className="container-shell grid gap-10 lg:grid-cols-[.42fr_1fr]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-semibold">Contents</h2>
            <nav className="mt-4 grid gap-2 text-sm text-stone-600">
              {terms.map(([title], index) => (
                <a
                  key={title}
                  href={`#term-${index + 1}`}
                  className="hover:text-emerald-800"
                >
                  {index + 1}. {title}
                </a>
              ))}
            </nav>
          </aside>
          <div className="space-y-9">
            {terms.map(([title, text], index) => (
              <section
                key={title}
                id={`term-${index + 1}`}
                className="scroll-mt-28 border-b pb-8"
              >
                <h2 className="font-serif text-3xl">
                  {index + 1}. {title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-stone-600">{text}</p>
                {title === "Contact Us" ? (
                  <Link
                    href="/contact"
                    className="mt-4 inline-flex font-semibold text-emerald-800"
                  >
                    Contact support →
                  </Link>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
