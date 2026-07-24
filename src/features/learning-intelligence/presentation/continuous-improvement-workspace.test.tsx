import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContinuousImprovementWorkspaceView } from "./continuous-improvement-workspace";

describe("Continuous Improvement presentation", () => {
  it("renders the intentional empty state without a decision-success rate", () => {
    const html = renderToStaticMarkup(<ContinuousImprovementWorkspaceView state={{
      status: "no-outcomes",
      workspace: { portfolio: { id: "p", name: "Portfolio", version: 1, lifecycleStage: "formation" }, plannedCount: 2, measuringCount: 0, limitations: [] },
    }} />);
    expect(html).toContain("Learning begins with measured decisions.");
    expect(html).toContain("Planned Outcomes");
    expect(html).not.toContain("success rate");
  });
  it("announces loading-independent measurement progress distinctly", () => {
    const html = renderToStaticMarkup(<ContinuousImprovementWorkspaceView state={{
      status: "measurement-in-progress",
      workspace: { portfolio: { id: "p", name: "Portfolio", version: 1, lifecycleStage: "operating" }, plannedCount: 1, measuringCount: 3, limitations: [] },
    }} />);
    expect(html).toContain("Measurement is in progress.");
    expect(html).toContain("3 Outcomes are collecting evidence");
  });
});
