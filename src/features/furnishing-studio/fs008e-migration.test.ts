import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rpc = readFileSync("supabase/migrations/20260825052000_fs008e_procurement_rpcs.sql", "utf8");
const normalized = readFileSync("supabase/migrations/20260825051000_fs008e_normalized_snapshot_items.sql", "utf8");
const actions = readFileSync("src/app/actions/furnishing-procurement.ts", "utf8");
const snapshotAction = readFileSync("src/app/actions/furnishing-procurement-snapshot.ts", "utf8");

describe("FS-008E governed procurement boundary", () => {
  it("constructs both authoritative source types from the small baseline command", () => {
    expect(rpc).toContain("p_input->>'source_kind'");
    expect(rpc).toContain("p_input->>'source_id'");
    expect(rpc).toContain("p_input->>'expected_source_version'");
    expect(rpc).toContain("k not in('furnishing_plan','catalog_snapshot')");
    expect(rpc).toContain("PROCUREMENT_SNAPSHOT_NOT_NORMALIZED");
    expect(rpc).not.toContain("PROCUREMENT_BASELINE_COMMAND_REQUIRES_TYPED_SOURCE");
  });

  it("defines seven authenticated transactional commands with audit evidence", () => {
    const definitions = rpc.match(/create or replace function public\.(?:create_or_replay_procurement_baseline|approve_furnishing_procurement_plan|create_or_replay_procurement_batch|record_external_retailer_order|transition_furnishing_procurement_order|record_furnishing_procurement_receipt|reconcile_furnishing_procurement_budget)\(p_input jsonb\)/g) ?? [];
    expect(definitions).toHaveLength(7);
    expect(rpc).toContain("auth.uid()");
    expect(rpc).toContain("public.is_admin()");
    expect(rpc).toContain("furnishing_procurement_events");
    expect(rpc).toContain("grant execute on function");
    expect(rpc).toContain("drop function if exists public.create_or_replay_snapshot_procurement_baseline");
  });

  it("normalizes and freezes snapshot items", () => {
    expect(normalized).toContain("SNAPSHOT_ITEM_ROOM_INVALID");
    expect(normalized).toContain("SNAPSHOT_ITEM_VALUE_INVALID");
    expect(normalized).toContain("fs008d_snapshot_item_immutable");
    expect(normalized).toContain("source_lineage");
  });

  it("leaves no direct production procurement inserts, updates, or deletes", () => {
    expect(actions).not.toMatch(/\.from\("furnishing_(?:procurement|purchase|project_procurement)[^"]*"\)\.(?:insert|update|delete)\(/);
    expect(actions).toContain('.rpc("create_or_replay_procurement_baseline"');
    expect(actions).toContain('.rpc("create_or_replay_procurement_batch"');
    expect(actions).toContain('.rpc("record_external_retailer_order"');
    expect(actions).toContain('.rpc("record_furnishing_procurement_receipt"');
    expect(actions).toContain('.rpc("reconcile_furnishing_procurement_budget"');
    expect(snapshotAction).toContain('source_kind: "catalog_snapshot"');
  });
});
