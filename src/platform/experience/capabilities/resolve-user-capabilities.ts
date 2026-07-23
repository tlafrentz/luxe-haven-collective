import type { UserRole } from "@/types/database";
import type { CapabilityId } from "./capability-id";

const allClient: readonly CapabilityId[] = ["view_home", "view_observations", "view_executive_intelligence", "view_investment_workspace", "create_investment_analysis", "view_investment_opportunities", "manage_investment_opportunities", "compare_investment_opportunities", "view_actions", "manage_actions", "view_properties", "manage_workspace", "manage_team"];
const allInternal: readonly CapabilityId[] = ["view_internal_operations", "manage_platform_operations", "view_integrations", "manage_integrations", "manage_content"];
export function resolveUserCapabilities(input: Readonly<{ role?: UserRole | string | null; authenticated?: boolean }>): ReadonlySet<CapabilityId> {
  if (!input.authenticated) return new Set();
  if (input.role === "admin") return new Set([...allClient, ...allInternal]);
  if (input.role === "owner") return new Set(allClient);
  if (input.role === "cleaner") return new Set(["view_home", "view_observations", "view_actions", "view_properties"]);
  return new Set(["view_home"]);
}
