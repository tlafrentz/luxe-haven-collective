import Link from "next/link";

type CTASectionProps = {
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function CTASection({
  title = "Ready to build a better hospitality business?",
  description = "Let’s identify the clearest opportunities to strengthen your property, guest experience, operations, and owner performance.",
  primaryHref = "/contact?service=consulting",
  primaryLabel = "Schedule a Strategy Consultation",
  secondaryHref = "/lead-magnet",
  secondaryLabel = "Download the Owner Checklist",
}: CTASectionProps) {
  return (
    <section className="py-20 md:py-28">
      <div className="container-shell">
        <div className="dark-luxury relative overflow-hidden rounded-[2.5rem] p-8 text-center text-primary-foreground md:p-16 lg:p-20">
          <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />

          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
              Your next step
            </p>

            <h2 className="mx-auto mt-5 max-w-4xl font-serif text-4xl leading-tight md:text-6xl">
              {title}
            </h2>

            <p className="mx-auto mt-6 max-w-2xl leading-8 text-primary-foreground/65">
              {description}
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="rounded-full bg-primary-foreground px-7 py-3.5 text-sm font-semibold text-primary transition hover:opacity-90"
              >
                {primaryLabel}
              </Link>

              <Link
                href={secondaryHref}
                className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-white/10"
              >
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
