import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, rpc, supabaseClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  supabaseClient: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: supabaseClient }));
import { GET } from "./route";

describe("server-only AI Gateway diagnostic", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.AI_GATEWAY_API_KEY = "not-returned";
    getUser.mockResolvedValue({ data: { user: { id: "admin" } } });
    rpc.mockResolvedValue({ data: true });
    supabaseClient.mockReturnValue({ auth: { getUser }, rpc });
  });
  afterEach(() => vi.restoreAllMocks());

  it("reports only presence to an authenticated administrator", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ keyPresent: true });
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("rejects non-administrators without reporting presence", async () => {
    rpc.mockResolvedValue({ data: false });
    const response = await GET(request("GET"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      code: "GATEWAY_DIAGNOSTIC_UNAUTHORIZED",
    });
  });
});

function request(method: "GET") {
  return new Request("https://luxe.test/api/internal/gateway-diagnostic", {
    method,
    headers: { authorization: "Bearer admin-session" },
  }) as never;
}
