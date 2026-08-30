import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260829051000_fs008g_c8d_requirement_review_state.sql", "utf8");
const governance = readFileSync("supabase/migrations/20260829050000_fs008g_c8d_workspace_native_import.sql", "utf8");

describe("FS-008G C8-D controlled requirement review persistence", () => {
  it("permits the governed in-review state without rewriting existing rows", () => {
    expect(sql).toContain("'draft','in_review','approved','deprecated','archived'");
    expect(sql).not.toMatch(/update\s+public\.furnishing_room_requirements/i);
  });
  it("keeps the transition workspace-bound and draft-only", () => {
    expect(governance).toContain("workspace_id=workspace and scope='workspace' and lifecycle_status='draft'");
    expect(governance).toContain("CATALOG_APPROVAL_TARGET_SCOPE_INVALID");
  });
});
