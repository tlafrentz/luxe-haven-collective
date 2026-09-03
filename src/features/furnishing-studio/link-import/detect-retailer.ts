export type RetailerCandidate = Readonly<{ id: string; domain: string | null }>;

/** Matches a canonical product URL's hostname against known retailer domains. */
export function detectRetailer(canonicalUrl: string, retailers: readonly RetailerCandidate[]): string | null {
  let hostname: string;
  try {
    hostname = new URL(canonicalUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  const match = retailers.find(
    (retailer) => retailer.domain && (hostname === retailer.domain.toLowerCase() || hostname.endsWith(`.${retailer.domain.toLowerCase()}`)),
  );
  return match?.id ?? null;
}
