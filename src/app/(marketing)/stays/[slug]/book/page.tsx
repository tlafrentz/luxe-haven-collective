import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { getPublishedPropertyBySlug } from "@/lib/properties";
import { isDirectBookingEnabled, getDirectBookingWidgetConfig } from "@/lib/direct-booking";
import { track } from "@/lib/analytics/track";

type BookPageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
  title: "Check Availability | Luxe Haven Stays",
  robots: { index: false },
};

export default async function BookPage({ params }: BookPageProps) {
  const { slug } = await params;
  const property = await getPublishedPropertyBySlug(slug);

  if (!isDirectBookingEnabled(property)) {
    notFound();
  }

  const { widgetEmbedHtml } = getDirectBookingWidgetConfig();
  track("stay_availability_interaction", { slug: property.slug });
  if (widgetEmbedHtml) {
    track("stay_quote_shown", { slug: property.slug });
  }

  return (
    <main className="bg-[#fffdf9] py-12">
      <div className="container-shell max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
          {property.name}
        </p>
        <h1 className="mt-3 font-serif text-4xl">Check availability</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Dates, guest count, and pricing below come directly from our
          booking partner and reflect live availability — nothing here is
          estimated by Luxe Haven.
        </p>

        <div className="mt-8 rounded-xl border bg-white p-6">
          {widgetEmbedHtml ? (
            <div
              data-testid="hospitable-widget"
              // Trusted, admin-configured markup (HOSPITABLE_DIRECT_WIDGET_EMBED_HTML),
              // never derived from guest input.
              dangerouslySetInnerHTML={{ __html: widgetEmbedHtml }}
            />
          ) : (
            <div role="status" className="py-10 text-center">
              <p className="font-semibold">Direct booking opens soon</p>
              <p className="mt-2 text-sm text-stone-600">
                Live availability for {property.name} isn&apos;t connected
                yet. No dates are held or unavailable — check back shortly,
                or{" "}
                <Link href="/contact?service=stay" className="underline">
                  contact us
                </Link>{" "}
                to check dates directly.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-600">
            Ready to book? Continue to a secure checkout hosted by our
            booking partner.
          </p>
          <a
            href={`/stays/${property.slug}/checkout`}
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Continue to secure checkout
          </a>
        </div>

        <p className="mt-6 text-xs text-stone-500">
          Read our{" "}
          <Link href="/terms" className="underline">
            booking terms
          </Link>
          , cancellation policy, and{" "}
          <Link href="/privacy" className="underline">
            privacy notice
          </Link>{" "}
          before you book.
        </p>
      </div>
    </main>
  );
}
