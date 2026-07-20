import {
  type Claim,
} from "../../claims";

import {
  type EvidenceCollection,
} from "../../evidence";

import {
  type EvaluationDisposition,
  type EvaluationEvidenceReferenceInput,
  type EvaluationType,
} from "../domain";

import {
  type ConfidenceAssessment,
} from "../../scoring";

export type EvaluationPolicyContext = Readonly<{
  claim: Claim;
  evidence: EvidenceCollection;
}>;

export type EvaluationPolicyResult = Readonly<{
  type: EvaluationType;
  disposition: EvaluationDisposition;
  summary: string;
  confidence: ConfidenceAssessment;
  evidenceReferences:
    readonly EvaluationEvidenceReferenceInput[];
  metadata?: Readonly<
    Record<string, unknown>
  >;
}>;

/**
 * Application-level contract for converting a Claim and available Evidence
 * into an Evaluation judgment.
 *
 * Policies own reasoning. They do not construct domain identities, timestamps,
 * or provenance.
 */
export interface EvaluationPolicy {
  readonly name: string;
  readonly version?: string;

  supports(
    context: EvaluationPolicyContext,
  ): boolean;

  evaluate(
    context: EvaluationPolicyContext,
  ): EvaluationPolicyResult;
}
