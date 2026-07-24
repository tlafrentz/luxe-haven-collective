import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  OperationalContextBar,
  OperationalDegradedState,
  OperationalQualityIndicator,
} from "./operational-components";

describe("shared operational components", () => {
  it("uses one Workspace, Property, and Date Range context implementation", () => {
    const html = renderToStaticMarkup(
      <OperationalContextBar
        action="/dashboard"
        value={{
          workspaceId: "owner-1",
          workspaceLabel: "Owner Workspace",
          propertyId: "property-1",
          startDate: "2026-07-01",
          endDate: "2026-07-31",
        }}
        properties={[{ id: "property-1", label: "River District Loft" }]}
      />,
    );
    expect(html).toContain("Operational context");
    expect(html).toContain("Owner Workspace");
    expect(html).toContain('name="property"');
    expect(html).toContain('name="start"');
    expect(html).toContain('name="end"');
  });

  it("provides a non-color quality label", () => {
    const html = renderToStaticMarkup(
      <OperationalQualityIndicator status="attention-needed" />,
    );
    expect(html).toContain("Operational data quality: Attention Needed");
  });

  it("explains partial and disconnected states operationally", () => {
    const html = renderToStaticMarkup(
      <OperationalDegradedState
        synchronization={{
          status: "partially-succeeded",
          usable: true,
          succeeded: { created: 4, updated: 5, unchanged: 0 },
          failed: { records: 1, capabilities: ["guest-context"] },
          warnings: [],
          lastSuccessfulAt: "2026-07-24T12:00:00.000Z",
          recommendedAction: "Review affected records and retry synchronization.",
        }}
      />,
    );
    expect(html).toContain("Operational data is partially available");
    expect(html).toContain("Review connected systems");
    expect(html).not.toContain("Something went wrong");
  });
});
