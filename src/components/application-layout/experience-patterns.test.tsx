import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExpandablePanel, HelpTooltip, StatusChip, WorkspacePlaceholder } from "./application-layout";

describe("platform experience patterns", () => {
  it("provides reversible disclosure language", () => {
    const html = renderToStaticMarkup(<ExpandablePanel title="Calculation" summary="Revenue formula">Inputs</ExpandablePanel>);
    expect(html).toContain("<details");
    expect(html).toContain("Show details");
    expect(html).toContain("Hide details");
  });

  it("provides keyboard-reachable contextual help", () => {
    const html = renderToStaticMarkup(<HelpTooltip label="confidence">Evidence strength</HelpTooltip>);
    expect(html).toContain("About confidence");
    expect(html).toContain('role="tooltip"');
  });

  it("distinguishes status and placeholder affordances", () => {
    expect(renderToStaticMarkup(<StatusChip tone="preview">Preview</StatusChip>)).toContain("Preview");
    const placeholder = renderToStaticMarkup(<WorkspacePlaceholder title="Reports" description="Requires a provider." />);
    expect(placeholder).toContain('aria-disabled="true"');
    expect(placeholder).toContain("Requires a provider.");
  });
});
