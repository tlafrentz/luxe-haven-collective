import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Design Examples",
  description:
    "See real Furnishing Studio projects — the palette, budget, timeline, and guest-ready result.",
};

const examples = [
  {
    name: "Desert Retreat",
    location: "Scottsdale, AZ",
    packageName: "Luxury",
    duration: "5 weeks",
    style: "Modern warm",
    image:
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Ocean View Villa",
    location: "Malibu, CA",
    packageName: "Elevated",
    duration: "4 weeks",
    style: "Coastal minimal",
    image:
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Mountain Cabin",
    location: "Park City, UT",
    packageName: "Elevated",
    duration: "5 weeks",
    style: "Rustic contemporary",
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "City Escape",
    location: "Austin, TX",
    packageName: "Essential",
    duration: "3 weeks",
    style: "Warm industrial",
    image:
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=85",
  },
];

export default function FurnishingExamplesPage() {
  const [featured, ...rest] = examples;
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/furnishing">Furnishing Studio</Link>
            <span className="mx-2">›</span>
            <span>Design Examples</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            Designed for the stay guests remember.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            The material palette, room plan, budget, project duration, and
            final guest-ready result for real Furnishing Studio projects —
            not just a styled photograph.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Link
            href={`/furnishing/packages/${featured.packageName.toLowerCase()}`}
            className="group overflow-hidden rounded-xl border bg-white"
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={featured.image}
                alt={`${featured.name} completed furnishing project`}
                fill
                className="object-cover transition group-hover:scale-[1.02]"
                sizes="60vw"
              />
            </div>
            <div className="p-6">
              <h2 className="font-serif text-3xl">{featured.name}</h2>
              <p className="mt-1 text-sm text-stone-500">
                {featured.location}
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-stone-400">Package</dt>
                  <dd className="mt-1 font-semibold">
                    {featured.packageName}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-400">Duration</dt>
                  <dd className="mt-1 font-semibold">{featured.duration}</dd>
                </div>
                <div>
                  <dt className="text-stone-400">Style</dt>
                  <dd className="mt-1 font-semibold">{featured.style}</dd>
                </div>
              </dl>
            </div>
          </Link>
          <div className="grid gap-5">
            {rest.map((example) => (
              <Link
                key={example.name}
                href={`/furnishing/packages/${example.packageName.toLowerCase()}`}
                className="group flex items-center gap-4 overflow-hidden rounded-xl border bg-white p-3"
              >
                <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={example.image}
                    alt={`${example.name} completed furnishing project`}
                    fill
                    className="object-cover transition group-hover:scale-[1.02]"
                    sizes="96px"
                  />
                </div>
                <div>
                  <h3 className="font-serif text-xl">{example.name}</h3>
                  <p className="mt-1 text-sm text-stone-500">
                    {example.location} · {example.packageName}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="container-shell mt-8 space-y-4 text-center">
          <p className="mx-auto max-w-xl text-xs text-stone-500">
            Shown for illustration. Product availability and pricing can
            change between when a project is photographed and when your
            project is designed.
          </p>
          <Link
            href="/furnishing/packages"
            className="inline-flex rounded-md border border-[#789487] bg-white px-6 py-3 text-sm font-semibold"
          >
            Compare Packages →
          </Link>
        </div>
      </section>
    </main>
  );
}
