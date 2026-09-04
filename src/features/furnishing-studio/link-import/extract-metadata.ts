export type ExtractionSource = "retailer_integration" | "json_ld" | "open_graph" | "html_heuristic";
export type ExtractionConfidence = "high" | "medium" | "low";

export type ExtractedProduct = Readonly<{
  source: ExtractionSource;
  confidence: ExtractionConfidence;
  name?: string;
  imageUrl?: string;
  priceAmount?: string;
  priceCurrency?: string;
  brand?: string;
  sku?: string;
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
}>;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

function mapSchemaAvailability(value: unknown): ExtractedProduct["availability"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("instock") || text.includes("in_stock")) return "in_stock";
  if (text.includes("limitedavailability") || text.includes("low_stock")) return "low_stock";
  if (text.includes("outofstock") || text.includes("out_of_stock") || text.includes("sold")) return "out_of_stock";
  return "unknown";
}

function findProductNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];
    if (types.some((value) => value.toLowerCase() === "product")) return record;
    if (record["@graph"]) return findProductNode(record["@graph"]);
  }
  return null;
}

/**
 * schema.org `image` may be a plain URL string, an array of them, a single
 * `ImageObject` ({url|contentUrl}), or an array of those — real retailer
 * pages (e.g. IKEA) commonly use the ImageObject array form.
 */
function extractImageUrl(image: unknown): string | undefined {
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return extractImageUrl(image[0]);
  if (image && typeof image === "object") {
    const record = image as Record<string, unknown>;
    const url = record.url ?? record.contentUrl;
    if (typeof url === "string") return url;
  }
  return undefined;
}

/** Tier 2: JSON-LD `Product` schema. Pure JSON parsing, no script execution. */
export function extractJsonLd(html: string): ExtractedProduct | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const product = findProductNode(parsed);
    if (!product) continue;
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    const offerRecord = (offer && typeof offer === "object" ? offer : {}) as Record<string, unknown>;
    const brand = product.brand;
    const brandName =
      typeof brand === "string" ? brand : brand && typeof brand === "object" ? String((brand as Record<string, unknown>).name ?? "") : undefined;
    return {
      source: "json_ld",
      confidence: "high",
      name: typeof product.name === "string" ? decodeEntities(product.name) : undefined,
      imageUrl: extractImageUrl(product.image),
      priceAmount: offerRecord.price !== undefined ? String(offerRecord.price) : undefined,
      priceCurrency: typeof offerRecord.priceCurrency === "string" ? offerRecord.priceCurrency : undefined,
      brand: brandName || undefined,
      sku: typeof product.sku === "string" ? product.sku : undefined,
      availability: offerRecord.availability ? mapSchemaAvailability(offerRecord.availability) : "unknown",
    };
  }
  return null;
}

function metaContent(html: string, attr: "property" | "name", key: string): string | undefined {
  const pattern = new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
  const reversed = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`, "i");
  const match = html.match(pattern) ?? html.match(reversed);
  return match ? decodeEntities(match[1]) : undefined;
}

/** Tier 3: Open Graph / product meta tags. */
export function extractOpenGraph(html: string): ExtractedProduct | null {
  const name = metaContent(html, "property", "og:title");
  const image = metaContent(html, "property", "og:image");
  const priceAmount = metaContent(html, "property", "product:price:amount") ?? metaContent(html, "property", "og:price:amount");
  const priceCurrency = metaContent(html, "property", "product:price:currency") ?? metaContent(html, "property", "og:price:currency");
  const brand = metaContent(html, "property", "product:brand") ?? metaContent(html, "property", "og:brand");
  const availability = metaContent(html, "property", "product:availability") ?? metaContent(html, "property", "og:availability");
  if (!name && !image && !priceAmount) return null;
  return {
    source: "open_graph",
    confidence: "medium",
    name,
    imageUrl: image,
    priceAmount,
    priceCurrency,
    brand,
    availability: availability ? mapSchemaAvailability(availability) : "unknown",
  };
}

/** Tier 4: generic HTML heuristics, tagged low confidence. */
export function extractHtmlHeuristics(html: string): ExtractedProduct | null {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const priceMatch = html.match(/\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/);
  const name = titleMatch ? decodeEntities(titleMatch[1].trim()) : undefined;
  if (!name && !imgMatch && !priceMatch) return null;
  return {
    source: "html_heuristic",
    confidence: "low",
    name,
    imageUrl: imgMatch?.[1],
    priceAmount: priceMatch?.[1]?.replace(/,/g, ""),
    priceCurrency: priceMatch ? "USD" : undefined,
    availability: "unknown",
  };
}

/**
 * Retailer-integration extractors are a typed extension seam only in this
 * phase — the registry is empty and this tier always falls through.
 */
export type RetailerExtractor = (html: string, url: string) => ExtractedProduct | null;
export const retailerExtractors: readonly RetailerExtractor[] = [];

export function extractMetadata(html: string, url: string): ExtractedProduct | null {
  for (const extractor of retailerExtractors) {
    const result = extractor(html, url);
    if (result) return result;
  }
  return extractJsonLd(html) ?? extractOpenGraph(html) ?? extractHtmlHeuristics(html);
}
