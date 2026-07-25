import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  WorkspaceActivity,
  WorkspaceCard,
  WorkspaceContent,
  WorkspaceHeader,
  WorkspaceOverview,
  WorkspacePage,
  WorkspaceSupporting,
} from "./application-layout";

describe("Application Layout System", () => {
  it("renders the canonical five-part workspace structure", () => {
    const markup = renderToStaticMarkup(
      <WorkspacePage width="medium">
        <WorkspaceHeader title="Reports" description="Publish decision-ready intelligence." />
        <WorkspaceOverview>Health</WorkspaceOverview>
        <WorkspaceContent>Primary workflow</WorkspaceContent>
        <WorkspaceSupporting>Supporting context</WorkspaceSupporting>
        <WorkspaceActivity>History</WorkspaceActivity>
      </WorkspacePage>,
    );

    expect(markup).toContain('data-als="workspace-page"');
    expect(markup).toContain('data-als="workspace-header"');
    expect(markup).toContain('data-als="workspace-overview"');
    expect(markup).toContain('data-als="workspace-content"');
    expect(markup).toContain('data-als="workspace-supporting"');
    expect(markup).toContain('data-als="workspace-activity"');
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain("max-w-6xl");
  });

  it("exposes exactly three visual card hierarchy levels", () => {
    for (const level of [1, 2, 3] as const) {
      expect(renderToStaticMarkup(<WorkspaceCard level={level}>Card</WorkspaceCard>)).toContain(`data-als-card-level="${level}"`);
    }
  });
});
