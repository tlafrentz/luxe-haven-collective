import Link from "next/link";

export function HeroSection() {
  return (
    <section className="luxury-gradient overflow-hidden border-b border-border py-20 md:py-28 lg:py-32">
      <div className="container-shell grid items-center gap-14 lg:grid-cols-[1.08fr_.92fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-accent">
            Boutique Hospitality Management
          </p>

          <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.98] tracking-[-0.03em] text-balance md:text-7xl lg:text-[5.5rem]">
            Luxury hospitality.
            <br />
            Intelligent operations.
            <br />
            Exceptional returns.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
            Luxe Haven Collective helps short-term rental owners build
            high-performing hospitality businesses through boutique management,
            revenue optimization, operational excellence, and exceptional guest
            experiences.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contact?service=consulting"
              className="rounded-full bg-primary px-7 py-3.5 text-center text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Schedule a Strategy Consultation
            </Link>

            <Link
              href="/services"
              className="rounded-full border border-border bg-card px-7 py-3.5 text-center text-sm font-semibold transition hover:bg-muted"
            >
              Explore Our Services
            </Link>
          </div>

          <div className="mt-12 grid max-w-2xl gap-5 border-t border-border pt-8 sm:grid-cols-3">
            {[
              ["Guest Experience", "Thoughtful hospitality standards"],
              ["Owner Performance", "Clear, revenue-focused decisions"],
              ["Operating Systems", "Consistent execution and reporting"],
            ].map(([title, description]) => (
              <div key={title}>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full border border-accent/30" />
          <div className="absolute -bottom-12 -right-12 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

          <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-card p-3 shadow-2xl shadow-black/10">
            <img
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1400&auto=format&fit=crop"
              alt="Elevated living room representing Luxe Haven hospitality"
              className="h-[540px] w-full rounded-[2rem] object-cover md:h-[620px]"
            />
          </div>

          <div className="absolute -bottom-8 left-5 right-5 rounded-[1.75rem] border border-border bg-background/95 p-5 shadow-xl backdrop-blur md:left-auto md:right-6 md:w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              The Luxe Haven Standard
            </p>

            <p className="mt-3 font-serif text-2xl">
              Every detail should support the stay and the investment.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
