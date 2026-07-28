import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260728010000_market_provider_diagnostics.sql", "utf8");

describe("MI-002 provider diagnostics persistence", () => {
  it("persists correlated runs, operations, and append-only events", () => {
    expect(migration).toContain("public.market_analysis_runs");
    expect(migration).toContain("public.market_provider_operations");
    expect(migration).toContain("public.market_provider_events");
    expect(migration).toContain("market_provider_events_append_only");
    expect(migration).toContain("unique(run_id,operation_type,attempt)");
    expect(migration).toContain("public.market_analysis_execution_timeline");
  });

  it("stores safe metadata and hashes without raw payload or credentials columns", () => {
    expect(migration).toContain("subject_address_hash");
    expect(migration).toContain("request_fingerprint");
    expect(migration).toContain("safe_request_metadata");
    expect(migration).toContain("response_hash");
    expect(migration).not.toMatch(/\b(api_key|authorization_header|raw_payload|response_body)\b/);
  });

  it("restricts engineering diagnostics to administrators", () => {
    expect(migration.match(/public\.is_admin\(\)/g)).toHaveLength(3);
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("prune_market_provider_diagnostics");
  });
});
