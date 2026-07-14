import type {
  PortfolioChange,
} from "../domain";

type BuildPortfolioChangesParams = {
  dailyChanges: PortfolioChange[];
  intelligenceChanges: PortfolioChange[];
  limit?: number;
};

export function buildPortfolioChanges({
  dailyChanges,
  intelligenceChanges,
  limit = 12,
}: BuildPortfolioChangesParams): PortfolioChange[] {
  const uniqueChanges =
    new Map<string, PortfolioChange>();

  for (const change of [
    ...dailyChanges,
    ...intelligenceChanges,
  ]) {
    uniqueChanges.set(change.id, change);
  }

  return [...uniqueChanges.values()]
    .sort(
      (left, right) =>
        new Date(
          right.occurredAt,
        ).getTime() -
        new Date(left.occurredAt).getTime(),
    )
    .slice(0, limit);
}
