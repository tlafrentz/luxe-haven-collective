import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LearningIntelligenceDashboardView } from "./learning-intelligence-dashboard";

describe("Learning Intelligence dashboard presentation", () => {
  it("renders an intentional no-Outcomes state and workspace link", () => {
    const html = renderToStaticMarkup(<LearningIntelligenceDashboardView state={{ status: "no-outcomes", portfolio: { id: "p", name: "Portfolio", version: 1, lifecycleStage: "formation" }, plannedCount: 1, measuringCount: 0, workspaceDestination: "/dashboard/learning/workspace?portfolio=p", limitations: [] }} />);
    expect(html).toContain("Learning begins with measured decisions.");
    expect(html).toContain("Open Continuous Improvement");
    expect(html).not.toContain("Learning health");
  });
  it("announces measurement progress without fabricating an executive conclusion", () => {
    const html = renderToStaticMarkup(<LearningIntelligenceDashboardView state={{ status: "measurement-in-progress", portfolio: { id: "p", name: "Portfolio", version: 1, lifecycleStage: "operating" }, plannedCount: 0, measuringCount: 3, workspaceDestination: "/dashboard/learning/workspace?portfolio=p", limitations: [] }} />);
    expect(html).toContain("3 Outcomes are collecting evidence");
    expect(html).not.toContain("Recommendation Reliability");
  });
});
