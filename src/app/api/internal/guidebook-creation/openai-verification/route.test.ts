import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const { getUser, rpc, createBrowserClient, createAdmin } = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), createBrowserClient: vi.fn(), createAdmin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: createBrowserClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdmin }));
vi.mock("@/features/guidebook-creation-assistant/providers", () => ({ OPENAI_EXTRACTION_MODEL: "gpt-5-nano" }));
import { OPENAI_NANO_SMOKE_IDEMPOTENCY_HASH, OPENAI_NANO_SMOKE_OPERATION, OPENAI_NANO_SMOKE_V1_IDEMPOTENCY_HASH, OPENAI_NANO_SMOKE_V2_IDEMPOTENCY_HASH } from "./policy";
import { GET, POST } from "./route";

describe("closed OpenAI runtime verification", () => {
  beforeEach(() => {
    process.env.OPENAI_RUNTIME_VERIFICATION_ENABLED = "true";
    process.env.OPENAI_RUNTIME_VERIFICATION_KILL_SWITCH = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.OPENAI_API_KEY = "never-returned";
    getUser.mockResolvedValue({ data: { user: { id: "admin-id" } } });
    rpc.mockResolvedValue({ data: true });
    createBrowserClient.mockReturnValue({ auth: { getUser }, rpc });
    createAdmin.mockReturnValue({ from: () => identityQuery() });
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ["OPENAI_RUNTIME_VERIFICATION_ENABLED", "OPENAI_RUNTIME_VERIFICATION_KILL_SWITCH", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "OPENAI_API_KEY"]) delete process.env[key];
  });

  it("retains presence-only Admin-gated inspection", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ credentialPresent: true, provider: "openai", configuredExtractionModel: "gpt-5-nano" }));
  });

  it("permanently closes POST without database or upstream contact", async () => {
    const response = await POST(request("POST"));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual(expect.objectContaining({ code: "OPENAI_VERIFICATION_OPERATION_CLOSED" }));
    expect(createAdmin).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves distinct immutable identities for all smoke attempts", () => {
    const catalogHash = createHash("sha256").update("guidebook:openai:approved-model-catalog:v1").digest("hex");
    expect(OPENAI_NANO_SMOKE_OPERATION).toBe("openai_nano_generation_smoke_v3");
    expect(new Set([catalogHash, OPENAI_NANO_SMOKE_V1_IDEMPOTENCY_HASH, OPENAI_NANO_SMOKE_V2_IDEMPOTENCY_HASH, OPENAI_NANO_SMOKE_IDEMPOTENCY_HASH]).size).toBe(4);
  });
});

function identityQuery() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "contains", "or"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: { id: "identity" }, error: null }));
  return builder;
}

function request(method: "GET" | "POST") {
  return new Request("https://luxe.test/api/internal/guidebook-creation/openai-verification", { method, headers: { authorization: "Bearer admin-session" } }) as never;
}
