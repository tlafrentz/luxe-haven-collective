import type { Property } from "@/types/database";

/**
 * A property is eligible for the Hospitable-backed direct-booking flow only
 * when explicitly flagged — LHS-001 pilots this on a single property (Mesa)
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

export type DirectBookingWidgetConfig = {
  /** Hospitable's per-property widget embed (script/iframe markup), copied from
   * Hospitable dashboard → Direct Bookings → Website. Not configured until the
   * pilot's real Hospitable Direct account is set up. */
  widgetEmbedHtml: string | null;
  /** Hospitable-hosted checkout URL template, with `{propertyId}` and
   * `{returnUrl}` placeholders substituted at redirect time. */
  checkoutUrlTemplate: string | null;
};

export function getDirectBookingWidgetConfig(): DirectBookingWidgetConfig {
  return {
    widgetEmbedHtml:
      process.env.HOSPITABLE_DIRECT_WIDGET_EMBED_HTML?.trim() || null,
    checkoutUrlTemplate:
      process.env.HOSPITABLE_DIRECT_CHECKOUT_URL_TEMPLATE?.trim() || null,
  };
}

export function buildHospitableCheckoutUrl(
  template: string,
  params: { externalPropertyId: string; returnUrl: string }
): string {
  return template
    .replace("{propertyId}", encodeURIComponent(params.externalPropertyId))
    .replace("{returnUrl}", encodeURIComponent(params.returnUrl));
}
