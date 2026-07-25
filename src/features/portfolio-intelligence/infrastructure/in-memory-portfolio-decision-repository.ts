import type {
  DecisionRepository, PortfolioStrategicDecision,
} from "../application/decisions";

export class InMemoryPortfolioDecisionRepository implements DecisionRepository {
  private readonly records = new Map<string, PortfolioStrategicDecision>();
  private readonly receipts = new Map<string, PortfolioStrategicDecision>();

  async list(workspaceId: string) {
    return [...this.records.values()].filter((item) => item.workspaceId === workspaceId);
  }
  async get(workspaceId: string, decisionId: string) {
    return this.records.get(`${workspaceId}:${decisionId}`) ?? null;
  }
  async save(decision: PortfolioStrategicDecision, expectedRevision: number, commandId: string) {
    const receiptKey = `${decision.workspaceId}:${commandId}`;
    const replay = this.receipts.get(receiptKey);
    if (replay) return replay;
    const key = `${decision.workspaceId}:${decision.decisionId}`;
    const current = this.records.get(key);
    if (current && current.revision !== expectedRevision) throw new Error("Portfolio decision revision conflict.");
    this.records.set(key, decision);
    this.receipts.set(receiptKey, decision);
    return decision;
  }
  seed(decision: PortfolioStrategicDecision) {
    this.records.set(`${decision.workspaceId}:${decision.decisionId}`, decision);
  }
}

