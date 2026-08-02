import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const route = ["page.tsx","executive-page.tsx"].map(file=>readFileSync(join(root, "src/app/(dashboard)/dashboard/understand",file), "utf8")).join("\n");
const productionComponents = [
  "executive-command-center.tsx", "executive-command-header.tsx", "executive-brief.tsx", "executive-attention-card.tsx",
  "executive-attention-list.tsx", "executive-scope-controls.tsx", "hpm-pillar-grid.tsx", "portfolio-health-overview.tsx",
  "portfolio-snapshot-grid.tsx", "recent-changes-feed.tsx", "revenue-risk-summary.tsx", "executive-lifecycle-summary.tsx",
  "executive-data-quality.tsx",
].map((file) => readFileSync(join(root, "src/features/executive-intelligence/components", file), "utf8")).join("\n");

describe("Executive dashboard direct Platform architecture", () => {
  it("queries the Executive view once without a legacy query or mapper", () => {
    expect(route.match(/getExecutiveIntelligenceView\(/g)).toHaveLength(1);
    expect(route).not.toContain("getExecutiveDashboardProjection");
    expect(route).not.toContain("getExecutive" + "Intelligence(");
    expect(route).not.toContain("mapExecutiveView" + "ToLegacyReport");
  });

  it("keeps legacy reports, fixtures, and execution compatibility records out of the component tree", () => {
    expect(productionComponents).not.toContain("ExecutiveIntelligence" + "Report");
    expect(productionComponents).not.toContain("ACTION_CENTER_RECORDS");
    expect(productionComponents).not.toContain("execution-engine");
    expect(productionComponents).not.toContain("HpmPerformance" + "Report");
  });
});
