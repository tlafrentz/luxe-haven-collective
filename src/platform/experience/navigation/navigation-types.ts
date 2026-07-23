import type { CapabilityId } from "../capabilities";

export type PlatformExperience = "client-workspace" | "operations-console";
export type NavigationAvailability = "available" | "limited-preview" | "coming-soon";
export type ClientNavigationGroupId = "home" | "hpm" | "business" | "services" | "settings";
export type OperationsNavigationGroupId = "operations" | "platform" | "content" | "settings";
export type NavigationGroupId = ClientNavigationGroupId | OperationsNavigationGroupId;
export type NavigationIcon = "home" | "observe" | "understand" | "decide" | "execute" | "learn" | "property" | "investment" | "booking" | "message" | "report" | "service" | "settings" | "operations" | "integration" | "content";
export type NavigationActiveMatch = Readonly<{ type: "exact"; href: string } | { type: "prefix"; prefix: string } | { type: "patterns"; patterns: readonly string[] }>;
export type NavigationItemId = string;
export type NavigationItem = Readonly<{ id: NavigationItemId; label: string; href?: string; icon: NavigationIcon; group: NavigationGroupId; experience: PlatformExperience; requiredCapabilities?: readonly CapabilityId[]; availability: NavigationAvailability; activeMatch: NavigationActiveMatch; children?: readonly NavigationItem[]; description?: string; mobilePriority?: number }>;
