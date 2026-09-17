import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublishedPropertyBySlug } from "@/lib/properties";
import { isDirectBookingEnabled } from "@/lib/direct-booking";
import { CheckoutHandoff } from "./checkout-handoff";

type CheckoutPageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
  title: "Secure Checkout | Luxe Haven Stays",
  robots: { index: false },
};

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const property = await getPublishedPropertyBySlug(slug);

  if (!isDirectBookingEnabled(property)) {
    notFound();
  }

  return <CheckoutHandoff propertySlug={property.slug} propertyName={property.name} />;
}
