import { promises as dns } from "node:dns";
import { isPrivateOrLocalHostLiteral } from "./url-validation";

export type SafeAddressResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "resolution_failed" | "private_network_address" }>;

type LookupFn = (
  hostname: string,
  options: { all: true; verbatim?: boolean },
) => Promise<{ address: string; family: number }[]>;

function isPrivateIpAddress(address: string, family: number): boolean {
  if (family === 4) return isPrivateOrLocalHostLiteral(address);
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) — check the embedded v4 address too.
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped && isPrivateOrLocalHostLiteral(mapped[1])) return true;
  return false;
}

/**
 * Resolves a hostname and rejects loopback/link-local/private-network/
 * metadata-service/reserved addresses. This defends against DNS rebinding:
 * a hostname that looks public in url-validation.ts can still resolve to a
 * private address at fetch time.
 */
export async function resolveSafeAddress(
  hostname: string,
  lookupImpl: LookupFn = dns.lookup as unknown as LookupFn,
): Promise<SafeAddressResult> {
  if (isPrivateOrLocalHostLiteral(hostname)) {
    return { ok: false, reason: "private_network_address" };
  }
  let records: { address: string; family: number }[];
  try {
    records = await lookupImpl(hostname, { all: true });
  } catch {
    return { ok: false, reason: "resolution_failed" };
  }
  if (!records.length) return { ok: false, reason: "resolution_failed" };
  if (records.some((record) => isPrivateIpAddress(record.address, record.family))) {
    return { ok: false, reason: "private_network_address" };
  }
  return { ok: true };
}
