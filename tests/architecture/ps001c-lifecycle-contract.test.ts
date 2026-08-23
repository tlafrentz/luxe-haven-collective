import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { clientWorkspaceNavigation, lifecycleActionContracts, matchesNavigationRoute, platformRouteDefinitions } from "@/platform/experience";

describe("PS-001C lifecycle stabilization contract", () => {
  it("owns decision, execute, and learn routes under the correct lifecycle stage", () => {
    const decide = clientWorkspaceNavigation.find((item) => item.id === "decide")!;
    const understand = clientWorkspaceNavigation.find((item) => item.id === "understand")!;
    expect(decide.activeMatch && matchesNavigationRoute("/dashboard/portfolio/decisions/decision-1", decide.activeMatch)).toBe(true);
    expect(understand.activeMatch && matchesNavigationRoute("/dashboard/portfolio/decisions/decision-1", understand.activeMatch)).toBe(false);
    for (const path of ["/dashboard/execute/plans/[planId]", "/dashboard/execute/actions/[id]", "/dashboard/learn/outcomes/[reviewId]", "/dashboard/learn/lessons/[lessonId]"])
      expect(platformRouteDefinitions.some((route) => route.pathPattern === path)).toBe(true);
  });

  it("keeps the customer Action Center at five views without Recurring", () => {
    const inventory = lifecycleActionContracts.filter((item) => item.route === "/dashboard/execute" && item.interactionType === "filter");
    expect(inventory.map((item) => item.label)).toEqual(["Overview", "My Work", "All Actions", "Action Plans", "Completed"]);
    expect(inventory.some((item) => item.label === "Recurring")).toBe(false);
  });

  it("has no unresolved lifecycle action inventory entries", () => {
    expect(new Set(lifecycleActionContracts.map((item) => item.id)).size).toBe(lifecycleActionContracts.length);
    for (const item of lifecycleActionContracts) {
      expect(item.canonicalTarget).not.toMatch(/unknown|todo|no-op/i);
      expect(item.authorization.length).toBeGreaterThan(0);
      expect(item.verificationReference).toMatch(/^PS-001C-/);
    }
  });

  it("does not represent scenario interpretations as canonical learning", () => {
    const page = readFileSync(resolve("src/app/(dashboard)/dashboard/investments/opportunities/[id]/learning/page.tsx"), "utf8");
    expect(page).toContain("Interpretation candidates");
    expect(page).toContain("not validated organizational learning");
    expect(page).not.toContain("Structured lessons");
  });

  it("creates a decision-derived plan only after an authoritative not-found result", () => {
    const source = readFileSync(resolve("src/app/actions/execute-plans.ts"), "utf8");
    expect(source).toContain('if(existing.code!=="PLAN_NOT_FOUND")return existing');
    expect(source).toContain("plan-${canonicalDecisionId}");
  });
});
