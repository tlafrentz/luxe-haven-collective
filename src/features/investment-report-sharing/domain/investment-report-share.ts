import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { InvestmentReportSnapshot } from "@/features/investment-reports";

export const INVESTMENT_REPORT_SHARE_POLICY_VERSION = "investment-report-sharing.v1" as const;
export const INVESTMENT_REPORT_SHARE_CREDENTIAL_VERSION = "sha256.v1" as const;
export const INVESTMENT_REPORT_SHARE_ACTIVE_LIMIT = 10;
export const INVESTMENT_REPORT_SHARE_DEADLINE_MS = 5_000;
export const INVESTMENT_REPORT_SHARE_DURATIONS = [24, 168, 720] as const;

export type InvestmentReportShareErrorCode =
  | "REPORT_NOT_FOUND" | "REPORT_UNAUTHORIZED" | "REPORT_SNAPSHOT_INVALID"
  | "SHARE_EXPIRATION_INVALID" | "SHARE_ACTIVE_LIMIT_REACHED" | "SHARE_CREATE_CONFLICT"
  | "SHARE_PERSIST_FAILED" | "SHARE_NOT_FOUND" | "SHARE_UNAUTHORIZED"
  | "SHARE_CREDENTIAL_INVALID" | "SHARE_EXPIRED" | "SHARE_REVOKED"
  | "SHARE_LIFECYCLE_CONFLICT" | "SHARE_REVOKE_FAILED" | "SHARE_PDF_NOT_ALLOWED"
  | "SHARE_ACCESS_HISTORY_UNAVAILABLE" | "SHARED_REPORT_VERSION_UNSUPPORTED"
  | "SHARED_REPORT_TEMPORARILY_UNAVAILABLE";

export class InvestmentReportShareError extends Error {
  constructor(public readonly code: InvestmentReportShareErrorCode, message: string) { super(message); this.name = "InvestmentReportShareError"; }
}

export type InvestmentReportShareGrant = Readonly<{
  id: string; ownerId: string; reportId: string; credentialDigest: string;
  credentialVersion: typeof INVESTMENT_REPORT_SHARE_CREDENTIAL_VERSION;
  policyVersion: typeof INVESTMENT_REPORT_SHARE_POLICY_VERSION;
  reportSchemaVersion: string; exportTemplateVersion: string | null; recipientLabel: string | null;
  allowPdfDownload: boolean; createdAt: string; expiresAt: string; revokedAt: string | null;
  replacesShareId: string | null; replacedByShareId: string | null;
}>;

export type SharedInvestmentReportView = Readonly<{
  brand: "Luxe Haven Collective"; label: "Read-only shared report"; title: string;
  strategy: "purchase" | "rental-arbitrage"; generatedAt: string; expiresAt: string;
  analysisVersion: number; recommendation: string; score: number; scoreMaximum: number;
  confidence: string; decisionReadiness: string; snapshot: InvestmentReportSnapshot;
  allowPdfDownload: boolean;
}>;

export function generateShareCredential() {
  const secret = randomBytes(32).toString("base64url");
  return Object.freeze({ secret, digest: digestShareSecret(secret), entropyBits: 256, version: INVESTMENT_REPORT_SHARE_CREDENTIAL_VERSION });
}
export function digestShareSecret(secret: string) { return createHash("sha256").update(secret, "utf8").digest("hex"); }
export function verifyShareCredential(secret: string, expectedDigest: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret) || !/^[0-9a-f]{64}$/.test(expectedDigest)) return false;
  const actual = Buffer.from(digestShareSecret(secret), "hex"), expected = Buffer.from(expectedDigest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function deriveShareStatus(grant: Pick<InvestmentReportShareGrant, "revokedAt" | "expiresAt">, now: Date): "active" | "expired" | "revoked" {
  if (grant.revokedAt) return "revoked"; return new Date(grant.expiresAt).getTime() <= now.getTime() ? "expired" : "active";
}
export function validateShareDuration(value: number) {
  if (!INVESTMENT_REPORT_SHARE_DURATIONS.includes(value as typeof INVESTMENT_REPORT_SHARE_DURATIONS[number])) throw new InvestmentReportShareError("SHARE_EXPIRATION_INVALID", "Choose an approved expiration period.");
  return value as typeof INVESTMENT_REPORT_SHARE_DURATIONS[number];
}
export function buildSharedInvestmentReportView(input: Readonly<{ title: string; strategy: "purchase" | "rental-arbitrage"; generatedAt: string; expiresAt: string; allowPdfDownload: boolean; snapshot: InvestmentReportSnapshot }>): SharedInvestmentReportView {
  if (input.snapshot.schemaVersion !== "investment-report.v1") throw new InvestmentReportShareError("SHARED_REPORT_VERSION_UNSUPPORTED", "This shared report version is unavailable.");
  if (!input.snapshot.decision || !input.snapshot.financials || !input.snapshot.lineage?.analysisId) throw new InvestmentReportShareError("REPORT_SNAPSHOT_INVALID", "This shared report is unavailable.");
  return Object.freeze({ brand: "Luxe Haven Collective", label: "Read-only shared report", title: input.title, strategy: input.strategy, generatedAt: input.generatedAt, expiresAt: input.expiresAt, analysisVersion: input.snapshot.lineage.analysisVersion, recommendation: input.snapshot.decision.recommendation, score: input.snapshot.score.value, scoreMaximum: input.snapshot.score.scaleMaximum, confidence: input.snapshot.confidence.level, decisionReadiness: input.snapshot.limitations.length ? "Decision-ready with limitations" : "Decision-ready", snapshot: input.snapshot, allowPdfDownload: input.allowPdfDownload });
}
