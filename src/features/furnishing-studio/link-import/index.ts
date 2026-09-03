import { validateProductLinkUrl, type LinkRejectionReason } from "./url-validation";
import { fetchProductPage } from "./safe-fetch";
import { extractMetadata, type ExtractedProduct } from "./extract-metadata";

export type LinkImportResult =
  | Readonly<{ status: "invalid_url"; reason: LinkRejectionReason }>
  | Readonly<{
      status: "extracted" | "manual";
      submittedUrl: string;
      canonicalUrl: string;
      extracted: ExtractedProduct | null;
    }>;

/**
 * Orchestrates URL validation, SSRF-safe fetch, and best-effort metadata
 * extraction. Extraction failure never throws and never clears the
 * submitted URL — it degrades to a manual-entry result (FS-UX-010 §6/§17).
 */
export async function importProductFromLink(rawUrl: string): Promise<LinkImportResult> {
  const validated = validateProductLinkUrl(rawUrl);
  if (!validated.ok) return { status: "invalid_url", reason: validated.reason };
  const fetched = await fetchProductPage(validated.canonicalUrl);
  if (!fetched.ok) {
    return { status: "manual", submittedUrl: rawUrl, canonicalUrl: validated.canonicalUrl, extracted: null };
  }
  let extracted: ExtractedProduct | null = null;
  try {
    extracted = extractMetadata(fetched.html, fetched.finalUrl);
  } catch {
    extracted = null;
  }
  return {
    status: extracted ? "extracted" : "manual",
    submittedUrl: rawUrl,
    canonicalUrl: validated.canonicalUrl,
    extracted,
  };
}

export * from "./url-validation";
export * from "./ssrf-guard";
export * from "./safe-fetch";
export * from "./extract-metadata";
export * from "./detect-retailer";
