import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ActionPlanProps } from "@/platform/actions";
import { ActionPlanQueue } from "./action-plan-queue";
import { ActionPlanWorkspace } from "./action-plan-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/execute-plans", () => ({ activateExecutePlanAction: vi.fn(), cancelExecutePlanAction: vi.fn(), completeExecutePlanAction: vi.fn(), updateExecuteDraftAction: vi.fn() }));

const plan: ActionPlanProps = {
  id: "plan-decision-1", workspaceId: "workspace-1", title: "Revenue improvement", origin: { type: "decision", id: "decision-1", capability: "portfolio" }, linkedDecisionId: "decision-1", scope: { type: "property", propertyIds: ["property-1"] }, owner: { type: "user", id: "owner-1" }, status: "draft", priority: "high", successMetrics: ["revenue"], actions: [{ id: "action-1", position: 0, title: "Update pricing", owner: { type: "user", id: "owner-1" } }], createdBy: { type: "user", id: "owner-1" }, createdAt: new Date("2026-08-23T12:00:00Z"), version: 1, events: [],
};

describe("PS-001C Action Plan customer contract", () => {
  it("makes every customer-visible plan card navigable", () => {
    const html = renderToStaticMarkup(<ActionPlanQueue plans={[plan]} />);
    expect(html).toContain('/dashboard/execute/plans/plan-decision-1');
    expect(html).toContain("Open Action Plan");
  });

  it("uses canonical plan state for lineage, readiness, actions, and history", () => {
    const html = renderToStaticMarkup(<ActionPlanWorkspace history={[]} plan={plan} />);
    expect(html).toContain("Decision decision-1");
    expect(html).toContain("View source decision");
    expect(html).toContain("Update pricing");
    expect(html).toContain("required deadline");
    expect(html).toContain("Decision lineage retained");
    expect(html).toContain("Activate Plan");
    expect(html).toContain("disabled");
  });
});
