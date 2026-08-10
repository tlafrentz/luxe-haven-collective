import { AutomationDetailRoute } from "@/features/automation-workspace";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ automationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AutomationDetailRoute
      kind="definition"
      id={(await params).automationId}
      searchParams={searchParams}
    />
  );
}
