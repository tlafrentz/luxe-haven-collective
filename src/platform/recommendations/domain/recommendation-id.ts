import { Identifier } from "../../kernel";

export type RecommendationId = Identifier;

export function createRecommendationId(value?: string): RecommendationId {
  return Identifier.create(
    value ?? `recommendation-${crypto.randomUUID()}`,
  );
}
