import { describe, expect, it, vi } from "vitest";
import { ProviderErrorCode } from "../../application/providers/provider-error";
import { RealtyApiClient } from "./client";

describe("RealtyApiClient", () => {
  it("authenticates autocomplete and details requests using documented endpoints", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    const client = new RealtyApiClient({ apiKey: "private-key", fetchImplementation });
    await client.autocomplete("650 S Main St, Fort Worth, TX", 5);
    await client.getDetailsById("12345", "listing-1");

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    const [searchUrl, searchInit] = fetchImplementation.mock.calls[0]!;
    expect(String(searchUrl)).toBe("https://realtor.realtyapi.io/autocomplete?input=650+S+Main+St%2C+Fort+Worth%2C+TX&limit=5");
    expect(searchInit?.headers).toEqual({ Accept: "application/json", "x-realtyapi-key": "private-key" });
    expect(String(fetchImplementation.mock.calls[1]![0])).toContain("/details/byid?property_id=12345&listing_id=listing-1");
  });

  it.each([
    [401, ProviderErrorCode.AuthenticationFailed],
    [402, ProviderErrorCode.AccessDenied],
    [404, ProviderErrorCode.NotFound],
    [429, ProviderErrorCode.RateLimited],
    [503, ProviderErrorCode.Unavailable],
  ] as const)("normalizes HTTP %s", async (status, code) => {
    const client = new RealtyApiClient({
      apiKey: "key",
      fetchImplementation: vi.fn(async () => new Response(JSON.stringify({ error: "provider message" }), { status })),
    });
    await expect(client.autocomplete("650 S Main St")).rejects.toMatchObject({ code, statusCode: status });
  });

  it("does not expose the API key through errors", () => {
    expect(() => new RealtyApiClient({ apiKey: " " })).toThrow("REALTY_API_KEY is required");
  });

  it("constructs the documented address-details request with URL encoding", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ message: "Success" }), { status: 200 });
    });
    const client = new RealtyApiClient({ apiKey: "private-key", fetchImplementation });
    await client.getDetailsByAddress("7825 Gaston Ave, Fort Worth, TX 76116");
    expect(String(fetchImplementation.mock.calls[0]![0]))
      .toBe("https://realtor.realtyapi.io/details/byaddress?address=7825+Gaston+Ave%2C+Fort+Worth%2C+TX+76116");
  });

  it("classifies malformed success responses", async () => {
    const client = new RealtyApiClient({
      apiKey: "key",
      fetchImplementation: vi.fn(async () => new Response("{", { status: 200 })),
    });
    await expect(client.getDetailsByAddress("7825 Gaston Ave"))
      .rejects.toMatchObject({ code: ProviderErrorCode.InvalidResponse });
  });

  it("classifies provider timeouts without exposing credentials", async () => {
    const client = new RealtyApiClient({
      apiKey: "secret-never-log",
      fetchImplementation: vi.fn(async () => { throw new DOMException("aborted", "AbortError"); }),
    });
    await expect(client.getDetailsByAddress("7825 Gaston Ave"))
      .rejects.toMatchObject({ code: ProviderErrorCode.TimedOut, retryable: true });
  });
});
