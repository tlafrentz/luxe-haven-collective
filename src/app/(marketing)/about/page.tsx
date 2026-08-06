import Link from "next/link";
import { Check, Eye, Target, Zap, GraduationCap, Search } from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";
import { mesaAirbnbImages } from "@/lib/mesa-airbnb";

const values = [
  [
    "Tasteful",
    "Design, copy, photography, and amenities should create calm confidence.",
  ],
  [
    "Transparent",
    "Owners deserve clear reporting, direct communication, and practical recommendations.",
  ],
  [
    "Systemized",
    "Great hospitality is repeatable when standards, workflows, and data are connected.",
  ],
] as const;

export default function AboutPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-14">
        <div className="container-shell grid gap-10 lg:grid-cols-[1fr_.9fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              About Luxe Haven
            </p>
            <h1 className="mt-5 max-w-2xl font-serif text-5xl leading-[1.06] md:text-6xl">
              A hospitality brand built for owners, guests, and homes with{" "}
              <span className="text-[#a56b19]">potential.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-stone-600">
              Luxe Haven Collective blends elevated guest experience,
              operational care, and revenue strategy for short-term rentals that
              should feel polished from first click to final checkout.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/approach"
                className="rounded-md bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Our Approach →
              </Link>
              <Link
                href="/performance"
                className="rounded-md border px-5 py-3 text-sm font-semibold"
              >
                Explore the Platform →
              </Link>
            </div>
          </div>
          <div className="relative aspect-[1.15/1] overflow-hidden rounded-xl">
            <SafeImage
              src={mesaAirbnbImages[0]}
              alt="Luxe Haven hospitality interior"
              fill
              priority
              className="object-cover"
              sizes="(min-width:1024px) 45vw,100vw"
            />
          </div>
        </div>
      </section>
      <section className="py-10">
        <div className="container-shell grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              Built by operators
            </p>
            <h2 className="mt-4 font-serif text-4xl">
              We operate real properties.
              <br />
              Everything we recommend has been tested in actual guest stays.
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-3 rounded-xl border bg-white p-5 sm:grid-cols-4">
              {[
                ["100+", "Properties Operated"],
                ["15K+", "Guests Hosted"],
                ["4.9★", "Average Review"],
                ["5+", "Years Operating"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="mt-1 text-[10px] text-stone-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-emerald-900 p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d6a04c]">
              Our philosophy
            </p>
            <div className="mt-5 space-y-5">
              {values.map(([title, text]) => (
                <div key={title} className="flex gap-3">
                  <Check className="mt-1 size-4 shrink-0" />
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-white/70">
                      {text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="py-12">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            Featured properties
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {mesaAirbnbImages.slice(0, 3).map((image, index) => (
              <Link
                key={image}
                href="/stays/mesa-downtown-retreat"
                className="overflow-hidden rounded-xl border bg-white"
              >
                <div className="relative aspect-[16/10]">
                  <SafeImage
                    src={image}
                    alt={`Mesa property view ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="33vw"
                  />
                </div>
                <p className="p-4 font-semibold">
                  {index === 0
                    ? "Thoughtfully Designed Mesa Getaway"
                    : index === 1
                      ? "Outdoor Living"
                      : "Comfortable Interiors"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="border-y bg-[#faf6ef] py-12">
        <div className="container-shell grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              The experience we build
            </p>
            <h2 className="mt-4 font-serif text-4xl">
              Better operations. Stronger revenue. Five-star experiences. Every
              stay.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-5">
            {[
              ["Observe", Eye],
              ["Understand", Search],
              ["Decide", Target],
              ["Execute", Zap],
              ["Learn", GraduationCap],
            ].map(([label, Icon]) => {
              const Mark = Icon as typeof Eye;
              return (
                <Link
                  key={String(label)}
                  href="/performance/overview"
                  className="text-center"
                >
                  <Mark className="mx-auto size-6" />
                  <p className="mt-3 text-sm font-semibold">{String(label)}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section className="py-10">
        <div className="container-shell flex flex-wrap items-center justify-between gap-5 rounded-xl bg-emerald-900 px-7 py-6 text-white">
          <div>
            <p className="text-xs uppercase tracking-[.15em] text-[#d6a04c]">
              Your next step
            </p>
            <h2 className="mt-2 font-serif text-3xl">
              Explore how we can help your property perform.
            </h2>
          </div>
          <div className="flex gap-3">
            <Link
              href="/get-started"
              className="rounded-md border border-white/40 px-5 py-3 text-sm font-semibold"
            >
              Find Your Best Fit
            </Link>
            <Link
              href="/lead-magnet"
              className="rounded-md border border-white/40 px-5 py-3 text-sm font-semibold"
            >
              Download the Owner Checklist
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
