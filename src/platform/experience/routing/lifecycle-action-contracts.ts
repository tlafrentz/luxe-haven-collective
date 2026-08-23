import type { CapabilityId } from "../capabilities";

export type LifecycleInteractionType = "navigation" | "command" | "filter" | "modal-or-drawer" | "external" | "disabled-by-design";
export type LifecycleActionContract = Readonly<{
  id: string;
  capability: "investment-intelligence" | "action-center" | "learn";
  route: string;
  label: string;
  interactionType: LifecycleInteractionType;
  canonicalTarget: string;
  authorization: readonly CapabilityId[];
  verificationReference: string;
}>;

const investmentAuthorization = ["view_investment_workspace"] as const;
const opportunityAuthorization = ["view_investment_opportunities"] as const;
const executeAuthorization = ["view_actions"] as const;
const learnAuthorization = ["view_executive_intelligence"] as const;

/** PS-001C's centrally testable inventory for customer-visible lifecycle controls. */
export const lifecycleActionContracts: readonly LifecycleActionContract[] = [
  action("investment-overview", "investment-intelligence", "/dashboard/investments", "Overview", "navigation", "/dashboard/investments", investmentAuthorization, "PS-001C-96"),
  action("investment-analyze", "investment-intelligence", "/dashboard/investments", "Analyze", "navigation", "/dashboard/investments/new", investmentAuthorization, "PS-001C-96"),
  action("investment-scenarios", "investment-intelligence", "/dashboard/investments", "Scenarios", "navigation", "/dashboard/investments/scenarios", investmentAuthorization, "PS-001C-96"),
  action("investment-opportunities", "investment-intelligence", "/dashboard/investments", "Opportunities", "navigation", "/dashboard/investments/opportunities", opportunityAuthorization, "PS-001C-96"),
  action("investment-new-analysis", "investment-intelligence", "/dashboard/investments", "New Analysis", "modal-or-drawer", "/dashboard/investments/new", investmentAuthorization, "PS-001C-96"),
  action("investment-save-analysis", "investment-intelligence", "/dashboard/investments/new", "Save analysis", "command", "saveInvestmentOpportunityAnalysisAction", investmentAuthorization, "PS-001C-96"),
  action("investment-create-scenario", "investment-intelligence", "/dashboard/investments/opportunities/[id]/scenarios", "Create scenario", "command", "createInvestmentScenarioAction", opportunityAuthorization, "PS-001C-96"),
  action("investment-compare-scenarios", "investment-intelligence", "/dashboard/investments/opportunities/[id]/scenarios", "Open comparison workspace", "navigation", "/dashboard/investments/opportunities/[id]/compare", opportunityAuthorization, "PS-001C-96"),
  action("investment-review-outcomes", "investment-intelligence", "/dashboard/investments/opportunities/[id]/scenarios", "Review measured outcomes", "navigation", "/dashboard/investments/opportunities/[id]/learning", opportunityAuthorization, "PS-001C-100"),
  action("decision-create-plan", "investment-intelligence", "/dashboard/portfolio/decisions/[decisionId]", "Create Action Plan", "command", "createExecutePlanFromDecisionAction", investmentAuthorization, "PS-001C-98"),
  ...["overview", "my-work", "all", "plans", "completed"].map((view) => action(`action-center-${view}`, "action-center", "/dashboard/execute", view === "my-work" ? "My Work" : view === "all" ? "All Actions" : view === "plans" ? "Action Plans" : title(view), "filter", `/dashboard/execute?view=${view}`, executeAuthorization, "PS-001C-97")),
  action("plan-open", "action-center", "/dashboard/execute?view=plans", "Open Action Plan", "navigation", "/dashboard/execute/plans/[planId]", executeAuthorization, "PS-001C-98"),
  action("plan-activate", "action-center", "/dashboard/execute/plans/[planId]", "Activate Plan", "command", "activateExecutePlanAction", executeAuthorization, "PS-001C-98"),
  ...["start", "submit-for-review", "return-for-correction", "complete", "fail", "retry", "reopen"].map((command) => action(`action-${command}`, "action-center", "/dashboard/execute/actions/[id]", title(command), "command", `transitionExecuteAction:${command}`, executeAuthorization, "PS-001C-99")),
  action("action-add-evidence", "action-center", "/dashboard/execute/actions/[id]", "Attach evidence", "command", "attachExecuteEvidenceAction", executeAuthorization, "PS-001C-99"),
  action("action-submit-evidence", "action-center", "/dashboard/execute/actions/[id]", "Submit evidence for review", "command", "submitExecuteEvidenceAction", executeAuthorization, "PS-001C-99"),
  action("action-review-evidence", "action-center", "/dashboard/execute/actions/[id]", "Accept/Return evidence", "command", "reviewExecuteEvidenceAction", executeAuthorization, "PS-001C-99"),
  action("action-block", "action-center", "/dashboard/execute/actions/[id]", "Add/Resolve blocker", "command", "blockExecuteAction/resolveExecuteBlockerAction", executeAuthorization, "PS-001C-99"),
  action("learn-outcomes", "learn", "/dashboard/learn", "Outcomes", "navigation", "/dashboard/learn/outcomes", learnAuthorization, "PS-001C-100"),
  action("learn-lessons", "learn", "/dashboard/learn", "Lessons", "navigation", "/dashboard/learn/lessons", learnAuthorization, "PS-001C-101"),
  action("learn-outcome-source-action", "learn", "/dashboard/learn/outcomes/[reviewId]", "View source action", "navigation", "/dashboard/execute/actions/[id]", learnAuthorization, "PS-001C-72"),
  action("learn-outcome-source-plan", "learn", "/dashboard/learn/outcomes/[reviewId]", "View Action Plan", "navigation", "/dashboard/execute/plans/[planId]", learnAuthorization, "PS-001C-72"),
  action("learn-outcome-source-decision", "learn", "/dashboard/learn/outcomes/[reviewId]", "View source decision", "navigation", "/dashboard/portfolio/decisions/[decisionId]", learnAuthorization, "PS-001C-72"),
];

function action(id: string, capability: LifecycleActionContract["capability"], route: string, label: string, interactionType: LifecycleInteractionType, canonicalTarget: string, authorization: readonly CapabilityId[], verificationReference: string): LifecycleActionContract {
  return Object.freeze({ id, capability, route, label, interactionType, canonicalTarget, authorization: Object.freeze([...authorization]), verificationReference });
}
function title(value: string) { return value.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" "); }
