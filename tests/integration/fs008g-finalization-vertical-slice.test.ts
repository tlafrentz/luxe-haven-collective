import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const runbook = JSON.parse(read("docs/runbooks/fs008g-finalization.json")) as {
  steps: Array<{
    id: string;
    url: string;
    persona: string;
    control: string;
    expected: string;
    reconciliation: string;
    stop: string;
    cleanup: string;
  }>;
  externalEffects: Record<string, boolean>;
};
const actions = [
  "src/app/actions/furnishing-catalog.ts",
  "src/app/actions/furnishing-packages.ts",
  "src/app/actions/furnishing-project-workspace.ts",
  "src/app/actions/fs008d-governance.ts",
  "src/app/actions/furnishing-procurement.ts",
]
  .map(read)
  .join("\n");

describe("FS-008G activation-through-cleanup vertical slice", () => {
  it("maps every governed lifecycle stage to an exact persona route and reconciliation", () => {
    for (const id of [
      "activation",
      "catalog-import",
      "catalog-reconciliation",
      "package-create",
      "package-review",
      "owner-project",
      "snapshot",
      "procurement-baseline",
      "budget",
      "batch-order",
      "receiving",
      "owner-projection",
      "kill-switch-cleanup",
    ]) {
      const step = runbook.steps.find((x) => x.id === id);
      expect(step, id).toBeTruthy();
      if (id === "kill-switch-cleanup") expect(step?.url).toBe("service-only");
      else expect(step?.url).toMatch(/^https:\/\/luxehavencollective\.co\//);
      for (const field of [
        "persona",
        "control",
        "expected",
        "reconciliation",
        "stop",
        "cleanup",
      ] as const)
        expect(step?.[field]).toBeTruthy();
    }
  });
  it("has deployed route source for every runbook surface", () => {
    for (const path of [
      "src/app/(admin)/admin/furnishing/activation/page.tsx",
      "src/app/(admin)/admin/furnishing/products/import/page.tsx",
      "src/app/(admin)/admin/furnishing/packages/new/page.tsx",
      "src/app/(admin)/admin/furnishing/packages/[packageId]/page.tsx",
      "src/app/(dashboard)/dashboard/furnishing/projects/[projectId]/page.tsx",
      "src/app/(admin)/admin/furnishing/projects/[projectId]/procurement/page.tsx",
      "src/app/(dashboard)/dashboard/furnishing/projects/[projectId]/procurement/page.tsx",
    ])
      expect(existsSync(path), path).toBe(true);
  });
  it("uses the shared context boundary and contains no empty/random authority fallback", () => {
    expect(actions).toContain("resolveFurnishingCommandContext");
    for (const unsafe of [
      "idempotencyKey) || crypto.randomUUID()",
      "expectedVersion: 1",
      "correlationId: `fs008d-",
      "idempotencyKey: `fs008d-",
    ])
      expect(actions).not.toContain(unsafe);
  });
  it("suppresses every real downstream effect and exposes typed accessible refresh", () => {
    expect(
      Object.values(runbook.externalEffects).every((x) => x === false),
    ).toBe(true);
    for (const path of [
      "src/app/(admin)/admin/furnishing/error.tsx",
      "src/app/(dashboard)/dashboard/furnishing/error.tsx",
    ]) {
      const view = read(path);
      expect(view).toContain('role="alert"');
      expect(view).toContain("router.refresh()");
    }
  });
});
