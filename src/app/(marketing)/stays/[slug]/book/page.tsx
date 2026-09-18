import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublishedPropertyBySlug } from "@/lib/properties";
import { isDirectBookingEnabled } from "@/lib/direct-booking";
import { RequestForm } from "./request-form";

type BookPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ arrival?: string; departure?: string; guests?: string }>;
};

export const metadata: Metadata = {
  title: "Request Dates | Luxe Haven Stays",
  robots: { index: false },
};

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { slug } = await params;
  const { arrival, departure, guests } = await searchParams;
  const property = await getPublishedPropertyBySlug(slug);

  if (!isDirectBookingEnabled(property)) {
    notFound();
  }

  return (
    <main className="bg-[#fffdf9] py-12">
      <div className="container-shell max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">{property.name}</p>
        <h1 className="mt-3 font-serif text-4xl">Request your stay</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Availability is manually verified before payment. Sending this request does not hold these
          dates — we&apos;ll check the calendar and follow up with next steps.
        </p>

        <RequestForm
          propertySlug={property.slug}
          propertyName={property.name}
          maxGuests={property.max_guests}
          minimumNights={property.minimum_nights}
          initialArrival={arrival ?? ""}
          initialDeparture={departure ?? ""}
          initialGuests={guests ? Number(guests) : undefined}
        />
      </div>
    </main>
  );
}
