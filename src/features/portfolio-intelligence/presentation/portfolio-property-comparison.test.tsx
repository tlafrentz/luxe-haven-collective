import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { overviewProjectionFixture, overviewPropertyFixture } from "../application/overview/overview.test";
import { buildPortfolioPropertyComparison, comparisonCapabilitiesForRole } from "../application/property-comparison";
import { PortfolioPropertyComparisonError, PortfolioPropertyComparisonSkeleton, PortfolioPropertyComparisonView } from "./portfolio-property-comparison";
describe("Property comparison presentation", () => {
  it("renders controls, roles, metric rankings, semantic table, mobile cards, contribution, momentum, and evidence", () => {
    const current = overviewProjectionFixture([overviewPropertyFixture("a",150),overviewPropertyFixture("b",50)]);
    const prior = overviewProjectionFixture([overviewPropertyFixture("a",100),overviewPropertyFixture("b",60)]);
    const html = renderToStaticMarkup(<PortfolioPropertyComparisonView comparison={buildPortfolioPropertyComparison({projection:current,comparison:prior,capabilities:comparisonCapabilitiesForRole("owner")})} />);
    expect(html).toContain("<h1");
    expect(html).toContain('aria-label="Property analysis controls"');
    expect(html).not.toContain('name="period"');
    expect(html).not.toContain('name="comparison"');
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("Decision-specific comparisons");
    expect(html).toContain("Contribution analysis");
    expect(html).toContain("Momentum &amp; efficiency");
    expect(html).toContain("Evidence quality");
    expect(html).not.toMatch(/Best Property|Worst Property/);
  });
  it("preserves canonical context when drilling into a property",()=>{
    const model=buildPortfolioPropertyComparison({projection:overviewProjectionFixture([overviewPropertyFixture("a",100)]),capabilities:comparisonCapabilitiesForRole("owner")});
    const html=renderToStaticMarkup(<PortfolioPropertyComparisonView comparison={model} contextSearchParams={{workspace:"w",scope:"portfolio",period:"ytd",comparison:"previous-year",basis:"actual"}}/>);
    expect(html).toContain("workspace=w");expect(html).toContain("period=ytd");expect(html).toContain("comparison=previous-year");expect(html).toContain("basis=actual");expect(html).toContain("property=a");
  });
  it("omits financial columns for restricted roles", () => {
    const model = buildPortfolioPropertyComparison({projection:overviewProjectionFixture([overviewPropertyFixture("a",100)]),capabilities:comparisonCapabilitiesForRole("contributor")});
    const html = renderToStaticMarkup(<PortfolioPropertyComparisonView comparison={model} />);
    expect(html).not.toContain("NOI / Margin");
  });
  it("renders assigned, one-property, detail, degraded, loading, empty, and error states", () => {
    const base = overviewProjectionFixture([overviewPropertyFixture("a",100,{freshness:"stale"})],{freshness:"stale"});
    const scope = {...base.scope,authorization:{type:"assigned-properties" as const,role:"viewer" as const}};
    const model = buildPortfolioPropertyComparison({projection:{...base,scope,identity:{...base.identity,scope}},capabilities:comparisonCapabilitiesForRole("viewer"),selectedPropertyId:"a"});
    const html = renderToStaticMarkup(<PortfolioPropertyComparisonView comparison={model} />);
    expect(html).toContain("Your Assigned Portfolio");
    expect(html).toContain("Only one property is in scope");
    expect(html).toContain("Comparison is partially degraded");
    expect(html).toContain('id="property-detail"');
    expect(renderToStaticMarkup(<PortfolioPropertyComparisonSkeleton />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<PortfolioPropertyComparisonError />)).toContain('role="alert"');
    const empty = buildPortfolioPropertyComparison({projection:overviewProjectionFixture([]),capabilities:comparisonCapabilitiesForRole("owner")});
    expect(renderToStaticMarkup(<PortfolioPropertyComparisonView comparison={empty} />)).toContain("No properties are available for comparison");
  });
});
