import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("FS-008A P2.4B Admin activation surface", () => {
  it("requires Admin route protection and exposes safe control states", () => { const page = readFileSync("src/app/(admin)/admin/furnishing/activation/page.tsx", "utf8"); expect(page).toContain("requireRole([\"admin\"])"); expect(page).toContain("Safe ceiling"); });
  it("has accessible reason, pending, and status behavior", () => { const view = readFileSync("src/app/(admin)/admin/furnishing/activation/activation-controls.tsx", "utf8"); expect(view).toContain("aria-describedby"); expect(view).toContain('role="status"'); expect(view).toContain("disabled={pending}"); });
  it("hands commands to a server-only action with confirmation and concurrency fields", () => { const view = readFileSync("src/app/(admin)/admin/furnishing/activation/activation-controls.tsx", "utf8"); expect(view).toContain("submitFurnishingActivationCommand"); expect(view).toContain("expectedVersion"); expect(view).toContain("window.confirm"); });
  it("renders every remaining control family", () => { const view = readFileSync("src/app/(admin)/admin/furnishing/activation/activation-controls.tsx", "utf8"); for (const value of ["workspace-kill-switch", "workspace-state", "cohort-grant", "cohort-expiration", "cohort-revoke", "capability-state"]) expect(view).toContain(value); });
});
