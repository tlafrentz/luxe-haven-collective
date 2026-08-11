import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReportArtifactStorage,
  ReportExport,
  ReportExportRepository,
} from "./exports";
import { ReportFoundationError } from "./model";

export class SupabaseReportExportRepository implements ReportExportRepository {
  constructor(private readonly client: Pick<SupabaseClient, "from" | "rpc">) {}
  async reserve(input: ReportExport) {
    const { data, error } = await this.client.rpc(
      "reserve_canonical_report_export",
      { p_export: toRow(input) },
    );
    if (error) throw failure(error.message);
    const result = data as unknown as {
      record: Record<string, unknown>;
      replay: boolean;
    };
    return { record: mapExport(result.record), replay: Boolean(result.replay) };
  }
  async markGenerating(id: string) {
    await this.transition(id, "queued", { status: "generating" });
  }
  async markReady(
    id: string,
    artifact: Readonly<{
      storageKey: string;
      fileName: string;
      mediaType: string;
      byteSize: number;
      checksum: string;
      completedAt: string;
      expiresAt: string;
    }>,
  ) {
    await this.transition(id, "generating", {
      status: "ready",
      storage_key: artifact.storageKey,
      file_name: artifact.fileName,
      media_type: artifact.mediaType,
      byte_size: artifact.byteSize,
      checksum: artifact.checksum,
      completed_at: artifact.completedAt,
      expires_at: artifact.expiresAt,
    });
  }
  async markFailed(
    id: string,
    value: Readonly<{ code: string; message: string }>,
  ) {
    await this.transition(id, "generating", {
      status: "failed",
      failure_code: value.code.slice(0, 100),
      failure_message: value.message.slice(0, 500),
      completed_at: new Date().toISOString(),
    });
  }
  async get(id: string, tenantId: string) {
    const { data, error } = await this.client
      .from("canonical_report_exports")
      .select("*")
      .eq("workspace_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw failure();
    return data ? mapExport(data) : null;
  }
  async list(reportVersionId: string, tenantId: string) {
    const { data, error } = await this.client
      .from("canonical_report_exports")
      .select("*")
      .eq("workspace_id", tenantId)
      .eq("report_version_id", reportVersionId)
      .order("requested_at", { ascending: false });
    if (error) throw failure();
    return Object.freeze((data ?? []).map(mapExport));
  }
  async expire(id: string, tenantId: string) {
    const { error } = await this.client
      .from("canonical_report_exports")
      .update({ status: "expired", storage_key: null })
      .eq("workspace_id", tenantId)
      .eq("id", id)
      .eq("status", "ready");
    if (error) throw failure();
  }
  private async transition(
    id: string,
    expected: string,
    values: Record<string, unknown>,
  ) {
    const { data, error } = await this.client
      .from("canonical_report_exports")
      .update(values)
      .eq("id", id)
      .eq("status", expected)
      .select("id")
      .maybeSingle();
    if (error || !data) throw failure(error?.message);
  }
}

export class SupabaseReportArtifactStorage implements ReportArtifactStorage {
  constructor(
    private readonly client: Pick<SupabaseClient, "storage">,
    private readonly bucket = "report-artifacts",
  ) {}
  async store(
    input: Readonly<{ key: string; content: Uint8Array; mediaType: string }>,
  ) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(input.key, input.content, {
        contentType: input.mediaType,
        upsert: false,
      });
    if (error) throw failure();
  }
  async createDownloadAccess(
    input: Readonly<{
      key: string;
      fileName: string;
      expiresInSeconds: number;
    }>,
  ) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(input.key, input.expiresInSeconds, {
        download: input.fileName,
      });
    if (error || !data?.signedUrl) throw failure();
    return data.signedUrl;
  }
  async remove(key: string) {
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) throw failure();
  }
}

function toRow(value: ReportExport) {
  return {
    id: value.id,
    workspace_id: value.tenantId,
    report_id: value.reportId,
    report_version_id: value.reportVersionId,
    format: value.format,
    status: value.status,
    options: value.options,
    requested_by_profile_id: value.requestedBy,
    requested_at: value.requestedAt,
    correlation_id: value.correlationId,
    renderer_version: value.rendererVersion,
    idempotency_key: value.idempotencyKey,
    request_fingerprint: JSON.stringify({
      reportVersionId: value.reportVersionId,
      format: value.format,
      options: value.options,
    }),
  };
}
function mapExport(row: Record<string, unknown>): ReportExport {
  return Object.freeze({
    id: String(row.id),
    tenantId: String(row.workspace_id),
    reportId: String(row.report_id),
    reportVersionId: String(row.report_version_id),
    format: row.format as ReportExport["format"],
    status: row.status as ReportExport["status"],
    options: row.options as ReportExport["options"],
    requestedBy: String(row.requested_by_profile_id),
    requestedAt: String(row.requested_at),
    correlationId: String(row.correlation_id),
    rendererVersion: String(row.renderer_version),
    idempotencyKey: String(row.idempotency_key),
    ...(row.completed_at ? { completedAt: String(row.completed_at) } : {}),
    ...(row.expires_at ? { expiresAt: String(row.expires_at) } : {}),
    ...(row.failure_code ? { failureCode: String(row.failure_code) } : {}),
    ...(row.failure_message
      ? { failureMessage: String(row.failure_message) }
      : {}),
    ...(row.storage_key ? { storageKey: String(row.storage_key) } : {}),
    ...(row.file_name ? { fileName: String(row.file_name) } : {}),
    ...(row.media_type ? { mediaType: String(row.media_type) } : {}),
    ...(row.byte_size != null ? { byteSize: Number(row.byte_size) } : {}),
    ...(row.checksum ? { checksum: String(row.checksum) } : {}),
  });
}
function failure(message?: string) {
  return new ReportFoundationError(
    message?.includes("REPORT_EXPORT_IDEMPOTENCY_CONFLICT")
      ? "REPORT_IDEMPOTENCY_CONFLICT"
      : "REPORT_GENERATION_FAILED",
    "Report export persistence failed safely.",
  );
}
