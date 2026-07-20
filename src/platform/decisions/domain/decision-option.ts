import type { DecisionOutcome } from "./decision-outcome";

export type DecisionOption<
  TOutcome extends DecisionOutcome,
> = Readonly<{
  key: string;
  label: string;
  outcome: TOutcome;
  rank: number;
  score: number;
  summary: string;
}>;
