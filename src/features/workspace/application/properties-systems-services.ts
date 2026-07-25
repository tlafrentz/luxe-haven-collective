import { authorizeWorkspaceAction } from "./team-access-services";
import type { WorkspaceAccessContext } from "../domain/team-access";
import {
  buildPropertiesAndSystemsHealth,
  type ConnectedSystemSummary,
  type PropertiesAndSystemsHealth,
  type WorkspacePropertySummary,
} from "../domain/properties-systems";

export type PropertySystemActivity = Readonly<{
  id: string;
  action: string;
  result: string;
  occurredAt: string;
}>;

export type PropertiesAndSystemsOverview = Readonly<{
  properties: readonly WorkspacePropertySummary[];
  systems: readonly ConnectedSystemSummary[];
  health: PropertiesAndSystemsHealth;
  activity: readonly PropertySystemActivity[];
}>;

export interface PropertiesSystemsRepository {
  overview(context: WorkspaceAccessContext): Promise<{
    properties: readonly WorkspacePropertySummary[];
    systems: readonly ConnectedSystemSummary[];
    activity: readonly PropertySystemActivity[];
  }>;
  command(input: Readonly<{
    context: WorkspaceAccessContext;
    action: "include-property" | "exclude-property" | "archive-property" | "confirm-link" | "reject-match" | "disconnect" | "reconnect";
    targetId: string;
    payload?: Readonly<Record<string, string>>;
    commandId: string;
  }>): Promise<void>;
}

export async function getPropertiesAndSystemsOverview(
  repository: PropertiesSystemsRepository,
  context: WorkspaceAccessContext,
): Promise<PropertiesAndSystemsOverview> {
  authorizeWorkspaceAction(context, "properties.view");
  const projection = await repository.overview(context);
  return Object.freeze({
    ...projection,
    health: buildPropertiesAndSystemsHealth(projection.properties, projection.systems),
  });
}

export async function applyPropertySystemCommand(
  repository: PropertiesSystemsRepository,
  input: Parameters<PropertiesSystemsRepository["command"]>[0],
) {
  authorizeWorkspaceAction(
    input.context,
    input.action === "disconnect" || input.action === "reconnect"
      ? "connections.manage"
      : "properties.manage",
  );
  await repository.command(input);
}
