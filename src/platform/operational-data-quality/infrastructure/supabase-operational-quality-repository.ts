import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type {
  OperationalQualityRepository,
} from "../application";
import type {
  DataQualityIssue,
  DataQualityIssueCode,
  OperationalDataQuality,
} from "../domain";

export class SupabaseOperationalQualityRepository
  implements OperationalQualityRepository
{
  async saveEvaluation(
    workspaceId: string,
    recordType: string,
    recordId: string,
    profileId: string,
    evaluation: OperationalDataQuality,
  ): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("operational_quality_evaluations")
      .upsert(
        {
          owner_id: workspaceId,
          record_type: recordType,
          record_id: recordId,
          profile_id: profileId,
          status: evaluation.status,
          dimensions: evaluation.dimensions,
          evaluated_at: evaluation.evaluatedAt,
          policy_id: evaluation.policyId,
          policy_version: evaluation.policyVersion,
          updated_at: evaluation.evaluatedAt,
        },
        {
          onConflict:
            "owner_id,record_type,record_id,profile_id,policy_version",
        },
      );
    if (error) throw new Error("Unable to persist operational quality.");
  }

  async synchronizeIssues(
    workspaceId: string,
    recordType: string,
    recordId: string,
    issues: readonly DataQualityIssue[],
    evaluatedAt: string,
    policyVersion: string,
  ): Promise<void> {
    const supabase = createAdminClient();
    const activeCodes = issues.map(({ code }) => code);
    let resolution = supabase
      .from("operational_data_quality_issues")
      .update({
        resolution_state: "resolved",
        resolved_at: evaluatedAt,
        updated_at: evaluatedAt,
      })
      .eq("owner_id", workspaceId)
      .eq("record_type", recordType)
      .eq("record_id", recordId)
      .in("resolution_state", ["open", "acknowledged"]);
    if (activeCodes.length) resolution = resolution.not("issue_code", "in", `(${activeCodes.join(",")})`);
    const { error: resolutionError } = await resolution;
    if (resolutionError)
      throw new Error("Unable to resolve corrected quality issues.");

    for (const issue of issues) {
      const { error } = await supabase
        .from("operational_data_quality_issues")
        .upsert(
          {
            owner_id: workspaceId,
            record_type: recordType,
            record_id: recordId,
            field_name: issue.scope.field ?? "",
            issue_code: issue.code,
            severity: issue.severity,
            evidence: issue.evidence,
            impact: issue.impact,
            suggested_resolution: issue.suggestedResolution,
            resolution_state: "open",
            first_observed_at: issue.firstObservedAt,
            last_observed_at: evaluatedAt,
            resolved_at: null,
            policy_version: policyVersion,
            updated_at: evaluatedAt,
          },
          {
            onConflict:
              "owner_id,record_type,record_id,issue_code,field_name",
          },
        );
      if (error) throw new Error("Unable to persist operational quality issue.");
    }
  }

  async listOpenIssues(
    workspaceId: string,
    codes: readonly DataQualityIssueCode[] = [],
  ): Promise<readonly DataQualityIssue[]> {
    const supabase = await createClient();
    let query = supabase
      .from("operational_data_quality_issues")
      .select(
        "record_type, record_id, field_name, issue_code, severity, evidence, impact, suggested_resolution, resolution_state, first_observed_at, last_observed_at",
      )
      .eq("owner_id", workspaceId)
      .in("resolution_state", ["open", "acknowledged"])
      .order("last_observed_at", { ascending: false })
      .limit(200);
    if (codes.length) query = query.in("issue_code", [...codes]);
    const { data, error } = await query;
    if (error) throw new Error("Unable to load operational quality issues.");
    return (data ?? []).map((row) => ({
      code: row.issue_code as DataQualityIssueCode,
      severity: row.severity as DataQualityIssue["severity"],
      scope: {
        workspaceId,
        recordType: row.record_type as DataQualityIssue["scope"]["recordType"],
        recordId: row.record_id,
        ...(row.field_name ? { field: row.field_name } : {}),
      },
      evidence: row.evidence as unknown as DataQualityIssue["evidence"],
      impact: row.impact,
      suggestedResolution: row.suggested_resolution,
      firstObservedAt: row.first_observed_at,
      lastObservedAt: row.last_observed_at,
      resolutionState:
        row.resolution_state as DataQualityIssue["resolutionState"],
    }));
  }
}

export type RedactedQualityDiagnostic = Readonly<{
  workspaceId: string;
  providerConnectionId: string | null;
  syncRunId: string | null;
  canonicalRecordId: string;
  issueCode: DataQualityIssueCode;
  mappingVersion: string | null;
  policyVersion: string;
  timestamp: string;
}>;

export function buildRedactedQualityDiagnostic(
  input: RedactedQualityDiagnostic,
): RedactedQualityDiagnostic {
  return Object.freeze({ ...input });
}
