// PA-001: the TypeScript-side source of truth for privilege identifiers and
// role names seeded by supabase/migrations/20260903030000_pa001_platform_access_foundation.sql.
// Not consumed anywhere yet -- later milestones import from here instead of
// hand-typing raw strings.

export const PRIVILEGE_IDS = {
  guidebooksGuidebookView: "guidebooks.guidebook.view",
  guidebooksGuidebookCreate: "guidebooks.guidebook.create",
  guidebooksGuidebookEdit: "guidebooks.guidebook.edit",
  guidebooksGuidebookManageMedia: "guidebooks.guidebook.manage_media",
  guidebooksGuidebookSubmit: "guidebooks.guidebook.submit",
  guidebooksGuidebookReview: "guidebooks.guidebook.review",
  guidebooksGuidebookApprove: "guidebooks.guidebook.approve",
  guidebooksGuidebookPublish: "guidebooks.guidebook.publish",
  guidebooksGuidebookUnpublish: "guidebooks.guidebook.unpublish",
  guidebooksGuidebookArchive: "guidebooks.guidebook.archive",
  guidebooksGuidebookShare: "guidebooks.guidebook.share",
  guidebooksGuidebookExport: "guidebooks.guidebook.export",

  investmentsOpportunityView: "investments.opportunity.view",
  investmentsOpportunityCreate: "investments.opportunity.create",
  investmentsOpportunityEditAssumptions: "investments.opportunity.edit_assumptions",
  investmentsOpportunityViewFinancing: "investments.opportunity.view_financing",
  investmentsOpportunityEditFinancing: "investments.opportunity.edit_financing",
  investmentsOpportunityViewReturns: "investments.opportunity.view_returns",
  investmentsOpportunityApprove: "investments.opportunity.approve",
  investmentsOpportunityShare: "investments.opportunity.share",
  investmentsOpportunityExport: "investments.opportunity.export",
  investmentsOpportunityArchive: "investments.opportunity.archive",

  actionsActionView: "actions.action.view",
  actionsActionAssign: "actions.action.assign",
  actionsActionComment: "actions.action.comment",
  actionsActionDismiss: "actions.action.dismiss",
  actionsActionExecute: "actions.action.execute",
  actionsActionApprove: "actions.action.approve",

  financialsSummaryViewSummary: "financials.summary.view_summary",
  financialsTransactionViewTransactions: "financials.transaction.view_transactions",
  financialsTransactionReconcile: "financials.transaction.reconcile",
  financialsTransactionCategorize: "financials.transaction.categorize",
  financialsConnectionConnectProvider: "financials.connection.connect_provider",
  financialsConnectionManageConnections: "financials.connection.manage_connections",
  financialsReportForecast: "financials.report.forecast",
  financialsReportExport: "financials.report.export",

  revenueStrategyView: "revenue.strategy.view",
  revenueStrategyEditStrategy: "revenue.strategy.edit_strategy",
  revenueRecommendationCreateRecommendation: "revenue.recommendation.create_recommendation",
  revenueRecommendationApprove: "revenue.recommendation.approve",
  revenueRatesPublishRates: "revenue.rates.publish_rates",
  revenueIntegrationManageIntegrations: "revenue.integration.manage_integrations",

  operationsTaskView: "operations.task.view",
  operationsTaskCreate: "operations.task.create",
  operationsTaskAssign: "operations.task.assign",
  operationsTaskComplete: "operations.task.complete",
  operationsTaskVerify: "operations.task.verify",
  operationsTaskReopen: "operations.task.reopen",
  operationsTemplateManageTemplates: "operations.template.manage_templates",

  automationsAutomationView: "automations.automation.view",
  automationsAutomationCreate: "automations.automation.create",
  automationsAutomationEdit: "automations.automation.edit",
  automationsAutomationEnable: "automations.automation.enable",
  automationsAutomationApprove: "automations.automation.approve",
  automationsAutomationExecute: "automations.automation.execute",
  automationsRunViewRuns: "automations.run.view_runs",
  automationsRunCancelRun: "automations.run.cancel_run",

  furnishingCatalogCatalogManage: "furnishing.catalog.catalog_manage",
  furnishingCatalogImportCommit: "furnishing.catalog.import_commit",
  furnishingPackagePackageEdit: "furnishing.package.package_edit",
  furnishingPackagePackageApprove: "furnishing.package.package_approve",
  furnishingDesignDesignEdit: "furnishing.design.design_edit",
  furnishingBudgetBudgetApprove: "furnishing.budget.budget_approve",
  furnishingProcurementProcurementPrepare: "furnishing.procurement.procurement_prepare",
  furnishingProcurementProcurementApprove: "furnishing.procurement.procurement_approve",
  furnishingProcurementPurchaseAuthorize: "furnishing.procurement.purchase_authorize",
  furnishingInstallationInstallationUpdate: "furnishing.installation.installation_update",
  furnishingInstallationInstallationComplete: "furnishing.installation.installation_complete",

  workspaceMembersMembersView: "workspace.members.members_view",
  workspaceMembersMembersManage: "workspace.members.members_manage",
  workspaceRolesRolesView: "workspace.roles.roles_view",
  workspaceRolesRolesManage: "workspace.roles.roles_manage",
  workspacePropertyPropertiesManage: "workspace.property.properties_manage",
  workspaceEntitlementEntitlementsView: "workspace.entitlement.entitlements_view",
  workspaceBillingBillingManage: "workspace.billing.billing_manage",
  workspaceAuditAuditView: "workspace.audit.audit_view",

  // PA-006: added after the original PA-001 76-privilege spec list, to back
  // canApprovePortfolioDecision (src/features/portfolio-intelligence/application/decisions/policies.ts).
  portfolioDecisionApprove: "portfolio.decision.approve",
} as const;

export type PrivilegeId = (typeof PRIVILEGE_IDS)[keyof typeof PRIVILEGE_IDS];

export const ROLE_NAMES = ["workspace_owner", "administrator", "manager", "contributor", "viewer"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const SCOPE_TYPES = ["platform", "workspace", "portfolio", "property", "project", "resource"] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];
