import { canonicalizeRetailerUrl } from "../catalog";

export type LinkRejectionReason =
  | "malformed"
  | "unsupported_scheme"
  | "insecure_scheme"
  | "private_network_host";

export type LinkValidationResult =
  | Readonly<{ ok: true; canonicalUrl: string; hostname: string }>
  | Readonly<{ ok: false; reason: LinkRejectionReason }>;

const DEV_HOST_ALLOWLIST = new Set(["localhost", "127.0.0.1"]);

// Variant-defining query params that canonicalizeRetailerUrl intentionally
// leaves alone (color/size/sku-style selectors) are preserved automatically
// since it only strips a known tracking-param allowlist.

function isDevEnvironment() {
  return process.env.NODE_ENV !== "production";
}

/** Syntactic pre-check on a hostname literal, before any DNS resolution. */
export function isPrivateOrLocalHostLiteral(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "0.0.0.0") return true;

  // IPv4 literal (dotted-decimal only; reject decimal/hex/octal obfuscation
  // by requiring exactly four dot-separated 0-255 segments).
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if ([a, b, Number(ipv4[3]), Number(ipv4[4])].some((part) => part > 255)) return true; // malformed-looking, treat as unsafe
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata (169.254.169.254)
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 0) return true;
    return false;
  }
  // A bare all-digit or hex host (e.g. "2130706433", "0x7f000001") is a
  // disguised IPv4 literal — reject rather than trying to decode it.
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) return true;

  // IPv6 literal (as it appears inside a URL, host may include brackets
  // stripped already by URL parsing; hostname from URL never has brackets).
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true; // link-local / ULA
    return false;
  }
  return false;
}

const SUPPORTED_SHORT_LINK_HOSTS = new Set(["amzn.to", "bit.ly", "a.co"]);

export function isSupportedShortLinkHost(hostname: string): boolean {
  return SUPPORTED_SHORT_LINK_HOSTS.has(hostname.toLowerCase());
}

/**
 * Validates and normalizes a user-submitted retailer product link per
 * FS-UX-010 §6.2. Does not perform any network I/O — that's ssrf-guard.ts /
 * safe-fetch.ts's job (DNS-rebinding defense requires resolving at fetch
 * time, not here).
 */
export function validateProductLinkUrl(raw: string): LinkValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "malformed" };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!/^https?:$/.test(url.protocol)) {
    return { ok: false, reason: "unsupported_scheme" };
  }
  if (url.protocol !== "https:") {
    const devAllowed = isDevEnvironment() && DEV_HOST_ALLOWLIST.has(url.hostname.toLowerCase());
    if (!devAllowed) return { ok: false, reason: "insecure_scheme" };
  }
  if (isPrivateOrLocalHostLiteral(url.hostname)) {
    return { ok: false, reason: "private_network_host" };
  }
  let canonical: string;
  try {
    canonical = canonicalizeRetailerUrl(trimmed);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const canonicalUrl = new URL(canonical);
  canonicalUrl.hostname = canonicalUrl.hostname.toLowerCase();
  return { ok: true, canonicalUrl: canonicalUrl.toString(), hostname: canonicalUrl.hostname };
}
