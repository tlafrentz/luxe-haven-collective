import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";

const metrics = [
  ["2,000+", "Guests Hosted"],
  ["4.9 ★", "Average Review"],
  ["100+", "Properties Supported"],
  ["$45M+", "Revenue Influenced"],
] as const;

export function HeroSection() {
  return (
    <section className="pb-8 pt-10 lg:pb-0 lg:pt-7">
      <div className="container-shell grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
        <div className="py-6">
          <p className="text-[11px] font-bold uppercase leading-5 tracking-[.16em] text-[#a56b19]">
            The performance platform
            <br />
            for hospitality business
          </p>
          <h1 className="mt-5 font-serif text-6xl leading-[.98] tracking-[-.035em] md:text-7xl">
            <span className="block">Operate.</span>
            <span className="block">Optimize.</span>
            <span className="block text-[#07533a]">Outperform.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-stone-600">
            The hospitality operating system for owners who want exceptional
            guest experiences, stronger financial performance, and smarter
            operational decisions.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/solutions"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#07533a] px-5 text-sm font-semibold text-white"
            >
              Explore Solutions <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/platform"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#789487] bg-white px-5 text-sm font-semibold"
            >
              See How It Works <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-12">
            <p className="text-[9px] font-bold uppercase tracking-[.15em] text-stone-500">
              Trusted by operators worldwide
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm font-semibold text-stone-700">
              <span>airbnb</span>
              <span className="font-serif italic">Vrbo</span>
              <span>Booking.com</span>
              <span>Google</span>
              <span className="text-[#d09024]">★★★★★</span>
              <span className="text-xs font-normal">
                4.9/5 · from 2,000+ reviews
              </span>
            </div>
          </div>
        </div>
        <div className="relative pb-10 lg:pb-16">
          <div className="relative aspect-[1.48/1] overflow-hidden rounded-xl">
            <SafeImage
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=90&w=1800&auto=format&fit=crop"
              alt="Premium coastal hospitality interior"
              fill
              priority
              sizes="(min-width:1024px) 62vw,100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute inset-x-8 bottom-0 grid grid-cols-2 overflow-hidden rounded-xl border bg-white shadow-xl sm:grid-cols-4">
            {metrics.map(([value, label]) => (
              <div
                key={label}
                className="border-r p-4 text-center last:border-0"
              >
                <p className="text-xl font-semibold">{value}</p>
                <p className="mt-1 text-[10px] text-stone-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
