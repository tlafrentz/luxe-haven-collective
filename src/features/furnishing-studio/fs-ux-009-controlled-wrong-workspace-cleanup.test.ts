import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
const sql=readFileSync("supabase/migrations/20260902012000_fs_ux_009_controlled_wrong_workspace_cleanup.sql","utf8").toLowerCase();
describe("FS-UX-009 controlled wrong-workspace cleanup",()=>{
 it("separates the nonmember owner from platform Admin authority",()=>{expect(sql).toContain("wrong_owner.id=w.profile_id");expect(sql).toContain("wrong_owner.role=''owner''");expect(sql).toContain("fs008g-c8-wrong-%@example.invalid");expect(sql).toContain("prior_predicate constant text:='w.profile_id=p_admin_id'")});
 it("requires active canonical identity and service-only cleanup",()=>{expect(sql).toContain("join auth.users wrong_identity");expect(sql).toContain("wrong_identity.deleted_at is null");expect(sql).toContain("wrong_identity.banned_until is null");expect(sql).toContain("from public,anon,authenticated");expect(sql).toContain("to service_role")});
});
