import { existsSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import { importProductFromLink } from "@/features/furnishing-studio/link-import";

const productPageHtml = `<html><head>
<script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "Brass Arc Floor Lamp",
  image: "https://cdn.example.com/lamp.jpg",
  brand: { name: "Example Co" },
  sku: "LAMP-42",
  offers: { price: "129.00", priceCurrency: "USD", availability: "https://schema.org/InStock" },
})}</script>
</head><body></body></html>`;

function mockFetchOnce(status: number, body: string, contentType = "text/html") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status, headers: { "content-type": contentType } })),
  );
}

describe("FS-UX-010 add-by-link vertical slice (no DB, no real network)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("goes from a pasted URL to fully extracted product data", async () => {
    mockFetchOnce(200, productPageHtml);
    const result = await importProductFromLink("https://www.example.com/products/brass-arc-floor-lamp?utm_source=x");
    expect(result.status).toBe("extracted");
    if (result.status !== "extracted") throw new Error("expected extracted");
    expect(result.canonicalUrl).toBe("https://www.example.com/products/brass-arc-floor-lamp");
    expect(result.extracted?.name).toBe("Brass Arc Floor Lamp");
    expect(result.extracted?.source).toBe("json_ld");
  });

  it("degrades to manual entry (never dead-ending) when the retailer page can't be fetched, and keeps the submitted URL", async () => {
    mockFetchOnce(500, "");
    const result = await importProductFromLink("https://www.example.com/products/unreachable");
    expect(result.status).toBe("manual");
    if (result.status === "invalid_url") throw new Error("expected manual, not invalid_url");
    expect(result.submittedUrl).toBe("https://www.example.com/products/unreachable");
    expect(result.canonicalUrl).toBeTruthy();
  });

  it("degrades to manual entry when the page has no extractable metadata", async () => {
    mockFetchOnce(200, "<html><body>nothing here</body></html>");
    const result = await importProductFromLink("https://www.example.com/products/empty");
    expect(result.status).toBe("manual");
  });

  it("rejects an unsafe URL before ever touching the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await importProductFromLink("https://127.0.0.1/product");
    expect(result.status).toBe("invalid_url");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("has deployed route source for every add-by-link and library surface", () => {
    for (const path of [
      "src/app/(admin)/admin/furnishing/products/page.tsx",
      "src/app/(admin)/admin/furnishing/products/new/page.tsx",
      "src/app/(admin)/admin/furnishing/products/[productId]/page.tsx",
      "src/app/(admin)/admin/furnishing/products/[productId]/edit/page.tsx",
      "src/components/furnishing/product-library.tsx",
      "src/components/furnishing/add-product-flow.tsx",
      "src/components/furnishing/library-product-detail.tsx",
      "src/app/actions/furnishing-library.ts",
    ])
      expect(existsSync(path), path).toBe(true);
  });
});
