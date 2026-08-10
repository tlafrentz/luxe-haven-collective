import { NextRequest } from "next/server";
import { exportAuthorizedAutomationReport } from "@/features/automation-workspace/application";
import {
  AUTOMATION_REPORT_KEYS,
  type AutomationReportKey,
} from "@/platform/automations";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportKey: string }> },
) {
  const { reportKey } = await params;
  if (!AUTOMATION_REPORT_KEYS.includes(reportKey as AutomationReportKey))
    return Response.json(
      {
        code: "AUTOMATION_EXPORT_FAILED",
        message: "The requested report is unavailable.",
      },
      { status: 404 },
    );
  const value = Object.fromEntries(request.nextUrl.searchParams.entries()),
    result = await exportAuthorizedAutomationReport(
      reportKey as AutomationReportKey,
      value,
    );
  if (!result.ok)
    return Response.json(
      {
        code: result.code,
        message: result.message,
        correlationId: result.correlationId,
      },
      { status: result.code.includes("UNAUTHORIZED") ? 403 : 400 },
    );
  return new Response(result.export.content, {
    headers: {
      "content-type": result.export.contentType,
      "content-disposition": `attachment; filename="${result.export.filename}"`,
      etag: `"${result.export.checksum}"`,
      "cache-control": "private, no-store",
    },
  });
}
