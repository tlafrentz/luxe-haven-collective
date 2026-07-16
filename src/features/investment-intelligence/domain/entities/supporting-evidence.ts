import {
  ConfidenceLevel,
  EvidenceDirection,
  EvidenceType,
} from "../enums";

export interface SupportingEvidence {
  readonly id: string;
  readonly type: EvidenceType;
  readonly direction: EvidenceDirection;
  readonly title: string;
  readonly description: string;
  readonly source: string;
  readonly confidence: ConfidenceLevel;
}
