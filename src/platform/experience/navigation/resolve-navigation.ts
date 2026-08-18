import type { CapabilityId } from "../capabilities";
import type { NavigationItem } from "./navigation-types";
export function canViewNavigationItem(item: NavigationItem, capabilities: ReadonlySet<CapabilityId>) { return (item.requiredCapabilities ?? []).every(capability => capabilities.has(capability)); }
export function hasRequiredEntitlements(item: NavigationItem, entitlements: ReadonlySet<string>) { return (item.requiredEntitlements ?? []).every(entitlement => entitlements.has(entitlement)); }
export function resolveNavigation(items: readonly NavigationItem[], capabilities: ReadonlySet<CapabilityId>, enabledFeatureFlags: ReadonlySet<string> = new Set(), entitlements: ReadonlySet<string> = new Set()): readonly NavigationItem[] {
  const featureVisible = (item: NavigationItem) => !item.featureFlag || enabledFeatureFlags.has(item.featureFlag);
  const isVisible = (item: NavigationItem) => canViewNavigationItem(item, capabilities) && featureVisible(item) && hasRequiredEntitlements(item, entitlements);
  const visibleProducts = items.filter(item => item.kind !== "group" && isVisible(item));
  const visibleIds = new Set(visibleProducts.map(item => item.id));
  for (const item of visibleProducts) {
    let parentId = item.parentId;
    while (parentId) {
      visibleIds.add(parentId);
      parentId = items.find(candidate => candidate.id === parentId)?.parentId;
    }
  }
  return Object.freeze(items.filter(item => visibleIds.has(item.id) && isVisible(item)).map(item => Object.freeze({ ...item })));
}
