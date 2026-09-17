import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";
import { PropertyCard } from "@/components/property/property-card";
import { getPublishedProperties, propertyImage } from "@/lib/properties";

export const metadata: Metadata = {
  title: "Luxe Haven Stays | Direct Booking",
  description:
    "Book Luxe Haven managed stays directly. Transparent pricing, professional management, and secure checkout — no third-party account required.",
};

const directBookingBenefits = [
  [
    "Transparent pricing",
    "The total you see is the total you pay, with nightly rate, fees, and taxes itemized before checkout.",
  ],
  [
    "Direct support",
    "Reach the team managing your stay directly, without routing through a third-party platform.",
  ],
  [
    "Secure checkout",
    "Payment and reservation details are handled by our booking partner's secure, PCI-compliant checkout.",
  ],
  [
    "Professionally managed",
    "Every stay is prepared and supported by the same operational standards across our portfolio.",
  ],
] as const;

export default async function StaysPage() {
  const properties = await getPublishedProperties();
  const featured = properties[0];

  return (
    <main className="bg-[#fffdf9]">
      <section className="py-12">
        <div className="container-shell grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              Luxe Haven Stays
            </p>
            <h1 className="mt-5 font-serif text-5xl leading-[1.08] md:text-6xl">
              Exceptional stays.
              <br />
              Thoughtful details.
              <br />
              Booked directly.
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-stone-600">
              Thoughtfully prepared places for work, relocation, and extended
              visits — backed by hospitality standards, attentive guest care,
              and a secure direct-booking checkout.
            </p>
          </div>
          {featured ? (
            <div className="relative aspect-[1.7/1] overflow-hidden rounded-xl">
              <SafeImage
                src={propertyImage(featured)}
                alt={featured.name}
                fill
                priority
                className="object-cover"
                sizes="(min-width:1024px) 55vw,100vw"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="pb-16">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            Available stays
          </p>
          {properties.length > 0 ? (
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border bg-white p-8 text-sm text-stone-600">
              New stays will appear here as they become available for direct
              booking.
            </div>
          )}
        </div>
      </section>

      <section className="bg-[#f5efe5] py-14">
        <div className="container-shell">
          <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            Why book direct with Luxe Haven
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-4">
            {directBookingBenefits.map(([title, text]) => (
              <div key={title} className="text-center">
                <ShieldCheck className="mx-auto size-7 text-emerald-800" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-stone-600">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-stone-500">
            Cancellation terms, accessibility information, and our privacy
            notice are available on every stay page before payment. Read our{" "}
            <Link href="/terms" className="underline">
              booking terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              privacy notice
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
