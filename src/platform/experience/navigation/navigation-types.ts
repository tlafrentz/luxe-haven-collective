import type { CapabilityId } from "../capabilities";

export type PlatformExperience = "client-workspace" | "operations-console";
export type NavigationAvailability = "available" | "limited-preview" | "coming-soon";
export type NavigationItemKind = "group" | "product" | "utility";
export type NavigationLevel = 1 | 2 | 3;
export type NavigationBadgeKind = "count" | "attention" | "urgent";
export type NavigationBadgeDefinition = Readonly<{ kind: NavigationBadgeKind; accessibleLabel: string; maximum?: number }>;
export type ClientNavigationGroupId = "home" | "hpm" | "business" | "services" | "settings";
export type OperationsNavigationGroupId = "operations" | "services" | "infrastructure" | "settings";
export type NavigationGroupId = ClientNavigationGroupId | OperationsNavigationGroupId;
export type NavigationIcon = "home" | "workspace" | "hpm" | "observe" | "understand" | "portfolio" | "decide" | "execute" | "learn" | "property" | "investment" | "booking" | "message" | "report" | "service" | "settings" | "operations" | "integration" | "content";
export type NavigationActiveMatch = Readonly<{ type: "exact"; href: string } | { type: "prefix"; prefix: string } | { type: "patterns"; patterns: readonly string[] }>;
export type NavigationItemId = string;
export type NavigationItem = Readonly<{ id: NavigationItemId; parentId?: NavigationItemId; kind: NavigationItemKind; level: NavigationLevel; label: string; lifecycleStage?: Exclude<import("../routing/platform-route-definition").HpmStage, "home">; href?: string; icon?: NavigationIcon; group: NavigationGroupId; experience: PlatformExperience; requiredCapabilities?: readonly CapabilityId[]; availability: NavigationAvailability; activeMatch?: NavigationActiveMatch; description?: string; badge?: NavigationBadgeDefinition; featureFlag?: string; setupRequirement?: string; mobilePriority?: number }>;
