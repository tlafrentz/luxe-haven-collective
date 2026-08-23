import type { CapabilityId } from "../capabilities";
import type { LifecycleInteractionType } from "./lifecycle-action-contracts";

export type BusinessServicesActionContract = Readonly<{
  id: string;
  capability: "properties" | "bookings" | "guest-communications" | "reports" | "connected-systems" | "guidebook-studio" | "furnishing-studio";
  route: string;
  label: string;
  interactionType: LifecycleInteractionType;
  canonicalTarget: string;
  authorization: readonly CapabilityId[];
  entitlement?: string;
  verificationReference: string;
}>;

const viewProperties = ["view_properties"] as const;
const observations = ["view_observations"] as const;
const actions = ["view_actions"] as const;
const integrations = ["view_integrations"] as const;

/** PS-001D's centrally testable inventory of material customer-visible controls. */
export const businessServicesActionContracts: readonly BusinessServicesActionContract[] = Object.freeze([
  item("properties-add", "properties", "/properties", "Add property", "navigation", "/properties/new", viewProperties, "PS-001D-71"),
  item("properties-manual", "properties", "/properties/new", "Enter property manually", "navigation", "/properties/new?method=manual", viewProperties, "PS-001D-71"),
  item("properties-import", "properties", "/properties/new", "Import from connected system", "navigation", "/dashboard/workspace/connected-systems?returnTo=/properties", integrations, "PS-001D-72"),
  item("property-report", "properties", "/properties", "Generate property report", "navigation", "/dashboard/reports/new", observations, "PS-001D-75"),
  item("bookings-filter", "bookings", "/bookings", "Booking filters", "filter", "/bookings?status=[status]", observations, "PS-001D-73"),
  item("communications-filter", "guest-communications", "/dashboard/communications", "Communication filters", "filter", "/dashboard/communications?[filters]", actions, "PS-001D-74"),
  item("communications-manage", "guest-communications", "/dashboard/communications", "Manage connection", "navigation", "/dashboard/workspace/connected-systems", integrations, "PS-001D-74"),
  item("communications-reply", "guest-communications", "/dashboard/communications/[conversationId]", "Send reply", "command", "sendGuestCommunicationReplyAction", actions, "PS-001D-74"),
  item("reports-generate", "reports", "/dashboard/reports", "Generate report", "navigation", "/dashboard/reports/new", observations, "PS-001D-75"),
  item("reports-open", "reports", "/dashboard/reports", "Open report", "navigation", "/dashboard/reports/[reportId]", observations, "PS-001D-75"),
  item("reports-download", "reports", "/dashboard/reports/[reportId]/versions/[versionId]", "Download", "command", "downloadCanonicalReportExportAction", observations, "PS-001D-75"),
  item("reports-regenerate", "reports", "/dashboard/reports/[reportId]/versions/[versionId]", "Regenerate", "command", "regenerateCanonicalReportAction", observations, "PS-001D-66"),
  item("connections-return", "connected-systems", "/dashboard/workspace/connected-systems", "Return to origin", "navigation", "validated returnTo", integrations, "PS-001D-27"),
  item("guidebooks-create", "guidebook-studio", "/dashboard/guidebooks", "Create Guidebook", "navigation", "/dashboard/guidebooks/new", viewProperties, "PS-001D-76", "guidebooks.create"),
  item("guidebooks-open", "guidebook-studio", "/dashboard/guidebooks", "Manage in Guidebook Studio", "navigation", "/dashboard/guidebooks/[guidebookId]/edit", viewProperties, "PS-001D-76"),
  item("guidebooks-preview", "guidebook-studio", "/dashboard/guidebooks/[guidebookId]/edit", "Preview", "navigation", "/dashboard/guidebooks/[guidebookId]/preview", viewProperties, "PS-001D-76"),
  item("guidebooks-publish", "guidebook-studio", "/dashboard/guidebooks/[guidebookId]/publish", "Publish", "command", "publishGuidebookAction", viewProperties, "PS-001D-76", "guidebooks.publish"),
  item("furnishing-new", "furnishing-studio", "/dashboard/furnishing/projects", "New project", "navigation", "/dashboard/furnishing/projects/new", viewProperties, "PS-001D-80", "furnishing.project.access"),
  item("furnishing-add-property", "furnishing-studio", "/dashboard/furnishing/projects/new", "Add new canonical property", "navigation", "/properties/new?returnTo=/dashboard/furnishing/projects/new", viewProperties, "PS-001D-82", "furnishing.project.access"),
  item("furnishing-create", "furnishing-studio", "/dashboard/furnishing/projects/new", "Create project", "command", "createProjectWorkspaceAction", viewProperties, "PS-001D-80", "furnishing.project.access"),
  item("furnishing-open", "furnishing-studio", "/dashboard/furnishing/projects", "Open project", "navigation", "/dashboard/furnishing/projects/[projectId]", viewProperties, "PS-001D-83", "furnishing.project.access"),
]);

function item(id: string, capability: BusinessServicesActionContract["capability"], route: string, label: string, interactionType: LifecycleInteractionType, canonicalTarget: string, authorization: readonly CapabilityId[], verificationReference: string, entitlement?: string): BusinessServicesActionContract {
  return Object.freeze({ id, capability, route, label, interactionType, canonicalTarget, authorization: Object.freeze([...authorization]), ...(entitlement ? { entitlement } : {}), verificationReference });
}
