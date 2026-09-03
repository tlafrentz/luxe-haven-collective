import { describe, expect, it } from "vitest";
import { fetchProductPage } from "./safe-fetch";

function fakeResponse(init: { status: number; headers?: Record<string, string>; body?: string }): Response {
  const headers = new Headers(init.headers ?? {});
  return new Response(init.body ?? "", { status: init.status, headers });
}

describe("fetchProductPage", () => {
  const alwaysSafe = async () => ({ ok: true as const });
  const alwaysUnsafe = async () => ({ ok: false as const, reason: "private_network_address" as const });

  it("returns html on a successful fetch", async () => {
    const fetchImpl = async () => fakeResponse({ status: 200, headers: { "content-type": "text/html" }, body: "<html>ok</html>" });
    const result = await fetchProductPage("https://example.com/product", { fetchImpl, resolveAddress: alwaysSafe });
    expect(result).toEqual({ ok: true, html: "<html>ok</html>", finalUrl: "https://example.com/product" });
  });

  it("rejects when the resolved address is unsafe (DNS rebinding)", async () => {
    const fetchImpl = async () => fakeResponse({ status: 200 });
    const result = await fetchProductPage("https://example.com/product", { fetchImpl, resolveAddress: alwaysUnsafe });
    expect(result).toEqual({ ok: false, reason: "invalid_url" });
  });

  it("follows a redirect and revalidates the target", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls === 1) return fakeResponse({ status: 302, headers: { location: "https://example.com/final" } });
      return fakeResponse({ status: 200, headers: { "content-type": "text/html" }, body: "<html>final</html>" });
    };
    const result = await fetchProductPage("https://example.com/start", { fetchImpl, resolveAddress: alwaysSafe });
    expect(result).toEqual({ ok: true, html: "<html>final</html>", finalUrl: "https://example.com/final" });
    expect(calls).toBe(2);
  });

  it("rejects a redirect whose target is unsafe", async () => {
    let calls = 0;
    const resolveAddress = async () => {
      calls += 1;
      return calls === 1 ? { ok: true as const } : { ok: false as const, reason: "private_network_address" as const };
    };
    const fetchImpl = async () => fakeResponse({ status: 302, headers: { location: "https://internal.example.com/x" } });
    const result = await fetchProductPage("https://example.com/start", { fetchImpl, resolveAddress });
    expect(result).toEqual({ ok: false, reason: "unsafe_redirect_target" });
  });

  it("rejects a disallowed content type", async () => {
    const fetchImpl = async () => fakeResponse({ status: 200, headers: { "content-type": "application/json" }, body: "{}" });
    const result = await fetchProductPage("https://example.com/product", { fetchImpl, resolveAddress: alwaysSafe });
    expect(result).toEqual({ ok: false, reason: "unsupported_content_type" });
  });

  it("rejects a response over the size cap", async () => {
    const big = "a".repeat(3 * 1024 * 1024);
    const fetchImpl = async () => fakeResponse({ status: 200, headers: { "content-type": "text/html" }, body: big });
    const result = await fetchProductPage("https://example.com/product", { fetchImpl, resolveAddress: alwaysSafe });
    expect(result).toEqual({ ok: false, reason: "response_too_large" });
  });

  it("gives up after too many redirects", async () => {
    const fetchImpl = async () => fakeResponse({ status: 302, headers: { location: "https://example.com/next" } });
    const result = await fetchProductPage("https://example.com/start", { fetchImpl, resolveAddress: alwaysSafe });
    expect(result).toEqual({ ok: false, reason: "too_many_redirects" });
  });

  it("reports an http error for a non-2xx, non-redirect response", async () => {
    const fetchImpl = async () => fakeResponse({ status: 404 });
    const result = await fetchProductPage("https://example.com/product", { fetchImpl, resolveAddress: alwaysSafe });
    expect(result).toEqual({ ok: false, reason: "http_error" });
  });
});
