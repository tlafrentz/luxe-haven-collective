import type { CapabilityId } from "../capabilities";
import type { NavigationItem } from "./navigation-types";
export function canViewNavigationItem(item: NavigationItem, capabilities: ReadonlySet<CapabilityId>) { return (item.requiredCapabilities ?? []).every(capability => capabilities.has(capability)); }
export function resolveNavigation(items: readonly NavigationItem[], capabilities: ReadonlySet<CapabilityId>): readonly NavigationItem[] { return Object.freeze(items.filter(item => canViewNavigationItem(item, capabilities)).map(item => Object.freeze({ ...item }))); }
