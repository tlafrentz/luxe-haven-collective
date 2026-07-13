import Image from "next/image";

import { CTASection } from "@/components/marketing/cta-section";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";

export default function AboutPage() {
  return (
    <main>
      <PageHero
        eyebrow="About Luxe Haven"
        title="A hospitality brand built for owners, guests, and homes with potential."
        description="Luxe Haven Collective blends elevated guest experience, operational care, and revenue strategy for short-term rentals that should feel polished from first click to final checkout."
      />

      <section className="py-20">
        <div className="container-shell grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="relative h-[520px] overflow-hidden rounded-[2.5rem]">
            <Image
              src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1400&auto=format&fit=crop"
              alt="Warm luxury interior"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>

          <div>
            <SectionHeading
              eyebrow="Our point of view"
              title="Luxury is not loud. It is consistent."
              description="The best short-term rentals do not rely on one beautiful room or one strong review. They deliver reliable comfort, smart communication, clean operations, and a brand promise guests can feel."
            />

            <p className="mt-6 leading-8 text-muted-foreground">
              We are creating a modern hospitality platform for
              boutique STR owners: part brand studio, part
              management system, part guest experience engine.
              The result is a property that presents better,
              operates cleaner, and earns trust faster.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-muted/45 py-20">
        <div className="container-shell grid gap-5 md:grid-cols-3">
          {[
            [
              "Tasteful",
              "Design, copy, photography, and amenities should create a sense of calm confidence.",
            ],
            [
              "Transparent",
              "Owners deserve clear reporting, direct communication, and practical recommendations.",
            ],
            [
              "Systemized",
              "Great hospitality is repeatable when standards, workflows, and data are connected.",
            ],
          ].map(([title, copy]) => (
            <div
              key={title}
              className="rounded-3xl border border-border bg-card p-7"
            >
              <h3 className="font-serif text-3xl">
                {title}
              </h3>

              <p className="mt-4 leading-7 text-muted-foreground">
                {copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      <CTASection title="Build a stay guests remember and an ownership experience you can trust." />
    </main>
  );
}
