import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, rpc, createBrowserClient, createAdmin, queues } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  createBrowserClient: vi.fn(),
  createAdmin: vi.fn(),
  queues: new Map<string, Array<{ data: unknown; error: unknown }>>(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: createBrowserClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdmin }));
vi.mock("@/features/guidebook-creation-assistant/providers", () => ({ OPENAI_EXTRACTION_MODEL: "gpt-5-nano" }));
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
    expect(fetch).not.toHaveBeenCalled();
  });

  it("claims once and records only safe priced Responses metadata", async () => {
    enqueue("production_verification_attempts", { data: null, error: null });
    enqueue("production_verification_runs", { data: { id: "run" }, error: null });
    enqueue("production_verification_instances", { data: { id: "instance", latest_attempt_number: 2 }, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "resp_safe", model: "gpt-5-nano", usage: { input_tokens: 20, output_tokens: 5 }, secret: "not-returned" }), { status: 200, headers: { "x-request-id": "req_safe" } })));
    const response = await POST(request("POST"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ ok: true, httpStatus: 200, openaiRequestId: "req_safe", model: "gpt-5-nano", inputTokens: 20, outputTokens: 5, calculatedCostUsd: 0.000003 }));
    expect(JSON.stringify(body)).not.toContain("not-returned");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "OpenAI-Project": "project-id", "x-client-request-id": expect.any(String) }) }));
    const requestBody = JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body));
    expect(requestBody).toMatchObject({ model: "gpt-5-nano", store: false, max_output_tokens: 40 });
  });

});

function enqueue(table: string, value: { data: unknown; error: unknown }) {
  const values = queues.get(table) ?? [];
  values.push(value);
  queues.set(table, values);
}

function adminClient() {
  return { from(table: string) { return chain(table); } };
}

function chain(table: string) {
  const value = () => queues.get(table)?.shift() ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit", "contains", "or"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => value());
  builder.insert = vi.fn(async () => ({ error: null }));
  builder.update = vi.fn(() => builder);
  builder.then = (resolve: (result: { error: null }) => unknown) => Promise.resolve(resolve({ error: null }));
  return builder;
}

function request(method: "GET" | "POST") {
  return new Request("https://luxe.test/api/internal/guidebook-creation/openai-verification", { method, headers: { authorization: "Bearer admin-session" } }) as never;
}
