import Link from "next/link";

const exploreLinks = [
  ["Stays", "/stays"],
  ["Services", "/services"],
  ["Owners", "/owners"],
  ["Resources", "/resources"],
  ["FAQ", "/faq"],
];

const serviceLinks = [
  ["STR Consulting", "/services"],
  ["Co-Hosting", "/owners"],
  ["Texas Notary", "/notary"],
  ["Contact", "/contact"],
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[#171412] text-primary-foreground">
      <div className="container-shell grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <p className="text-lg font-semibold uppercase tracking-[0.28em]">
            Luxe Haven
          </p>

          <p className="mt-4 max-w-md text-sm leading-7 text-primary-foreground/70">
            Boutique hospitality, short-term rental performance systems, and
            professional Texas notary services—delivered with care,
            responsiveness, and modern design.
          </p>

          <Link
            href="/contact"
            className="mt-6 inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
          >
            Start a Conversation
          </Link>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Explore
          </p>

          <div className="mt-4 grid gap-3 text-sm text-primary-foreground/70">
            {exploreLinks.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="hover:text-primary-foreground"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Services
          </p>

          <div className="mt-4 grid gap-3 text-sm text-primary-foreground/70">
            {serviceLinks.map(([label, href]) => (
              <Link
                key={`${label}-${href}`}
                href={href}
                className="hover:text-primary-foreground"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            For Owners
          </p>

          <p className="mt-4 text-sm leading-7 text-primary-foreground/70">
            Discover where your property may be leaving revenue, reviews, or
            repeat stays on the table.
          </p>

          <Link
            href="/lead-magnet"
            className="mt-5 inline-flex text-sm font-semibold text-primary-foreground underline decoration-accent underline-offset-4"
          >
            Get the free checklist
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 py-6">
        <div className="container-shell flex flex-col gap-3 text-xs text-primary-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Luxe Haven Collective. All rights
            reserved.
          </p>

          <p>Hospitality consulting and Texas notary services.</p>
        </div>
      </div>
    </footer>
  );
}
