import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";

const trustMarks = ["Airbnb", "Vrbo", "Booking.com", "Google"];

export function HeroSection() {
  return (
    <section className="bg-[#f7f7f3] px-3 pb-5 pt-3 sm:px-5 sm:pb-8 lg:px-8">
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[1.4rem] border border-[#cdd3ce] bg-white shadow-[0_18px_60px_rgba(20,45,35,0.08)]">
        <div className="grid min-h-[590px] lg:grid-cols-[0.88fr_1.12fr]">
          <div className="relative z-10 flex flex-col justify-center px-7 py-14 sm:px-12 lg:px-16 xl:px-20">
            <h1 className="max-w-xl font-serif text-[3.35rem] leading-[0.98] tracking-[-0.04em] text-[#161b18] sm:text-7xl lg:text-[5rem]">
              Operate.
              <br />
              Optimize.
              <br />
              Outperform.
            </h1>
            <p className="mt-8 max-w-lg text-base leading-7 text-[#56605a] sm:text-lg">
              The performance platform for independent hospitality businesses.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/solutions"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#074e38] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#053d2c]"
              >
                Explore Solutions <ArrowRight aria-hidden size={16} />
              </Link>
              <Link
                href="/packages"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#9ca8a1] bg-white px-6 text-sm font-semibold text-[#18352b] transition hover:border-[#074e38] hover:bg-[#f2f7f4]"
              >
                View Packages
              </Link>
            </div>
          </div>

          <div className="relative min-h-[380px] overflow-hidden lg:min-h-full">
            <div className="absolute inset-y-0 left-0 z-10 hidden w-24 -translate-x-12 skew-x-[-12deg] bg-white lg:block" />
            <SafeImage
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=88&w=1800&auto=format&fit=crop"
              alt="Refined hospitality interior managed through Luxe Haven Collective"
              fill
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b2118]/20 via-transparent to-transparent" />
            <div className="absolute bottom-6 right-6 z-20 flex items-center gap-3 rounded-full border border-white/50 bg-white/90 px-4 py-2 text-xs font-semibold text-[#18352b] shadow-lg backdrop-blur">
              Hospitality, measured better <ArrowRight aria-hidden size={14} />
            </div>
          </div>
        </div>

        <div className="grid gap-7 border-t border-[#dde1dd] bg-[#fbfbf8] px-7 py-7 sm:px-12 lg:grid-cols-[1fr_2.4fr_auto] lg:items-center lg:px-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#68716c]">
            Trusted by operators worldwide
          </p>
          <div className="grid grid-cols-2 items-center gap-x-8 gap-y-4 text-center sm:grid-cols-4">
            {trustMarks.map((mark) => (
              <span
                key={mark}
                className="font-serif text-lg font-semibold text-[#46504a]"
              >
                {mark}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 lg:justify-end">
            <span className="text-lg tracking-[0.12em] text-[#d99018]">
              ★★★★★
            </span>
            <span className="text-[10px] leading-4 text-[#68716c]">
              <strong className="text-[#29322d]">4.9/5</strong> from 2,000+
              reviews
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
