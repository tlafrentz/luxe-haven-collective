import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("FS-008A P2.4B Admin activation surface", () => {
  it("requires Admin route protection and exposes safe control states", () => { const page = readFileSync("src/app/(admin)/admin/furnishing/activation/page.tsx", "utf8"); expect(page).toContain("requireRole([\"admin\"])"); expect(page).toContain("Safe ceiling"); });
  it("has accessible reason, pending, and status behavior", () => { const view = readFileSync("src/app/(admin)/admin/furnishing/activation/activation-controls.tsx", "utf8"); expect(view).toContain("aria-describedby"); expect(view).toContain('role="status"'); expect(view).toContain("disabled={pending}"); });
});
