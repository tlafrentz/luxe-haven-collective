import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(marketing)/page.tsx", "utf8");
const header = readFileSync("src/components/shared/site-header.tsx", "utf8");
const footer = readFileSync("src/components/shared/site-footer.tsx", "utf8");

describe("approved homepage contract", () => {
  it("keeps the approved six-part narrative and exact core copy", () => {
    for (const copy of [
      "Hospitality Performance Management",
      "See clearly.",
      "Decide confidently.",
      "Perform better.",
      "One connected system.",
      "Four ways to move forward.",
      "From insight to measurable improvement.",
      "Designed around the realities of hospitality.",
      "Practical intelligence for better hospitality decisions.",
      "What could perform better next?",
    ]) expect(page).toContain(copy);
  });

  it("contains only approved public product routes and no commerce bypass", () => {
    for (const route of ["/hpm", "/guidebook-studio", "/furnishing", "/investment-intelligence"])
      expect(page).toContain(`href: \"${route}\"`);
    expect(page).not.toMatch(/\/checkout|\/purchase|nightly_rate|getPublishedProperties|controlled|verification/i);
  });

  it("excludes prohibited metrics and the retired homepage sections", () => {
    expect(page).not.toMatch(/Guests Hosted|Average Review|Revenue Influenced|Properties Supported|goals =|featured properties|nightly price/i);
  });

  it("publishes the approved navigation and separates notary from platform", () => {
    for (const label of ["HPM", "Guidebook", "Furnishing", "Investment Intelligence", "Resources", "About"])
      expect(header).toContain(`\"${label}\"`);
    expect(header).not.toContain("Pricing");
    expect(header).not.toContain("Notary");
    expect(footer).toContain("Texas Notary Services");
    expect(footer).toContain('href="/notary"');
  });

  it("tracks every intentional homepage action without sensitive payloads", () => {
    expect(page).toContain("hero_explore_hpm");
    expect(page).toContain("hero_find_best_fit");
    expect(page).toContain("operator_our_approach");
    expect(page).toContain("final_start_conversation");
    expect(page).toContain("final_explore_platform");
    expect(page).not.toMatch(/customerId|propertyId|email|payment/i);
  });
});
