import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EmptyState,
  MetricTile,
  PlaceholderCard,
  PrimaryButton,
  SemanticBadge,
  SurfaceCard,
  designSystemTokens,
} from "./index";

describe("Luxe Haven Design System v2", () => {
  it("publishes the complete v2 token contract", () => {
    expect(designSystemTokens.version).toBe("2.0.0");
    expect(designSystemTokens).toHaveProperty("border");
    expect(designSystemTokens).toHaveProperty("opacity");
    expect(designSystemTokens).toHaveProperty("grid");
    expect(designSystemTokens).toHaveProperty("chart");
    expect(designSystemTokens.typography).toHaveProperty("metric");
    expect(designSystemTokens.elevation).toHaveProperty("interactive");
  });

  it("renders the shared card, metric, status, action, placeholder, and empty-state library", () => {
    const html = renderToStaticMarkup(<>
      <SurfaceCard>Surface</SurfaceCard>
      <MetricTile label="Revenue" value="$42" supporting="Current period" />
      <SemanticBadge tone="success">Healthy</SemanticBadge>
      <PrimaryButton>Review</PrimaryButton>
      <PlaceholderCard title="Reports" description="Not connected." />
      <EmptyState title="No outcomes" description="Complete an action first." />
    </>);
    expect(html).toContain("ui-surface");
    expect(html).toContain("ui-metric");
    expect(html).toContain("Healthy");
    expect(html).toContain("ui-button");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('role="status"');
  });

  it("supports system dark mode and reduced motion", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    expect(layout).toContain('data-theme="system"');
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".platform-workspace .bg-white");
    expect(css).toContain("--chart-primary");
  });
});
