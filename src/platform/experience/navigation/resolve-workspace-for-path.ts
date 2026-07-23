import { matchesNavigationRoute } from "./match-navigation-route";
import { clientWorkspaceNavigation } from "./client-navigation";

export type HpmWorkspaceId = "observe" | "understand" | "decide" | "execute" | "learn";

export function resolveWorkspaceForPath(pathname: string): HpmWorkspaceId | undefined {
  return clientWorkspaceNavigation
    .filter((item): item is typeof item & { lifecycleStage: HpmWorkspaceId } => item.group === "hpm" && "lifecycleStage" in item)
    .find(item => matchesNavigationRoute(pathname, item.activeMatch))
    ?.lifecycleStage;
}
