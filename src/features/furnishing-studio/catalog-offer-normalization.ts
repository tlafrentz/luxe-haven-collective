export type RetailerHostnameTarget = {
  retailerId: string;
  hostname: string;
  provenance: "retailer_domain" | "allowlisted_alias";
};

export type NormalizedOfferTarget =
  | { status: "not_applicable"; productUrl: null; retailerId: null; hostname: null; provenance: null }
  | { status: "resolved"; productUrl: string; retailerId: string; hostname: string; provenance: RetailerHostnameTarget["provenance"] }
  | { status: "needs_review"; productUrl: string | null; retailerId: null; hostname: string | null; provenance: null };

export const canonicalOfferHostname = (value: string) =>
  value.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

export function normalizeOfferTarget(
  rawUrl: string,
  targets: readonly RetailerHostnameTarget[],
  canonicalize: (url: string) => string,
): NormalizedOfferTarget {
  if (!rawUrl.trim())
    return { status: "not_applicable", productUrl: null, retailerId: null, hostname: null, provenance: null };
  let productUrl: string;
  let hostname: string;
  try {
    productUrl = canonicalize(rawUrl);
    hostname = canonicalOfferHostname(new URL(productUrl).hostname);
  } catch {
    return { status: "needs_review", productUrl: null, retailerId: null, hostname: null, provenance: null };
  }
  const matches = targets.filter((target) => {
    const allowed = canonicalOfferHostname(target.hostname);
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });
  const retailerIds = [...new Set(matches.map((target) => target.retailerId))];
  if (retailerIds.length !== 1)
    return { status: "needs_review", productUrl, retailerId: null, hostname, provenance: null };
  const selected = matches.find((target) => target.retailerId === retailerIds[0])!;
  return { status: "resolved", productUrl, retailerId: selected.retailerId, hostname, provenance: selected.provenance };
}
