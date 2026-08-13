import { describe, expect, it, vi } from "vitest";
import { resolveAdminAccess, resolvedProfileRole } from "./admin";

describe("canonical admin authorization", () => {
  it("uses the database authorization result even when the profile projection is missing", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
    await expect(resolveAdminAccess(client)).resolves.toEqual({ authorized: true, available: true });
    expect(resolvedProfileRole(null, true)).toBe("admin");
  });

  it("does not elevate a profile when the database denies access", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) };
    await expect(resolveAdminAccess(client)).resolves.toEqual({ authorized: false, available: true });
    expect(resolvedProfileRole("owner", false)).toBe("owner");
  });

  it("fails closed when the canonical authorization check is unavailable", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "unavailable" } }) };
    await expect(resolveAdminAccess(client)).resolves.toEqual({ authorized: false, available: false });
  });
});
