import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const { getUser, rpc, createBrowserClient, createAdmin, queues, verifyNanoGeneration, tables, eqCalls, inserts } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  createBrowserClient: vi.fn(),
  createAdmin: vi.fn(),
  queues: new Map<string, Array<{ data: unknown; error: unknown }>>(),
  verifyNanoGeneration: vi.fn(),
  tables: [] as string[],
  eqCalls: [] as Array<[string, unknown]>,
  inserts: [] as unknown[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: createBrowserClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdmin }));
vi.mock("@/features/guidebook-creation-assistant/providers", () => ({
  OPENAI_EXTRACTION_MODEL: "gpt-5-nano",
  OPENAI_GENERATION_MODEL: "gpt-5-mini",
  CreationProviderError: class CreationProviderError extends Error {},
  DirectOpenAiCreationProvider: class DirectOpenAiCreationProvider { verifyNanoGeneration = verifyNanoGeneration; },
}));
import { OPENAI_NANO_SMOKE_IDEMPOTENCY_HASH, OPENAI_NANO_SMOKE_OPERATION } from "./policy";
import { GET, POST } from "./route";

describe("server-only OpenAI runtime verification", () => {
  beforeEach(() => {
    process.env.OPENAI_RUNTIME_VERIFICATION_ENABLED = "true";
    process.env.OPENAI_RUNTIME_VERIFICATION_KILL_SWITCH = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.OPENAI_API_KEY = "never-returned";
    process.env.OPENAI_PROJECT_ID = "project-id";
    getUser.mockResolvedValue({ data: { user: { id: "admin-id" } } });
    rpc.mockResolvedValue({ data: true });
    createBrowserClient.mockReturnValue({ auth: { getUser }, rpc });
    queues.clear();
    tables.length = 0;
    eqCalls.length = 0;
    inserts.length = 0;
    verifyNanoGeneration.mockReset();
    createAdmin.mockImplementation(() => adminClient());
    enqueue("controlled_verification_identities", { data: { id: "identity" }, error: null });
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ["OPENAI_RUNTIME_VERIFICATION_ENABLED", "OPENAI_RUNTIME_VERIFICATION_KILL_SWITCH", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "OPENAI_API_KEY", "OPENAI_PROJECT_ID"]) delete process.env[key];
  });

  it("defaults to presence-only output and redacts credential material", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ credentialPresent: true, provider: "openai", configuredExtractionModel: "gpt-5-nano", runtime: "nodejs" }));
    expect(JSON.stringify(body)).not.toMatch(/never-returned|authorization|length|prefix|suffix|hash|environment/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires administrator, verification capability, and kill-switch permission", async () => {
    rpc.mockResolvedValueOnce({ data: false });
    expect((await GET(request("GET"))).status).toBe(401);
    rpc.mockResolvedValue({ data: true });
    queues.set("controlled_verification_identities", []);
    enqueue("controlled_verification_identities", { data: null, error: null });
    expect((await GET(request("GET"))).status).toBe(403);
    process.env.OPENAI_RUNTIME_VERIFICATION_KILL_SWITCH = "true";
    expect((await GET(request("GET"))).status).toBe(503);
  });

  it("rejects replay without making another Responses request", async () => {
    enqueue("production_verification_attempts", { data: { id: "prior", status: "succeeded" }, error: null });
    const response = await POST(request("POST"));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(expect.objectContaining({ code: "OPENAI_VERIFICATION_REPLAY_REJECTED" }));
    expect(verifyNanoGeneration).not.toHaveBeenCalled();
  });

  it("keeps catalog history immutable and gives the smoke test a distinct namespace", () => {
    const catalogHash = createHash("sha256").update("guidebook:openai:approved-model-catalog:v1").digest("hex");
    expect(OPENAI_NANO_SMOKE_OPERATION).toBe("openai_nano_generation_smoke_v1");
    expect(OPENAI_NANO_SMOKE_IDEMPOTENCY_HASH).not.toBe(catalogHash);
  });

  it("allows one smoke execution even when catalog discovery already exists", async () => {
    enqueue("production_verification_attempts", { data: null, error: null });
    enqueue("production_verification_runs", { data: { id: "run" }, error: null });
    enqueue("production_verification_instances", { data: { id: "instance" }, error: null });
    enqueue("production_verification_attempts", { data: { attempt_number: 7 }, error: null });
    verifyNanoGeneration.mockResolvedValue({ httpStatus: 200, openaiRequestId: "req_safe", model: "gpt-5-nano", usage: { input_tokens: 20, output_tokens: 5, reasoning_tokens: 3, calculated_cost_usd: 0.000003, latency_ms: 125 } });
    const response = await POST(request("POST"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ ok: true, httpStatus: 200, openaiRequestId: "req_safe", model: "gpt-5-nano", inputTokens: 20, outputTokens: 5, reasoningTokens: 3, calculatedCostUsd: 0.000003, latencyMs: 125 }));
    expect(verifyNanoGeneration).toHaveBeenCalledOnce();
    expect(inserts).toContainEqual(expect.objectContaining({ executor_code: "VERIFY_OPENAI_NANO_GENERATION_SMOKE_V1", idempotency_key_hash: OPENAI_NANO_SMOKE_IDEMPOTENCY_HASH, attempt_number: 8 }));
    expect(eqCalls).not.toContainEqual(["id", "catalog-attempt"]);
    expect(tables).not.toEqual(expect.arrayContaining(["guidebook_creation_jobs", "guidebook_creation_sources", "guidebooks", "properties"]));
  });

});

function enqueue(table: string, value: { data: unknown; error: unknown }) {
  const values = queues.get(table) ?? [];
  values.push(value);
  queues.set(table, values);
}

function adminClient() {
  return { from(table: string) { tables.push(table); return chain(table); } };
}

function chain(table: string) {
  const value = () => queues.get(table)?.shift() ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "in", "order", "limit", "contains", "or"]) builder[method] = vi.fn(() => builder);
  builder.eq = vi.fn((key: string, value: unknown) => { eqCalls.push([key, value]); return builder; });
  builder.maybeSingle = vi.fn(async () => value());
  builder.insert = vi.fn(async (value: unknown) => { inserts.push(value); return { error: null }; });
  builder.update = vi.fn(() => builder);
  builder.then = (resolve: (result: { error: null }) => unknown) => Promise.resolve(resolve({ error: null }));
  return builder;
}

function request(method: "GET" | "POST") {
  return new Request("https://luxe.test/api/internal/guidebook-creation/openai-verification", { method, headers: { authorization: "Bearer admin-session" } }) as never;
}
