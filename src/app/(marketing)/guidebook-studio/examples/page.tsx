import type { Metadata } from "next";
import Link from "next/link";
import { SafeImage } from "@/components/shared/safe-image";
import { mesaAirbnbImages } from "@/lib/mesa-airbnb";

export const metadata: Metadata = {
  title: "Example Guidebooks",
  description: "See examples of beautiful guidebooks built for exceptional stays.",
};

const examples = [
  { name: "Ocean View Villa", location: "Malibu, CA", image: mesaAirbnbImages[1], featured: true },
  { name: "Desert Retreat", location: "Scottsdale, AZ", image: mesaAirbnbImages[0] },
  { name: "Mountain Cabin", location: "Park City, UT", image: mesaAirbnbImages[3] },
  { name: "City Escape", location: "Austin, TX", image: mesaAirbnbImages[4] },
];

export default function GuidebookExamplesPage() {
  const [featured, ...rest] = examples;
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/guidebook-studio">Guidebook Studio</Link>
            <span className="mx-2">›</span>
            <span>Examples</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            See examples of beautiful guidebooks built for exceptional stays.
          </h1>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Link
            href="/guidebook-studio/packages/done-for-you"
            className="group overflow-hidden rounded-xl border bg-white"
          >
            <div className="relative aspect-[4/3]">
              <SafeImage
                src={featured.image}
                alt={featured.name}
                fill
                className="object-cover transition group-hover:scale-[1.02]"
                sizes="60vw"
              />
            </div>
            <div className="p-6">
              <h2 className="font-serif text-3xl">{featured.name}</h2>
              <p className="mt-1 text-sm text-stone-500">{featured.location}</p>
            </div>
          </Link>
          <div className="grid gap-5">
            {rest.map((example) => (
              <Link
                key={example.name}
                href="/guidebook-studio/packages/done-for-you"
                className="group flex items-center gap-4 overflow-hidden rounded-xl border bg-white p-3"
              >
                <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg">
                  <SafeImage
                    src={example.image}
                    alt={example.name}
                    fill
                    className="object-cover transition group-hover:scale-[1.02]"
                    sizes="96px"
                  />
                </div>
                <div>
                  <h3 className="font-serif text-xl">{example.name}</h3>
                  <p className="mt-1 text-sm text-stone-500">{example.location}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="container-shell mt-8 text-center">
          <Link
            href="/guidebook-studio/templates"
            className="inline-flex rounded-md border border-[#789487] bg-white px-6 py-3 text-sm font-semibold"
          >
            View Full Gallery →
          </Link>
        </div>
      </section>
    </main>
  );
}
