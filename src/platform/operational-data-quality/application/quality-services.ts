import type {
  DataQualityIssue,
  DataQualityIssueCode,
  OperationalDataQuality,
  OperationalDataQualityStatus,
  SynchronizationRunStatus,
} from "../domain";

export type WorkspaceOperationalDataHealth = Readonly<{
  status: OperationalDataQualityStatus;
  counts: Readonly<Record<OperationalDataQualityStatus, number>>;
  openIssues: Readonly<Record<"information" | "warning" | "critical", number>>;
  products: Readonly<
    Record<
      string,
      Readonly<{ status: OperationalDataQualityStatus; affectedRecords: number }>
    >
  >;
  evaluatedAt: string;
  policyVersion: string;
}>;

const statuses: readonly OperationalDataQualityStatus[] = [
  "trusted",
  "usable-with-gaps",
  "attention-needed",
  "degraded",
  "unusable",
  "unknown",
];

export function buildWorkspaceOperationalDataHealth(
  evaluations: readonly Readonly<{
    product: string;
    quality: OperationalDataQuality;
  }>[],
  evaluatedAt = new Date(),
): WorkspaceOperationalDataHealth {
  const counts = Object.fromEntries(
    statuses.map((status) => [
      status,
      evaluations.filter(({ quality }) => quality.status === status).length,
    ]),
  ) as Record<OperationalDataQualityStatus, number>;
  const issues = evaluations.flatMap(({ quality }) =>
    quality.issues.filter(({ resolutionState }) =>
      ["open", "acknowledged"].includes(resolutionState),
    ),
  );
  const productNames = new Set(evaluations.map(({ product }) => product));
  const products = Object.fromEntries(
    [...productNames].map((product) => {
      const productEvaluations = evaluations.filter(
        (evaluation) => evaluation.product === product,
      );
      const status =
        productEvaluations.find(({ quality }) => quality.status === "unusable")
          ?.quality.status ??
        productEvaluations.find(({ quality }) => quality.status === "degraded")
          ?.quality.status ??
        productEvaluations.find(
          ({ quality }) => quality.status === "attention-needed",
        )?.quality.status ??
        productEvaluations.find(
          ({ quality }) => quality.status === "usable-with-gaps",
        )?.quality.status ??
        productEvaluations[0]?.quality.status ??
        "unknown";
      return [
        product,
        {
          status,
          affectedRecords: productEvaluations.filter(
            ({ quality }) => quality.status !== "trusted",
          ).length,
        },
      ];
    }),
  );
  const status: OperationalDataQualityStatus =
    counts.unusable > 0
      ? "unusable"
      : counts.degraded > 0
        ? "degraded"
        : counts["attention-needed"] > 0
          ? "attention-needed"
          : counts["usable-with-gaps"] > 0
            ? "usable-with-gaps"
            : evaluations.length
              ? "trusted"
              : "unknown";
  return {
    status,
    counts,
    openIssues: {
      information: issues.filter(({ severity }) => severity === "information")
        .length,
      warning: issues.filter(({ severity }) => severity === "warning").length,
      critical: issues.filter(({ severity }) => severity === "critical").length,
    },
    products,
    evaluatedAt: evaluatedAt.toISOString(),
    policyVersion:
      evaluations[0]?.quality.policyVersion ?? "not-yet-evaluated",
  };
}

export type SynchronizationHealth = Readonly<{
  status: SynchronizationRunStatus;
  usable: boolean;
  succeeded: Readonly<{ created: number; updated: number; unchanged: number }>;
  failed: Readonly<{ records: number; capabilities: readonly string[] }>;
  warnings: readonly string[];
  lastSuccessfulAt: string | null;
  recommendedAction: string | null;
}>;

export function buildSynchronizationHealth(input: Readonly<{
  status: SynchronizationRunStatus;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  affectedCapabilities?: readonly string[];
  warnings?: readonly string[];
  lastSuccessfulAt: string | null;
  providerConnected: boolean;
}>): SynchronizationHealth {
  const status = input.providerConnected
    ? input.status
    : "failed";
  return {
    status,
    usable: Boolean(input.lastSuccessfulAt),
    succeeded: {
      created: input.created,
      updated: input.updated,
      unchanged: input.unchanged,
    },
    failed: {
      records: input.failed,
      capabilities: input.affectedCapabilities ?? [],
    },
    warnings: input.warnings ?? [],
    lastSuccessfulAt: input.lastSuccessfulAt,
    recommendedAction: !input.providerConnected
      ? "Reconnect the source in Workspace."
      : status === "partially-succeeded" || status === "failed"
        ? "Review affected records and retry synchronization."
        : status === "never-run"
          ? "Run the first synchronization."
          : null,
  };
}

export interface OperationalQualityRepository {
  saveEvaluation(
    workspaceId: string,
    recordType: string,
    recordId: string,
    profileId: string,
    evaluation: OperationalDataQuality,
  ): Promise<void>;
  synchronizeIssues(
    workspaceId: string,
    recordType: string,
    recordId: string,
    issues: readonly DataQualityIssue[],
    evaluatedAt: string,
    policyVersion: string,
  ): Promise<void>;
  listOpenIssues(
    workspaceId: string,
    codes?: readonly DataQualityIssueCode[],
  ): Promise<readonly DataQualityIssue[]>;
}

export async function reevaluateAffectedOperationalRecords(
  repository: OperationalQualityRepository,
  records: readonly Readonly<{
    workspaceId: string;
    recordType: string;
    recordId: string;
    profileId: string;
    evaluate: () => OperationalDataQuality;
  }>[],
): Promise<readonly OperationalDataQuality[]> {
  const results: OperationalDataQuality[] = [];
  for (const record of records) {
    const quality = record.evaluate();
    await repository.saveEvaluation(
      record.workspaceId,
      record.recordType,
      record.recordId,
      record.profileId,
      quality,
    );
    await repository.synchronizeIssues(
      record.workspaceId,
      record.recordType,
      record.recordId,
      quality.issues,
      quality.evaluatedAt,
      quality.policyVersion,
    );
    results.push(quality);
  }
  return results;
}

export type QualityAwareEvidence = Readonly<{
  qualityStatus: OperationalDataQualityStatus;
  sufficient: boolean;
  warning: string | null;
  policyVersion: string;
}>;

export function buildQualityAwareEvidence(
  quality: OperationalDataQuality,
): QualityAwareEvidence {
  return {
    qualityStatus: quality.status,
    sufficient: !["unusable", "unknown"].includes(quality.status),
    warning:
      quality.status === "trusted"
        ? null
        : quality.status === "unusable"
          ? "Available evidence is insufficient for this conclusion."
          : "Source data has limitations that may affect this conclusion.",
    policyVersion: quality.policyVersion,
  };
}

export function projectQualityForWorkspace(
  quality: OperationalDataQuality,
): OperationalDataQuality {
  return {
    ...quality,
    issues: quality.issues.map((issue) => ({
      ...issue,
      scope: {
        ...issue.scope,
        recordId: "redacted",
      },
      evidence: issue.evidence.map(
        ({ kind, statement, observedAt }) => ({
          kind,
          statement,
          ...(observedAt ? { observedAt } : {}),
        }),
      ),
    })),
  };
}
