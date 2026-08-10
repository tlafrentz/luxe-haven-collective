import { notFound } from "next/navigation";
import {
  AutomationFailure,
  AutomationReportView,
} from "@/features/automation-workspace/presentation";
import { getAuthorizedAutomationReport } from "@/features/automation-workspace/application";
import {
  AUTOMATION_REPORT_KEYS,
  type AutomationReportKey,
} from "@/platform/automations";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ reportKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reportKey } = await params;
  if (!AUTOMATION_REPORT_KEYS.includes(reportKey as AutomationReportKey))
    notFound();
  const raw = await searchParams,
    result = await getAuthorizedAutomationReport(
      reportKey as AutomationReportKey,
      {
        ...(typeof raw.propertyId === "string"
          ? { propertyId: raw.propertyId }
          : {}),
        ...(typeof raw.from === "string" ? { from: raw.from } : {}),
        ...(typeof raw.to === "string" ? { to: raw.to } : {}),
        ...(typeof raw.timeZone === "string" ? { timeZone: raw.timeZone } : {}),
      },
    );
  return result.ok ? (
    <AutomationReportView report={result.report} />
  ) : (
    <AutomationFailure {...result} />
  );
}
