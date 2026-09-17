import { afterEach, describe, expect, it } from "vitest";
import { buildHospitableCheckoutUrl, getDirectBookingWidgetConfig, isDirectBookingEnabled } from "./direct-booking";

describe("isDirectBookingEnabled", () => {
  it("is false for a property with no metadata", () => {
    expect(isDirectBookingEnabled({ metadata: null })).toBe(false);
  });

  it("is false when the flag is absent or falsy", () => {
    expect(isDirectBookingEnabled({ metadata: {} })).toBe(false);
    expect(isDirectBookingEnabled({ metadata: { direct_booking_enabled: false } })).toBe(false);
    expect(isDirectBookingEnabled({ metadata: { direct_booking_enabled: "true" } })).toBe(false);
  });

  it("is true only for an exact boolean true flag", () => {
    expect(isDirectBookingEnabled({ metadata: { direct_booking_enabled: true } })).toBe(true);
  });
});

describe("getDirectBookingWidgetConfig", () => {
  const originalEmbed = process.env.HOSPITABLE_DIRECT_WIDGET_EMBED_HTML;
  const originalTemplate = process.env.HOSPITABLE_DIRECT_CHECKOUT_URL_TEMPLATE;

  afterEach(() => {
    process.env.HOSPITABLE_DIRECT_WIDGET_EMBED_HTML = originalEmbed;
    process.env.HOSPITABLE_DIRECT_CHECKOUT_URL_TEMPLATE = originalTemplate;
  });

  it("returns null for unset configuration rather than a fabricated default", () => {
    delete process.env.HOSPITABLE_DIRECT_WIDGET_EMBED_HTML;
    delete process.env.HOSPITABLE_DIRECT_CHECKOUT_URL_TEMPLATE;
    expect(getDirectBookingWidgetConfig()).toEqual({ widgetEmbedHtml: null, checkoutUrlTemplate: null });
  });

  it("trims and surfaces configured values", () => {
    process.env.HOSPITABLE_DIRECT_WIDGET_EMBED_HTML = "  <div>widget</div>  ";
    expect(getDirectBookingWidgetConfig().widgetEmbedHtml).toBe("<div>widget</div>");
  });
});

describe("buildHospitableCheckoutUrl", () => {
  it("substitutes property id and return url placeholders", () => {
    const url = buildHospitableCheckoutUrl("https://book.hospitable.com/{propertyId}?return={returnUrl}", {
      externalPropertyId: "ext-1",
      returnUrl: "https://luxehavencollective.co/stays/booking/return?attempt=abc",
    });
    expect(url).toBe(
      "https://book.hospitable.com/ext-1?return=https%3A%2F%2Fluxehavencollective.co%2Fstays%2Fbooking%2Freturn%3Fattempt%3Dabc",
    );
  });
});
