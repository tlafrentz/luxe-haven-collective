import { describe, expect, it } from "vitest";

import {
  Recommendation,
  RecommendationBuilder,
  RecommendationCollection,
  RecommendationExecutor,
  RecommendationPolicyRegistry,
  RecommendationPriority,
  RecommendationSession,
  createRecommendationId,
} from "../../src/platform/recommendations";

describe("platform recommendations public API", () => {
  it("exports the complete Recommendations capability", () => {
    expect(Recommendation).toBeDefined();
    expect(RecommendationCollection).toBeDefined();
    expect(RecommendationPriority).toBeDefined();
    expect(createRecommendationId).toBeDefined();
    expect(RecommendationBuilder).toBeDefined();
    expect(RecommendationPolicyRegistry).toBeDefined();
    expect(RecommendationExecutor).toBeDefined();
    expect(RecommendationSession).toBeDefined();
  });
});
