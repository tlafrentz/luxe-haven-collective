import { describe, expect, it } from "vitest";
import {
  canTransitionLibraryStatus,
  contentPayload,
  extractPlaceholders,
  validateStructuredContent,
  validateMediaBytes,
} from "./domain";

describe("canonical guidebook library", () => {
  it("extracts and validates approved variables", () => {
    expect(
      extractPlaceholders("Welcome {{property_name}} at {{check_in_time}}."),
    ).toEqual(["property_name", "check_in_time"]);
    expect(
      contentPayload("Welcome {{property_name}}.", ["property_name"]),
    ).toMatchObject({ requiredVariables: ["property_name"] });
  });
  it("rejects HTML and unknown placeholders", () => {
    expect(() =>
      validateStructuredContent("<script>alert(1)</script>"),
    ).toThrow("unsanitized_html_not_allowed");
    expect(() => validateStructuredContent("{{secret_code}}")).toThrow(
      "unsupported_variables:secret_code",
    );
  });
  it("protects publication lifecycle", () => {
    expect(canTransitionLibraryStatus("draft", "under_review")).toBe(true);
    expect(canTransitionLibraryStatus("published", "draft")).toBe(false);
    expect(canTransitionLibraryStatus("published", "deprecated")).toBe(true);
  });
  it("checks file signatures and rejects active payload markers", () => {
    expect(() =>
      validateMediaBytes("application/pdf", Buffer.from("%PDF-1.7 safe")),
    ).not.toThrow();
    expect(() =>
      validateMediaBytes("application/pdf", Buffer.from("not a pdf")),
    ).toThrow("media_signature_invalid");
    expect(() =>
      validateMediaBytes("application/pdf", Buffer.from("%PDF-1.7 /Launch")),
    ).toThrow("media_security_scan_rejected");
  });
});
