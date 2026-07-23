import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { PortfolioWorkspace } from "../components/portfolio-workspace";

const metrics = { evaluating: 0, researching: 0, shortlisted: 0, underContract: 0, acquired: 0 };
describe("Portfolio workspace presentation", () => {
  it("renders the connected first-use empty state", () => { const html = renderToStaticMarkup(<PortfolioWorkspace view={{ metrics, opportunities: [], empty: true }} filter={{}} />); expect(html).toContain("No saved opportunities yet."); expect(html).toContain("Save an investment analysis"); expect(html).toContain("Start a new analysis"); expect(html).toContain('href="/dashboard/investments/new"'); });
  it("renders a distinct filtered empty state", () => { const html = renderToStaticMarkup(<PortfolioWorkspace view={{ metrics, opportunities: [], empty: true }} filter={{ search: "Austin" }} />); expect(html).toContain("No opportunities match these filters."); expect(html).toContain("Clear filters"); });
  it("renders card decision fields and quick actions", () => { const html = renderToStaticMarkup(<PortfolioWorkspace view={{ metrics: { ...metrics, shortlisted: 1 }, empty: false, opportunities: [{ id: "investment-opportunity-1", name: "Main deal", address: "123 Main Street", route: "purchase", status: "shortlisted", archived: false, tags: [], recommendation: "buy-with-conditions", score: 82, scoreMaximum: 100, confidence: "high", lastAnalyzedAt: new Date("2026-07-22T00:00:00Z"), updatedAt: new Date("2026-07-22T00:00:00Z") }] }} filter={{}} />); expect(html).toContain("123 Main Street"); expect(html).toContain("Buy With Conditions"); expect(html).toContain("82/100"); expect(html).toContain("High"); expect(html).toContain("View opportunity"); });
});
