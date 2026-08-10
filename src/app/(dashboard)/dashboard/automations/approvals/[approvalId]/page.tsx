import { AutomationDetailRoute } from "@/features/automation-workspace";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ approvalId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AutomationDetailRoute
      kind="approval"
      id={(await params).approvalId}
      searchParams={searchParams}
    />
  );
}
