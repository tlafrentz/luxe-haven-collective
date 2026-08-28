import { ImportInventory } from "@/components/furnishing/product-catalog-workspace";
import { issueFurnishingCommandContext } from "@/features/furnishing-studio/server-command-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const workspaceId = (params.workspaceId ?? "").trim().toLowerCase();
  const resolved = UUID.test(workspaceId);
  const context = resolved ? await issueFurnishingCommandContext({
    workflow: "fs008g-finalization:catalog-import",
    workspaceId,
    commandType: "catalog.import.parse",
    targetType: "workspace",
    targetId: workspaceId,
  }) : null;
  return (
    <ImportInventory
      workspaceId={resolved ? workspaceId : null}
      commandContextId={context?.contextId ?? null}
    />
  );
}
