import { AutomationVersionRoute } from "@/features/automation-workspace";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ automationId: string; versionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const value = await params;
  return (
    <AutomationVersionRoute
      automationId={value.automationId}
      versionId={value.versionId}
      searchParams={searchParams}
    />
  );
}
