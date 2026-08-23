import "server-only";

import { getCommerceAccessWorkspace } from "./commerce-access";

export async function assertFurnishingEntitlement(
  workspaceId: string,
  platformAdmin = false,
) {
  if (platformAdmin) return;
  const commerce = await getCommerceAccessWorkspace({ workspaceId });
  if (!commerce?.entitlements.some(
    (item) =>
      item.key === "furnishing.project.access" && item.status === "available",
  )) throw new Error("FURNISHING_ENTITLEMENT_REQUIRED");
}
