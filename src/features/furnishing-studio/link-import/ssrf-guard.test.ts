import { describe, expect, it } from "vitest";
import { resolveSafeAddress } from "./ssrf-guard";

describe("resolveSafeAddress", () => {
  it("rejects a hostname that resolves to a loopback address (DNS rebinding)", async () => {
    const lookup = async () => [{ address: "127.0.0.1", family: 4 }];
    const result = await resolveSafeAddress("looks-public.example.com", lookup);
    expect(result).toEqual({ ok: false, reason: "private_network_address" });
  });

  it("rejects a hostname that resolves to a private RFC1918 address", async () => {
    const lookup = async () => [{ address: "10.0.0.5", family: 4 }];
    expect(await resolveSafeAddress("internal.example.com", lookup)).toEqual({
      ok: false,
      reason: "private_network_address",
    });
  });

  it("rejects the cloud metadata service address", async () => {
    const lookup = async () => [{ address: "169.254.169.254", family: 4 }];
    expect(await resolveSafeAddress("metadata.example.com", lookup)).toEqual({
      ok: false,
      reason: "private_network_address",
    });
  });

  it("accepts a hostname that resolves only to public addresses", async () => {
    const lookup = async () => [{ address: "93.184.216.34", family: 4 }];
    expect(await resolveSafeAddress("example.com", lookup)).toEqual({ ok: true });
  });

  it("rejects when any resolved address (of several) is private", async () => {
    const lookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    expect((await resolveSafeAddress("mixed.example.com", lookup)).ok).toBe(false);
  });

  it("fails closed when DNS resolution fails", async () => {
    const lookup = async () => {
      throw new Error("ENOTFOUND");
    };
    expect(await resolveSafeAddress("nowhere.example.com", lookup)).toEqual({
      ok: false,
      reason: "resolution_failed",
    });
  });

  it("rejects an already-private hostname literal without a DNS call", async () => {
    let called = false;
    const lookup = async () => {
      called = true;
      return [{ address: "93.184.216.34", family: 4 }];
    };
    const result = await resolveSafeAddress("127.0.0.1", lookup);
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });
});
