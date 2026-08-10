import {
  AutomationFailure,
  AutomationOperationsView,
  AutomationWorkspaceFrame,
} from "@/features/automation-workspace/presentation";
import {
  getAutomationOperationsProjection,
  getAutomationWorkspaceProjection,
  parseAutomationWorkspaceQuery,
} from "@/features/automation-workspace/application";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    query = parseAutomationWorkspaceQuery(raw, "operations"),
    [workspace, operations] = await Promise.all([
      getAutomationWorkspaceProjection(query),
      getAutomationOperationsProjection({
        ...(typeof raw.propertyId === "string"
          ? { propertyId: raw.propertyId }
          : {}),
        ...(typeof raw.from === "string" ? { from: raw.from } : {}),
        ...(typeof raw.to === "string" ? { to: raw.to } : {}),
        ...(typeof raw.timeZone === "string" ? { timeZone: raw.timeZone } : {}),
      }),
    ]);
  if (!workspace.ok) return <AutomationFailure {...workspace} />;
  if (!operations.ok) return <AutomationFailure {...operations} />;
  return (
    <AutomationWorkspaceFrame
      activeView="operations"
      model={workspace.value}
      flags={workspace.flags}
      query={query}
    >
      <AutomationOperationsView
        model={operations.projection}
        reportsEnabled={operations.flags.reports}
        exportsEnabled={operations.flags.exports}
      />
    </AutomationWorkspaceFrame>
  );
}
