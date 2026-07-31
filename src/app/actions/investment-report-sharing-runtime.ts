import "server-only";
import { unstable_noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvestmentReportSnapshot } from "@/features/investment-reports";
import type { InvestmentReportShareGrant, SharedAccessRepository, SharedReportSource } from "@/features/investment-report-sharing";

export function createSharedAccessRepository(): SharedAccessRepository {
  unstable_noStore();
  const admin = createAdminClient();
  return {
    async findGrant(shareId) { const { data } = await admin.from("investment_report_shares").select("*").eq("id", shareId).maybeSingle(); return data ? mapGrant(data) : null; },
    async findReport(reportId) { const { data } = await admin.from("generated_reports").select("title,acquisition_strategy,generated_at,projection_snapshot").eq("id", reportId).eq("report_type", "investment-decision").maybeSingle(); return data ? { title: String(data.title), strategy: data.acquisition_strategy === "rental-arbitrage" ? "rental-arbitrage" : "purchase", generatedAt: String(data.generated_at), snapshot: data.projection_snapshot as InvestmentReportSnapshot } satisfies SharedReportSource : null; },
    async record(shareId, event, outcome, correlationId) { await admin.from("investment_report_share_access").insert({ id: `investment-report-share-access-${crypto.randomUUID()}`, share_id: shareId, event_type: event, outcome, correlation_id: correlationId, client_class: "browser" }); },
  };
}
function mapGrant(row: Record<string, unknown>): InvestmentReportShareGrant { return { id: String(row.id), ownerId: String(row.owner_profile_id), reportId: String(row.report_id), credentialDigest: String(row.credential_digest), credentialVersion: "sha256.v1", policyVersion: "investment-report-sharing.v1", reportSchemaVersion: String(row.report_schema_version), exportTemplateVersion: row.export_template_version ? String(row.export_template_version) : null, recipientLabel: row.recipient_label ? String(row.recipient_label) : null, allowPdfDownload: Boolean(row.allow_pdf_download), createdAt: String(row.created_at), expiresAt: String(row.expires_at), revokedAt: row.revoked_at ? String(row.revoked_at) : null, replacesShareId: row.replaces_share_id ? String(row.replaces_share_id) : null, replacedByShareId: row.replaced_by_share_id ? String(row.replaced_by_share_id) : null }; }
