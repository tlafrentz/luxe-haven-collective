import Link from "next/link";

const sections = [
  [
    "Information We Collect",
    "We collect information you provide through forms, purchases, bookings, account creation, and support requests, along with limited technical data needed to operate and secure our services.",
  ],
  [
    "How We Use Information",
    "We use information to respond to requests, provide purchased services, manage stays and accounts, improve our experiences, prevent misuse, and meet legal obligations.",
  ],
  [
    "Your Choices & Rights",
    "You may request access, correction, or deletion of eligible personal information and can unsubscribe from marketing communications at any time.",
  ],
  [
    "Data Sharing",
    "We share information only with service providers and business partners necessary to deliver a requested service, process a transaction, or comply with law.",
  ],
  [
    "Cookies & Tracking",
    "We use necessary cookies and limited analytics to keep the site working, understand performance, and improve customer journeys.",
  ],
  [
    "Contact Our Privacy Team",
    "Questions or privacy requests can be submitted through our contact page. We will verify requests before disclosing or changing account information.",
  ],
] as const;

export default function PrivacyPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b py-16">
        <div className="container-shell grid gap-10 lg:grid-cols-[1fr_.55fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              Privacy inquiries
            </p>
            <h1 className="mt-5 font-serif text-5xl leading-tight md:text-6xl">
              Privacy &amp; Data.
              <br />
              We believe trust begins
              <br />
              with transparency.
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-stone-600">
              We are committed to protecting your personal information and being
              clear about how we collect, use, and protect it.
            </p>
          </div>
          <div className="rounded-2xl bg-[#f4ede1] p-10">
            <p className="font-serif text-3xl text-emerald-950">
              Your information should support your experience—never obscure it.
            </p>
          </div>
        </div>
      </section>
      <section className="py-14">
        <div className="container-shell max-w-5xl">
          <div className="divide-y rounded-xl border bg-white">
            {sections.map(([title, text]) => (
              <details
                key={title}
                className="group p-5"
                open={title === "Information We Collect"}
              >
                <summary className="cursor-pointer list-none font-semibold">
                  {title}
                  <span className="float-right text-emerald-800 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600">
                  {text}
                </p>
              </details>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-stone-100 p-6">
            <div>
              <p className="font-semibold">
                Have a privacy question or request?
              </p>
              <p className="mt-1 text-sm text-stone-600">We’re here to help.</p>
            </div>
            <Link
              href="/contact?service=general"
              className="rounded-md bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Contact Our Privacy Team →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
