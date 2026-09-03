import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync("supabase/migrations/20260902014000_fs_ux_009_selection_allocation_replay.sql","utf8");
describe("FS-UX-009 selection allocation replay",()=>{
 it("recomputes an identical replay against the accepted revision",()=>{expect(sql).toContain("selection_id,prior.expected_revision,requested,delivery,correlation");expect(sql).toContain("return prior.after_state||jsonb_build_object('status','replayed')")});
 it("binds replay to the authoritative selection command context",()=>{expect(sql).toContain("context.target_id=selection_id::text");expect(sql).toContain("context.command_type='project.selection.quantity'");expect(sql).toContain("prior.actor_id<>a")});
 it("keeps new writes atomic and governed",()=>{expect(sql).toContain("on conflict on constraint furnishing_selection_delivery_allo_selection_id_property_id_key");expect(sql).toContain("OWNER_SELECTION_STALE_OR_INELIGIBLE");expect(sql).not.toMatch(/grant\s+(insert|update|delete)/i)});
});
