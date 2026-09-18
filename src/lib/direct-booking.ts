import type { Property } from "@/types/database";

/**
 * A property is eligible for the assisted request-to-book flow only when
 * explicitly flagged — LHS-001 pilots this on a single property (Mesa)
 * without hardcoding its slug into page components.
 */
export function isDirectBookingEnabled(
  property: Pick<Property, "metadata">
): boolean {
  const metadata = property.metadata;
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      (metadata as Record<string, unknown>).direct_booking_enabled === true
  );
}
