import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/actions/platform-access-assignments.ts", "utf8");

describe("platform-access-assignments guards", () => {
  it("gates role-assignment management on the canonical privilege, not a hardcoded role name (AUTH-004)", () => {
    expect(source).toContain("PRIVILEGE_IDS.workspaceRolesRolesManage");
    for (const literal of ['"owner"', '"administrator"', '"workspace_owner"', "'owner'", "'administrator'", "'workspace_owner'"]) {
      expect(source).not.toContain(literal);
    }
  });

  it("re-checks permission inside previewRoleAssignmentAccessAction rather than trusting only client-side visibility", () => {
    expect(source).toContain("previewRoleAssignmentAccessAction");
    const previewBody = source.slice(source.indexOf("export async function previewRoleAssignmentAccessAction"));
    expect(previewBody).toContain("PA_ASSIGNMENT_PERMISSION_DENIED");
    expect(previewBody).toContain("evaluatePrivilege");
  });

  it("does not use the service-role/admin client anywhere in this increment", () => {
    expect(source).not.toContain("createAdminClient");
  });
});
