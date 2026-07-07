import { FeaturedProperties } from "@/components/marketing/featured-properties";
import { HeroSection } from "@/components/marketing/hero-section";
import { ValueProps } from "@/components/marketing/value-props";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <FeaturedProperties />
      <ValueProps />
      <section className="py-20"><div className="container-shell rounded-[2rem] border border-border bg-card p-10 text-center md:p-16"><p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Owner partnership</p><h2 className="mt-4 font-serif text-4xl">Designed for owners who want premium hospitality without daily operations.</h2><p className="mx-auto mt-5 max-w-2xl text-muted-foreground">From guest messaging and quality control to performance reporting, Luxe Haven Collective is building the infrastructure for a more polished STR business.</p></div></section>
    </main>
  );
}
