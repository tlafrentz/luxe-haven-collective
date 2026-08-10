import { AutomationWorkspaceRoute } from "@/features/automation-workspace";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AutomationWorkspaceRoute view="approvals" searchParams={searchParams} />
  );
}
