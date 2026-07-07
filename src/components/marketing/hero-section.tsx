import Link from "next/link";

export function HeroSection() {
  return (
    <section className="luxury-gradient overflow-hidden border-b border-border py-20 md:py-28">
      <div className="container-shell grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-accent">Boutique STR Hospitality</p>
          <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[1.02] text-balance md:text-7xl">Elevated stays. Smarter revenue. Hospitality that feels effortless.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Luxe Haven Collective designs premium short-term rental experiences for guests and builds the operating system owners need to scale with confidence.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/stays" className="rounded-full bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground">View Available Stays</Link>
            <Link href="/owners" className="rounded-full border border-border bg-card px-6 py-3 text-center text-sm font-semibold">Partner With Luxe Haven</Link>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-border pt-8">
            {["4.9★ guest focus", "Owner-first reporting", "Boutique operations"].map((item) => <p key={item} className="text-sm font-medium text-muted-foreground">{item}</p>)}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full border border-accent/40" />
          <div className="overflow-hidden rounded-[2.5rem] border border-border bg-card p-3 shadow-2xl shadow-black/10">
            <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1400&auto=format&fit=crop" alt="Luxury short-term rental living room" className="h-[520px] w-full rounded-[2rem] object-cover" />
          </div>
          <div className="absolute -bottom-8 right-6 rounded-3xl border border-border bg-card p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">Owner snapshot</p>
            <p className="mt-2 font-serif text-3xl">+18%</p>
            <p className="text-sm text-muted-foreground">target revenue lift through sharper positioning</p>
          </div>
        </div>
      </div>
    </section>
  );
}
