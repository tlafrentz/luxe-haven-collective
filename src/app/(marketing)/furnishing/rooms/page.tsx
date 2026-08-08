import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { furnishingPackages, furnishingRoomExamples } from "@/lib/furnishing-packages";

export const metadata: Metadata = {
  title: "Room Package Examples",
  description:
    "Explore typical product categories for every room type Furnishing Studio covers.",
};

const images = [
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=85",
];

export default function FurnishingRoomsPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/furnishing">Furnishing Studio</Link>
            <span className="mx-2">›</span>
            <span>Room Package Examples</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            Every room works harder.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            Representative examples of what a room package typically covers.
            Exact products and room coverage depend on your selected package
            and property — see{" "}
            <Link href="/furnishing/packages" className="font-semibold underline">
              Compare Packages
            </Link>{" "}
            for the limits and quantities supported by each tier.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell space-y-10">
          {furnishingRoomExamples.map((room, index) => (
            <article
              key={room.slug}
              className="grid gap-6 rounded-xl border border-[#dce2dd] bg-white p-6 lg:grid-cols-[.6fr_1fr]"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
                <Image
                  src={images[index % images.length]}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="400px"
                />
              </div>
              <div>
                <h2 className="font-serif text-3xl">{room.name}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {room.description}
                </p>
                <p className="mt-4 text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
                  Typical product categories
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {room.typicalCategories.map((category) => (
                    <li
                      key={category}
                      className="rounded-full border border-[#dce2dd] bg-[#f9faf8] px-3 py-1 text-xs font-medium text-stone-700"
                    >
                      {category}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs italic text-stone-500">
                  Representative example — not a guaranteed inclusion or exact
                  pictured product. Actual selections are proposed during
                  design and always require your approval.
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[#dce2dd] bg-[#f9faf8] py-14">
        <div className="container-shell">
          <h2 className="font-serif text-3xl">Room coverage by package</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {furnishingPackages.map((pkg) => (
              <div key={pkg.slug} className="rounded-xl border bg-white p-5">
                <p className="font-semibold">{pkg.name}</p>
                <p className="mt-2 text-sm text-stone-600">
                  {pkg.comparison.roomCoverage}
                </p>
                <Link
                  href={`/furnishing/packages/${pkg.slug}`}
                  className="mt-3 inline-flex text-sm font-semibold text-emerald-800"
                >
                  View package →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
