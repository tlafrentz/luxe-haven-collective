import { validateProductLinkUrl } from "./url-validation";
import { resolveSafeAddress, type SafeAddressResult } from "./ssrf-guard";

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

export type SafeFetchResult =
  | Readonly<{ ok: true; html: string; finalUrl: string }>
  | Readonly<{
      ok: false;
      reason:
        | "invalid_url"
        | "unsafe_address"
        | "too_many_redirects"
        | "unsafe_redirect_target"
        | "timeout"
        | "unsupported_content_type"
        | "response_too_large"
        | "network_error"
        | "http_error";
    }>;

async function revalidatedHop(
  url: string,
  resolveAddress: (hostname: string) => Promise<SafeAddressResult>,
): Promise<
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "invalid_url" | "unsafe_address" }>
> {
  const validated = validateProductLinkUrl(url);
  if (!validated.ok) return { ok: false, reason: "invalid_url" };
  const safe = await resolveAddress(validated.hostname);
  if (!safe.ok) return { ok: false, reason: "unsafe_address" };
  return { ok: true };
}

export type SafeFetchDependencies = Readonly<{
  fetchImpl?: typeof fetch;
  resolveAddress?: (hostname: string) => Promise<SafeAddressResult>;
}>;

/**
 * Fetches a product page with SSRF protections: every redirect hop is
 * re-validated (URL rules + DNS-resolved address) before being followed,
 * per FS-UX-010 §12 "revalidate redirects per hop". Bounded timeout,
 * redirect count, response size, and content-type. Accepts injectable
 * dependencies so tests never touch the real network/DNS.
 */
export async function fetchProductPage(startUrl: string, deps: SafeFetchDependencies = {}): Promise<SafeFetchResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const resolveAddress = deps.resolveAddress ?? resolveSafeAddress;
  let currentUrl = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const revalidated = await revalidatedHop(currentUrl, resolveAddress);
    if (!revalidated.ok) {
      return { ok: false, reason: hop === 0 ? "invalid_url" : "unsafe_redirect_target" };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/html,application/xhtml+xml" },
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") return { ok: false, reason: "timeout" };
      return { ok: false, reason: "network_error" };
    }
    clearTimeout(timeout);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, reason: "http_error" };
      if (hop === MAX_REDIRECTS) return { ok: false, reason: "too_many_redirects" };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) return { ok: false, reason: "http_error" };
    const contentType = response.headers.get("content-type") ?? "";
    if (!ALLOWED_CONTENT_TYPES.some((allowed) => contentType.includes(allowed))) {
      return { ok: false, reason: "unsupported_content_type" };
    }
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, reason: "network_error" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "response_too_large" };
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
    return { ok: true, html, finalUrl: currentUrl };
  }
  return { ok: false, reason: "too_many_redirects" };
}
