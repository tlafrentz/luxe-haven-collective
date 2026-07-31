"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getInvestmentReport } from "./investment-reports";
import { deriveShareStatus, generateShareCredential, validateShareDuration, type InvestmentReportShareGrant } from "@/features/investment-report-sharing";

export type ShareActionState = Readonly<{ ok: boolean; message: string; url?: string; shareId?: string; expiresAt?: string }>;

export async function createInvestmentReportShareAction(_state: ShareActionState, formData: FormData): Promise<ShareActionState> {
  const reportId = String(formData.get("reportId") ?? ""), correlationId = crypto.randomUUID();
  console.info("investment_report_share_creation_entered", { correlationId, reportId });
  const report = await getInvestmentReport(reportId);
  if (!report) return fail("Report unavailable.");
  const duration = Number(formData.get("durationHours") ?? 168);
  try { validateShareDuration(duration); } catch { return fail("Choose an approved expiration period."); }
  const recipientLabel = String(formData.get("recipientLabel") ?? "").trim().slice(0, 160);
  const allowPdf = formData.get("allowPdfDownload") === "on", idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) return fail("The share request expired. Refresh and retry.");
  const credential = generateShareCredential(), shareId = `investment-report-share-${crypto.randomUUID()}`;
  console.info("investment_report_share_credential_generated", { correlationId, reportId, shareId, entropyBits: credential.entropyBits });
  const client = await createClient();
  const { data, error } = await client.rpc("create_investment_report_share_v1", { p_share_id: shareId, p_report_id: reportId, p_credential_digest: credential.digest, p_duration_hours: duration, p_recipient_label: recipientLabel, p_allow_pdf_download: allowPdf, p_idempotency_key: idempotencyKey });
  const result = data as unknown as { shareId?: string; existing?: boolean; expiresAt?: string } | null;
  if (error || !result?.shareId) {
    const limited = error?.message?.includes("share_active_limit_reached");
    console.warn("investment_report_share_creation_failed", { correlationId, reportId, failureClass: limited ? "active-limit" : "persistence" });
    return fail(limited ? "This report already has 10 active shares. Revoke one before creating another." : "The share could not be created. Please retry.");
  }
  if (result.existing) return fail("This share request was already completed. For security, create a replacement link.");
  const expiresAt = result.expiresAt ?? new Date(Date.now() + duration * 3_600_000).toISOString();
  console.info("investment_report_share_persisted", { correlationId, reportId, shareId, strategy: report.strategy, expirationClass: `${duration}h`, pdfPermission: allowPdf ? "enabled" : "disabled" });
  console.info("investment_report_share_creation_completed", { correlationId, reportId, shareId, outcome: "created" });
  revalidatePath(`/dashboard/investments/reports/${reportId}`);
  return { ok: true, message: "Share created.", shareId, expiresAt, url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/shared/investment-report/${shareId}/${credential.secret}` };
}

export async function replaceInvestmentReportShareAction(_state: ShareActionState, formData: FormData): Promise<ShareActionState> {
  const oldShareId = String(formData.get("shareId") ?? ""), duration = Number(formData.get("durationHours") ?? 168);
  try { validateShareDuration(duration); } catch { return fail("Choose an approved expiration period."); }
  const credential = generateShareCredential(), newShareId = `investment-report-share-${crypto.randomUUID()}`;
  const client = await createClient(), recipientLabel = String(formData.get("recipientLabel") ?? "").trim().slice(0, 160), allowPdf = formData.get("allowPdfDownload") === "on";
  const { data, error } = await client.rpc("replace_investment_report_share_v1", { p_old_share_id: oldShareId, p_new_share_id: newShareId, p_credential_digest: credential.digest, p_duration_hours: duration, p_recipient_label: recipientLabel, p_allow_pdf_download: allowPdf, p_idempotency_key: String(formData.get("idempotencyKey") ?? crypto.randomUUID()) });
  const result = data as unknown as { shareId?: string; expiresAt?: string } | null;
  if (error || !result?.shareId) return fail("The replacement could not be created. The existing link was not changed.");
  console.info("investment_report_share_replacement_created", { oldShareId, shareId: newShareId, outcome: "created" });
  revalidatePath(String(formData.get("returnPath") ?? "/dashboard/investments/reports"));
  return { ok: true, message: "Replacement created. The previous link is revoked.", shareId: newShareId, expiresAt: result.expiresAt, url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/shared/investment-report/${newShareId}/${credential.secret}` };
}

export async function revokeInvestmentReportShareAction(formData: FormData) {
  const shareId = String(formData.get("shareId") ?? ""), reportId = String(formData.get("reportId") ?? ""), client = await createClient();
  const { error } = await client.rpc("revoke_investment_report_share_v1", { p_share_id: shareId });
  if (error) return;
  console.info("investment_report_share_revoked", { shareId, reportId, outcome: "revoked" });
  revalidatePath(`/dashboard/investments/reports/${reportId}`);
}

export async function listInvestmentReportShares(reportId: string) {
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: shares, error } = await client.from("investment_report_shares").select("id,owner_profile_id,report_id,credential_digest,credential_version,share_policy_version,report_schema_version,export_template_version,recipient_label,allow_pdf_download,created_at,expires_at,revoked_at,replaces_share_id,replaced_by_share_id").eq("report_id", reportId).eq("owner_profile_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return null;
  const ids = (shares ?? []).map(row => row.id);
  const { data: access } = ids.length ? await client.from("investment_report_share_access").select("share_id,event_type,occurred_at,outcome").in("share_id", ids).order("occurred_at", { ascending: false }).limit(500) : { data: [] };
  const now = new Date();
  return (shares ?? []).map(row => {
    const grant = mapGrant(row), events = (access ?? []).filter(item => item.share_id === grant.id), opens = events.filter(item => item.event_type === "report-opened" && item.outcome === "granted"), pdfs = events.filter(item => item.event_type === "pdf-downloaded" && item.outcome === "granted");
    return Object.freeze({ ...grant, credentialDigest: undefined, status: deriveShareStatus(grant, now), accessCount: opens.length, pdfDownloadCount: pdfs.length, lastAccessedAt: opens[0]?.occurred_at ?? null });
  }).sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.createdAt.localeCompare(a.createdAt));
}

function mapGrant(row: Record<string, unknown>): InvestmentReportShareGrant { return { id: String(row.id), ownerId: String(row.owner_profile_id), reportId: String(row.report_id), credentialDigest: String(row.credential_digest), credentialVersion: "sha256.v1", policyVersion: "investment-report-sharing.v1", reportSchemaVersion: String(row.report_schema_version), exportTemplateVersion: row.export_template_version ? String(row.export_template_version) : null, recipientLabel: row.recipient_label ? String(row.recipient_label) : null, allowPdfDownload: Boolean(row.allow_pdf_download), createdAt: String(row.created_at), expiresAt: String(row.expires_at), revokedAt: row.revoked_at ? String(row.revoked_at) : null, replacesShareId: row.replaces_share_id ? String(row.replaces_share_id) : null, replacedByShareId: row.replaced_by_share_id ? String(row.replaced_by_share_id) : null }; }
function fail(message: string): ShareActionState { return { ok: false, message }; }
