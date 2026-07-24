import type { ResultType } from "@/platform/kernel";
import type {
  Outcome, OutcomeId, OutcomeOrigin, OutcomeOwnerId, OutcomeState, OutcomeSubject,
} from "../domain";

export type OutcomeRepositoryError =
  | Readonly<{ code: "OUTCOME_VERSION_CONFLICT"; currentVersion?: number }>
  | Readonly<{ code: "OUTCOME_DUPLICATE_ID" }>
  | Readonly<{ code: "OUTCOME_REPOSITORY_UNAVAILABLE"; retryable: boolean }>;

export interface OutcomeRepository {
  findById(ownerId: OutcomeOwnerId, outcomeId: OutcomeId): Promise<ResultType<Outcome | null, OutcomeRepositoryError>>;
  save(outcome: Outcome, expectedVersion: number | null): Promise<ResultType<void, OutcomeRepositoryError>>;
  existsByOrigin(ownerId: OutcomeOwnerId, origin: OutcomeOrigin): Promise<ResultType<boolean, OutcomeRepositoryError>>;
}

export interface OutcomeAuthorization {
  canReadOutcome(ownerId: OutcomeOwnerId, outcomeId: OutcomeId): Promise<boolean>;
  canCreateOutcome(ownerId: OutcomeOwnerId, subject: OutcomeSubject): Promise<boolean>;
  canModifyOutcome(ownerId: OutcomeOwnerId, outcomeId: OutcomeId): Promise<boolean>;
}

export type OutcomeApplicationError =
  | Readonly<{ code: "OUTCOME_NOT_FOUND" }>
  | Readonly<{ code: "OUTCOME_NOT_AUTHORIZED" }>
  | Readonly<{ code: "OUTCOME_INPUT_INVALID"; field?: string; reason?: string }>
  | Readonly<{ code: "OUTCOME_VERSION_CONFLICT"; currentVersion?: number }>
  | Readonly<{ code: "OUTCOME_INVALID_TRANSITION"; from?: string; to?: string }>
  | Readonly<{ code: "OUTCOME_DUPLICATE_ORIGIN" }>
  | Readonly<{ code: "OUTCOME_EXPECTATION_INVALID"; expectationId?: string }>
  | Readonly<{ code: "OUTCOME_MEASUREMENT_INVALID"; measurementId?: string }>
  | Readonly<{ code: "OUTCOME_WINDOW_INVALID"; windowId?: string }>
  | Readonly<{ code: "OUTCOME_EVIDENCE_INSUFFICIENT" }>
  | Readonly<{ code: "OUTCOME_REPOSITORY_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "OUTCOME_UNEXPECTED"; correlationId?: string }>;

export type OutcomeReadModel = Readonly<{
  id: OutcomeId;
  subject: OutcomeSubject;
  origin: OutcomeOrigin;
  status: OutcomeState["status"];
  expectationCount: number;
  measurementCount: number;
  measurementWindowSummary: Readonly<{ planned: number; open: number; closed: number; cancelled: number }>;
  confidence: OutcomeState["confidence"]["assessment"];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}>;

export type OutcomePage = Readonly<{ items: readonly OutcomeReadModel[]; nextCursor?: string }>;
export interface OutcomeReader {
  getOutcome(query: Readonly<{ ownerId: OutcomeOwnerId; outcomeId: OutcomeId }>): Promise<ResultType<OutcomeReadModel | null, OutcomeRepositoryError>>;
  listOutcomesForDecision(query: Readonly<{ ownerId: OutcomeOwnerId; decisionId: string; limit: number; cursor?: string }>): Promise<ResultType<OutcomePage, OutcomeRepositoryError>>;
  listOutcomesForSubject(query: Readonly<{ ownerId: OutcomeOwnerId; subject: OutcomeSubject; limit: number; cursor?: string }>): Promise<ResultType<OutcomePage, OutcomeRepositoryError>>;
}
