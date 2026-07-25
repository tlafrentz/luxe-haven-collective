import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HealthIndicator, ProductActivity, ProductHeader, ProductOverview, ProductPage, ProductSupport, ProductWorkspace } from "./product-page-blueprint";

describe("Product Page Blueprint", () => {
  it("composes the five conceptual product regions on ALS", () => {
    const markup = renderToStaticMarkup(
      <ProductPage pattern="settings-sections" density="comfortable">
        <ProductHeader title="Workspace" description="Configure the hospitality business." />
        <ProductOverview>Current state</ProductOverview>
        <ProductWorkspace>Primary workflow</ProductWorkspace>
        <ProductSupport>Supporting intelligence</ProductSupport>
        <ProductActivity>Continuity</ProductActivity>
      </ProductPage>,
    );

    expect(markup).toContain('data-ppb="product-page"');
    expect(markup).toContain('data-workspace-pattern="settings-sections"');
    expect(markup).toContain('data-density="comfortable"');
    expect(markup).toContain('data-ppb-region="overview"');
    expect(markup).toContain('data-ppb-region="primary-workspace"');
    expect(markup).toContain('data-ppb-region="support"');
    expect(markup).toContain('data-ppb-region="activity"');
  });

  it("requires health to include evidence and interpretation", () => {
    const markup = renderToStaticMarkup(<HealthIndicator label="Connections" status="attention" value="1 issue" evidence="The PMS has not synced in 18 hours." interpretation="Reservation updates may be stale." />);
    expect(markup).toContain("The PMS has not synced in 18 hours.");
    expect(markup).toContain("Reservation updates may be stale.");
  });
});
