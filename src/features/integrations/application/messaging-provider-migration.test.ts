import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const migration=readFileSync("supabase/migrations/20260726190000_messaging_provider_adapter.sql","utf8");
describe("COM-004A persistence migration",()=>{
 it("persists synchronization modes, cursors, review work, and append-only audit",()=>{expect(migration).toContain("provider_cursor text");expect(migration).toContain("synchronization_mode");expect(migration).toContain("messaging_provider_review_queue");expect(migration).toContain("messaging_provider_activity");expect(migration).toContain("messaging_provider_activity_append_only");});
 it("enforces workspace-scoped operator visibility",()=>{expect(migration).toContain("active_workspace_role(workspace_id)");expect(migration).toContain("enable row level security");});
});
