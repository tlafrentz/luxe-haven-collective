import { InventoryImportWorkflow } from "@/components/furnishing/inventory-import-workflow";
export default async function Page({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  return (
    <InventoryImportWorkflow
      importId={(await params).importId}
      stage="mapping"
    />
  );
}
