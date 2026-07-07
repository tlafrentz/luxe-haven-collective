import Link from "next/link";

export function HeroSection() {
  return (
    <section className="luxury-gradient py-24 md:py-32">
      <div className="container-shell grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-accent">Boutique STR Hospitality</p>
          <h1 className="mt-6 max-w-4xl font-serif text-5xl leading-tight md:text-7xl">Elevated stays. Effortless ownership. Hospitality with intention.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Luxe Haven Collective pairs guest-ready design, responsive service, and revenue-minded operations to create standout short-term rental experiences.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/stays" className="rounded-full bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground">View Available Stays</Link>
            <Link href="/contact" className="rounded-full border border-border bg-card px-6 py-3 text-center text-sm font-semibold">Partner With Luxe Haven</Link>
          </div>
        </div>
        <div className="rounded-[2rem] border border-border bg-card p-3 shadow-xl">
          <div className="h-[440px] rounded-[1.5rem] bg-[url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center" />
        </div>
      </div>
    </section>
  );
}
