import { AutomationDetailRoute } from "@/features/automation-workspace";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AutomationDetailRoute
      kind="run"
      id={(await params).runId}
      searchParams={searchParams}
    />
  );
}
