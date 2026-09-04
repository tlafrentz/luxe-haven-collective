import { describe, expect, it } from "vitest";
import { summarizeRolePrivileges, type RolePrivilegeRow } from "./role-privilege-summary";

const row = (roleId: string, module: string, action: string, sensitivity: RolePrivilegeRow["sensitivity"]): RolePrivilegeRow => ({ roleId, module, action, sensitivity });

describe("summarizeRolePrivileges", () => {
  it("groups privileges by role then by module", () => {
    const result = summarizeRolePrivileges([
      row("manager", "guidebooks", "view", "standard"),
      row("manager", "guidebooks", "publish", "critical"),
      row("manager", "financials", "view_summary", "standard"),
    ]);
    expect([...result.get("manager")!.keys()]).toEqual(["guidebooks", "financials"]);
    expect(result.get("manager")!.get("guidebooks")).toContain("view");
    expect(result.get("manager")!.get("financials")).toEqual(["view_summary"]);
  });

  it("sorts each module's actions standard -> elevated -> critical", () => {
    const result = summarizeRolePrivileges([
      row("manager", "guidebooks", "publish", "critical"),
      row("manager", "guidebooks", "edit", "elevated"),
      row("manager", "guidebooks", "view", "standard"),
    ]);
    expect(result.get("manager")!.get("guidebooks")).toEqual(["view", "edit", "publish"]);
  });

  it("dedupes an action that appears more than once for the same role/module", () => {
    const result = summarizeRolePrivileges([
      row("manager", "guidebooks", "view", "standard"),
      row("manager", "guidebooks", "view", "standard"),
    ]);
    expect(result.get("manager")!.get("guidebooks")).toEqual(["view"]);
  });

  it("omits a module entirely for a role with zero privileges in it", () => {
    const result = summarizeRolePrivileges([row("viewer", "guidebooks", "view", "standard")]);
    expect(result.get("viewer")!.has("financials")).toBe(false);
  });

  it("returns an empty map for no rows", () => {
    expect(summarizeRolePrivileges([]).size).toBe(0);
  });
});
