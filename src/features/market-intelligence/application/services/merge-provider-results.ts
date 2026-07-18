import { MarketObservation } from "../../domain/entities/market-observation";
import { ProviderType } from "../../domain/enums/provider-type";

export function mergeProviderResults(
  observations: readonly MarketObservation[],
): readonly MarketObservation[] {
  const grouped = new Map<string, MarketObservation>();

  for (const observation of observations) {
    const existing = grouped.get(observation.type);

    if (!existing) {
      grouped.set(observation.type, observation);
      continue;
    }

    if (
      observation.provider === ProviderType.Manual &&
      existing.provider !== ProviderType.Manual
    ) {
      grouped.set(observation.type, observation);
      continue;
    }

    if (
      observation.confidence.greaterThan(
        existing.confidence,
      )
    ) {
      grouped.set(observation.type, observation);
    }
  }

  return [...grouped.values()];
}
