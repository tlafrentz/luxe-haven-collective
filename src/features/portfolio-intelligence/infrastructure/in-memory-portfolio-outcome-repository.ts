import type {
  PortfolioDecisionOutcomeReview, PortfolioLearningRecord, PortfolioOutcomeRepository,
} from "../application/outcomes";

export class InMemoryPortfolioOutcomeRepository implements PortfolioOutcomeRepository {
  private readonly reviews = new Map<string, PortfolioDecisionOutcomeReview>();
  private readonly learnings = new Map<string, PortfolioLearningRecord>();
  private readonly receipts = new Map<string, PortfolioDecisionOutcomeReview | PortfolioLearningRecord>();
  async listReviews(workspaceId: string) { return [...this.reviews.values()].filter((item) => item.workspaceId === workspaceId); }
  async appendReview(review: PortfolioDecisionOutcomeReview, commandId: string) {
    const receipt = this.receipts.get(`${review.workspaceId}:${commandId}`);
    if (receipt) return receipt as PortfolioDecisionOutcomeReview;
    if (this.reviews.has(`${review.workspaceId}:${review.id}`)) throw new Error("Historical outcome reviews are immutable.");
    this.reviews.set(`${review.workspaceId}:${review.id}`, review);
    this.receipts.set(`${review.workspaceId}:${commandId}`, review);
    return review;
  }
  async listLearnings(workspaceId: string) { return [...this.learnings.values()].filter((item) => item.workspaceId === workspaceId); }
  async publishLearning(learning: PortfolioLearningRecord, commandId: string) {
    const receipt = this.receipts.get(`${learning.workspaceId}:${commandId}`);
    if (receipt) return receipt as PortfolioLearningRecord;
    if (this.learnings.has(`${learning.workspaceId}:${learning.id}`)) throw new Error("Historical learning records are immutable.");
    this.learnings.set(`${learning.workspaceId}:${learning.id}`, learning);
    this.receipts.set(`${learning.workspaceId}:${commandId}`, learning);
    return learning;
  }
}

