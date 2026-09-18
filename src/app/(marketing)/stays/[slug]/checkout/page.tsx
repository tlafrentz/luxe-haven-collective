import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getPublishedPropertyBySlug } from "@/lib/properties";
import { isDirectBookingEnabled } from "@/lib/direct-booking";
import { getBookingRequestStatus } from "@/app/actions/booking-requests";
import { FinalTerms } from "./final-terms";

type CheckoutPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ request?: string }>;
};

export const metadata: Metadata = {
  title: "Secure Checkout | Luxe Haven Stays",
  robots: { index: false },
};

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { slug } = await params;
  const { request: requestToken } = await searchParams;
  const property = await getPublishedPropertyBySlug(slug);

  if (!isDirectBookingEnabled(property) || !requestToken) {
    notFound();
  }

  const status = await getBookingRequestStatus(requestToken);
  if (status.state === "not_found") notFound();
  if (status.state === "confirmed") redirect(`/stays/booking/status?request=${requestToken}`);
  if (status.state === "active" && status.status !== "awaiting_payment") {
    redirect(`/stays/booking/status?request=${requestToken}`);
  }

  return (
    <FinalTerms
      requestToken={requestToken}
      propertyName={status.state === "active" ? status.propertyName : property.name}
      arrival={status.state === "active" ? status.arrival : ""}
      departure={status.state === "active" ? status.departure : ""}
      totalMinor={status.state === "active" ? status.totalMinor : null}
      currency={status.state === "active" ? status.currency : null}
      slaDueAt={status.state === "active" ? status.slaDueAt : null}
    />
  );
}
