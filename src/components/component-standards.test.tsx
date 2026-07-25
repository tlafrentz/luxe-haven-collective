import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { componentTokens } from "./foundation";
import { Badge, Button, Progress, TextField } from "./primitives";
import { EvidenceList, RecommendationCard } from "./product";

describe("Component Standards", () => {
  it("publishes the canonical foundation scales", () => {
    expect(Object.values(componentTokens.spacing)).toEqual(["8px", "16px", "24px", "32px", "48px", "64px"]);
    expect(componentTokens.touchTarget).toBe("44px");
    expect(Object.keys(componentTokens.typography)).toEqual(["display", "h1", "h2", "h3", "body", "caption", "metadata"]);
  });

  it("builds accessibility into Phase 1 primitives", () => {
    const markup = renderToStaticMarkup(<><Button loading>Save changes</Button><TextField label="Business name" error="Enter a business name." required /><Progress value={92} label="Guidebook completion" /><Badge tone="warning">Attention</Badge></>);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain("Attention");
  });

  it("requires recommendations and evidence to retain interpretation and source context", () => {
    const evidence = <EvidenceList items={[{ id: "one", statement: "Weekend occupancy remains above target.", source: "Revenue Intelligence", observedAt: "Jul 24" }]} />;
    const markup = renderToStaticMarkup(<RecommendationCard title="Pricing strategy" recommendation="Continue the current weekend strategy." rationale="Demand remains strong and no displacement risk is visible." evidence={evidence} />);
    expect(markup).toContain("Continue the current weekend strategy.");
    expect(markup).toContain("Demand remains strong");
    expect(markup).toContain("Revenue Intelligence");
  });
});
