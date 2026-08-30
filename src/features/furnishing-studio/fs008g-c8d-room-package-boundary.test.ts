import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const action = readFileSync("src/app/actions/furnishing-packages.ts", "utf8");
const view = readFileSync("src/components/furnishing/room-package-composition-control.tsx", "utf8");

describe("FS-008G C8-D room-package boundary", () => {
  it("maps the human required choice to the canonical essential enum on the server", () => {
    expect(view).toContain('<option value="required">required</option>');
    expect(action).toContain('priorityInput === "required" ? "essential"');
    expect(action).toContain('required: priority === "essential"');
  });
  it("rejects invalid priority and mismatched replay before insertion", () => {
    expect(action).toContain("ROOM_PACKAGE_PRIORITY_INVALID");
    expect(action).toContain("ROOM_PACKAGE_COMPOSITION_REPLAY_CONFLICT");
    expect(action.indexOf("ROOM_PACKAGE_PRIORITY_INVALID")).toBeLessThan(action.indexOf('.from("furnishing_room_package_items").insert'));
  });
  it("requires approved same-workspace requirements and governed preferred products", () => {
    for (const contract of ['.eq("workspace_id", command.workspaceId)', '.eq("scope", "workspace")', '.eq("lifecycle_status", "approved")', '.eq("furnishing_product_offer_assignments.role", "preferred")'])
      expect(action).toContain(contract);
  });
  it("fails submission closed when required composition is incomplete", () => {
    expect(action).toContain("ROOM_PACKAGE_REQUIRED_COMPOSITION_INCOMPLETE");
  });
});
