import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseActionCenterView } from "../domain";
import { ActionCenterHeader } from "./action-center-header";
import { ActionQueue } from "./action-queue";

const summary = { total: 0, ready: 0, inProgress: 0, blocked: 0, awaitingReview: 0, failed: 0, overdue: 0, unassigned: 0, completed: 0 };

describe("EX-003 Action Center interaction contract", () => {
  it("makes every supported view URL-addressable and exposes the selected page", () => {
    const html = renderToStaticMarkup(<ActionCenterHeader summary={summary} selectedView="my-work" />);
    for (const view of ["overview", "my-work", "all", "plans", "completed"]) expect(html).toContain(`/dashboard/execute?view=${view}`);
    expect(html).toContain('aria-current="page" href="/dashboard/execute?view=my-work"');
    expect(html).not.toContain("Recurring");
  });

  it.each([
    ["my-work", "No actions are assigned to you"],
    ["all", "No actions in this workspace"],
    ["completed", "No completed actions yet"],
    ["overview", "No committed actions yet"],
  ] as const)("renders a specific empty state for %s", (selectedView, message) => {
    const html = renderToStaticMarkup(<ActionQueue actions={[]} selectedView={selectedView} />);
    expect(html).toContain(message);
    expect(html).toContain('role="status"');
  });

  it("parses direct URLs safely and defaults invalid values to overview", () => {
    expect(parseActionCenterView("completed")).toBe("completed");
    expect(parseActionCenterView("recurring")).toBe("overview");
    expect(parseActionCenterView("unknown")).toBe("overview");
  });
});
