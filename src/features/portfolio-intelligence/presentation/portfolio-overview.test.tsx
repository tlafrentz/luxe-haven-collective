import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPortfolioOverview } from "../application/overview";
import { overviewProjectionFixture, overviewPropertyFixture } from "../application/overview/overview.test";
import { PortfolioOverviewEmpty, PortfolioOverviewError, PortfolioOverviewSkeleton, PortfolioOverviewView } from "./portfolio-overview";

describe("Portfolio Overview presentation", () => {
  it("renders semantic condition, metrics, controls, contribution, attention, composition, execution, and evidence", () => {
    const current = overviewProjectionFixture([overviewPropertyFixture("a", 150), overviewPropertyFixture("b", 50, { freshness: "stale" })], { freshness: "stale" });
    const prior = overviewProjectionFixture([overviewPropertyFixture("a", 100), overviewPropertyFixture("b", 60)]);
    const html = renderToStaticMarkup(<PortfolioOverviewView overview={buildPortfolioOverview({ projection: current, comparison: prior, historyLengthDays: 90 })} />);
    expect(html).toContain("<h1");
    expect(html).toContain("Portfolio Overview");
    expect(html).toContain("Portfolio condition");
    expect(html).toContain("Gross Revenue");
    expect(html).toContain("What changed");
    expect(html).toContain("Property contribution");
    expect(html).toContain("Portfolio attention");
    expect(html).toContain("Composition snapshot");
    expect(html).toContain("Active decisions &amp; actions");
    expect(html).toContain("Evidence &amp; freshness");
    expect(html).toContain('aria-label="Portfolio scope and period controls"');
    expect(html).not.toContain("$0</p>");
  });
  it("renders assigned and single-property disclosures", () => {
    const base = overviewProjectionFixture([overviewPropertyFixture("a", 100)]);
    const scope = { ...base.scope, authorization: { type: "assigned-properties" as const, role: "viewer" as const } };
    const html = renderToStaticMarkup(<PortfolioOverviewView overview={buildPortfolioOverview({ projection: { ...base, scope, identity: { ...base.identity, scope } } })} />);
    expect(html).toContain("Your Assigned Portfolio");
    expect(html).toContain("only properties assigned to your role");
  });
  it("renders intentional empty, loading, and error states accessibly", () => {
    expect(renderToStaticMarkup(<PortfolioOverviewEmpty />)).toContain("No portfolio is available");
    expect(renderToStaticMarkup(<PortfolioOverviewSkeleton />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<PortfolioOverviewError />)).toContain('role="alert"');
  });
});
