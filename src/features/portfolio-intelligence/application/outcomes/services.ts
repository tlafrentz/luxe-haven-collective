import type {
  BuildOutcomeReviewInput, PortfolioOutcomeRepository,
} from "./contracts";
import {
  buildPortfolioDecisionOutcomeReview, generatePortfolioLearning,
} from "./build-outcomes";

export async function publishCanonicalPortfolioOutcomeReview(input: Readonly<{
  repository: PortfolioOutcomeRepository; review: BuildOutcomeReviewInput;
  commandId: string;
}>) {
  const review = buildPortfolioDecisionOutcomeReview(input.review);
  const saved = await input.repository.appendReview(review, input.commandId);
  const reviews = await input.repository.listReviews(review.workspaceId);
  const generated = generatePortfolioLearning(reviews, review.createdAt);
  for (const learning of generated) {
    const existing = (await input.repository.listLearnings(review.workspaceId))
      .some(({ id }) => id === learning.id);
    if (!existing) await input.repository.publishLearning(learning, `${input.commandId}:learning:${learning.id}`);
  }
  return saved;
}

