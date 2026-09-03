import { describe, expect, it, vi } from "vitest";
import { validateProductLinkUrl, isPrivateOrLocalHostLiteral, isSupportedShortLinkHost } from "./url-validation";

describe("validateProductLinkUrl", () => {
  it("accepts a well-formed https retailer link and lowercases the host", () => {
    const result = validateProductLinkUrl("https://WWW.Amazon.com/dp/B0EXAMPLE?utm_source=x&color=blue");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.hostname).toBe("www.amazon.com");
    expect(result.canonicalUrl).not.toContain("utm_source");
    expect(result.canonicalUrl).toContain("color=blue");
  });

  it("rejects malformed URLs", () => {
    expect(validateProductLinkUrl("not a url").ok).toBe(false);
    expect(validateProductLinkUrl("").ok).toBe(false);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "ftp://example.com/a"])(
    "rejects unsupported scheme %s",
    (url) => {
      const result = validateProductLinkUrl(url);
      expect(result.ok).toBe(false);
    },
  );

  it("rejects plain http in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(validateProductLinkUrl("http://example.com/product").ok).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([
    "http://127.0.0.1/product",
    "https://127.0.0.1/product",
    "https://10.0.0.5/product",
    "https://172.16.0.1/product",
    "https://192.168.1.1/product",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/product",
    "https://foo.local/product",
    "https://2130706433/product",
    "https://0x7f000001/product",
  ])("rejects private/local-network target %s", (url) => {
    expect(validateProductLinkUrl(url).ok).toBe(false);
  });

  it("removes URL fragments", () => {
    const result = validateProductLinkUrl("https://example.com/product#section");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.canonicalUrl).not.toContain("#");
  });
});

describe("isPrivateOrLocalHostLiteral", () => {
  it("flags loopback, RFC1918, and link-local ranges", () => {
    expect(isPrivateOrLocalHostLiteral("127.0.0.1")).toBe(true);
    expect(isPrivateOrLocalHostLiteral("10.1.2.3")).toBe(true);
    expect(isPrivateOrLocalHostLiteral("172.20.0.1")).toBe(true);
    expect(isPrivateOrLocalHostLiteral("192.168.0.1")).toBe(true);
    expect(isPrivateOrLocalHostLiteral("169.254.1.1")).toBe(true);
  });
  it("does not flag ordinary public hosts", () => {
    expect(isPrivateOrLocalHostLiteral("www.amazon.com")).toBe(false);
    expect(isPrivateOrLocalHostLiteral("8.8.8.8")).toBe(false);
  });
});

describe("isSupportedShortLinkHost", () => {
  it("recognizes the supported allowlist", () => {
    expect(isSupportedShortLinkHost("amzn.to")).toBe(true);
    expect(isSupportedShortLinkHost("evil.example")).toBe(false);
  });
});
