import type { ResolvedEntitlement } from "@/platform/commerce";

export function projectGuidebookEntitlements(
  entitlements: readonly ResolvedEntitlement[],
) {
  const available = (key: string) =>
    entitlements.some((item) => item.key === key && item.status === "available");
  return Object.freeze({
    create: available("guidebooks.create"),
    publish: available("guidebooks.publish"),
    host: available("guidebooks.host"),
  });
}
