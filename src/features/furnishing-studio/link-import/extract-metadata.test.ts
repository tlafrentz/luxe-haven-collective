import { describe, expect, it } from "vitest";
import { extractJsonLd, extractOpenGraph, extractHtmlHeuristics, extractMetadata } from "./extract-metadata";

const jsonLdHtml = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "Arched Oak Coffee Table",
  image: "https://cdn.example.com/table.jpg",
  brand: { name: "Example Co" },
  sku: "ABC-123",
  offers: { price: "189.00", priceCurrency: "USD", availability: "https://schema.org/InStock" },
})}</script></head><body></body></html>`;

const graphHtml = `<html><head>
<meta property="og:title" content="Brass Arc Floor Lamp">
<meta property="og:image" content="https://cdn.example.com/lamp.jpg">
<meta property="product:price:amount" content="129.00">
<meta property="product:price:currency" content="USD">
</head></html>`;

const bareHtml = `<html><head><title>Performance Fabric Sofa - Example Store</title></head><body><img src="https://cdn.example.com/sofa.jpg">$899.00</body></html>`;

// Real-world shape seen on retailer sites (e.g. IKEA): `image` is an array
// of schema.org ImageObject records using `contentUrl`, not plain strings.
const imageObjectHtml = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "Soft Toy Shark",
  image: [
    { "@type": "ImageObject", contentUrl: "https://cdn.example.com/shark-1.jpg", height: "2000", width: "2000" },
    { "@type": "ImageObject", contentUrl: "https://cdn.example.com/shark-2.jpg" },
  ],
  offers: { price: "24.99", priceCurrency: "USD" },
})}</script></head><body></body></html>`;

describe("extractJsonLd", () => {
  it("extracts a Product node with nested brand and offer", () => {
    const result = extractJsonLd(jsonLdHtml);
    expect(result?.name).toBe("Arched Oak Coffee Table");
    expect(result?.brand).toBe("Example Co");
    expect(result?.priceAmount).toBe("189.00");
    expect(result?.priceCurrency).toBe("USD");
    expect(result?.availability).toBe("in_stock");
    expect(result?.source).toBe("json_ld");
  });

  it("returns null for pages with no JSON-LD", () => {
    expect(extractJsonLd("<html></html>")).toBeNull();
  });

  it("extracts the image from an array of schema.org ImageObject records (real-world retailer shape)", () => {
    const result = extractJsonLd(imageObjectHtml);
    expect(result?.imageUrl).toBe("https://cdn.example.com/shark-1.jpg");
  });

  it("does not throw on malformed JSON-LD", () => {
    expect(extractJsonLd('<script type="application/ld+json">{not json</script>')).toBeNull();
  });
});

describe("extractOpenGraph", () => {
  it("extracts og: and product: meta tags", () => {
    const result = extractOpenGraph(graphHtml);
    expect(result?.name).toBe("Brass Arc Floor Lamp");
    expect(result?.priceAmount).toBe("129.00");
    expect(result?.source).toBe("open_graph");
  });
  it("returns null with no relevant tags", () => {
    expect(extractOpenGraph("<html></html>")).toBeNull();
  });
});

describe("extractHtmlHeuristics", () => {
  it("falls back to title/image/price with low confidence", () => {
    const result = extractHtmlHeuristics(bareHtml);
    expect(result?.name).toContain("Performance Fabric Sofa");
    expect(result?.priceAmount).toBe("899.00");
    expect(result?.confidence).toBe("low");
  });
});

describe("extractMetadata precedence", () => {
  it("prefers JSON-LD over Open Graph over heuristics", () => {
    expect(extractMetadata(jsonLdHtml, "https://example.com")?.source).toBe("json_ld");
    expect(extractMetadata(graphHtml, "https://example.com")?.source).toBe("open_graph");
    expect(extractMetadata(bareHtml, "https://example.com")?.source).toBe("html_heuristic");
  });
  it("returns null when nothing can be extracted", () => {
    expect(extractMetadata("<html><body>no product here</body></html>", "https://example.com")).toBeNull();
  });
});
