import Link from "next/link";

export function CTASection({ title = "Ready to create a more profitable, polished hospitality experience?", description = "Let’s align your property, guest journey, and revenue strategy into one elevated operating system." }) {
  return (
    <section className="py-20">
      <div className="container-shell dark-luxury overflow-hidden rounded-[2.5rem] p-8 text-center text-primary-foreground md:p-16">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Next step</p>
        <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl leading-tight md:text-6xl">{title}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-primary-foreground/70">{description}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/contact" className="rounded-full bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary">Schedule a Consultation</Link>
          <Link href="/lead-magnet" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-primary-foreground">Download Owner Checklist</Link>
        </div>
      </div>
    </section>
  );
}
