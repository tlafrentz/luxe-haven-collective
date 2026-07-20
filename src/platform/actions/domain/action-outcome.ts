import type { ObservationValue } from "../../observations";

export type ActionOutcome = Readonly<{
  summary: string;
  successful: boolean;
  measuredImpact?: Readonly<Record<string, number>>;
  lessonsLearned?: readonly string[];
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
