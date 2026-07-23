import type { InvestmentOpportunityRepository } from "@/features/investment-opportunity/application";
import { createOpportunityOwnerId, type InvestmentOpportunity } from "@/features/investment-opportunity/domain";
import type {
  AcquisitionActionStateReader,
  AcquisitionEvidenceStateReader,
} from "@/features/investment-opportunity/acquisition-pipeline/application";
import {
  buildAcquisitionClosingReadiness,
  type AcquisitionPipelineRepository,
} from "@/features/investment-opportunity/acquisition-pipeline/domain";
import {
  createActionId,
} from "@/platform/actions";
import { createEvidenceId } from "@/platform/evidence";
import type {
  AcquisitionWorkspaceActionReader,
  AcquisitionWorkspaceActionState,
  AcquisitionWorkspaceAnalysisReader,
  AcquisitionWorkspaceAnalysisSource,
  AcquisitionWorkspaceEvidenceReader,
  AcquisitionWorkspaceEvidenceState,
  AcquisitionWorkspaceOpportunityReader,
  AcquisitionWorkspaceOpportunitySource,
  AcquisitionWorkspacePipelineReader,
  AcquisitionWorkspacePipelineSource,
} from "../application";

const EXTERNAL_REFERENCE_LIMIT = 25;

export class AcquisitionWorkspaceProductionReaderError extends Error {
  public constructor(
    public readonly code:
      | "OPPORTUNITY_READ_FAILED"
      | "ANALYSIS_READ_FAILED"
      | "PIPELINE_READ_FAILED"
      | "PIPELINE_SOURCE_INVALID"
      | "ACTION_READ_FAILED"
      | "EVIDENCE_READ_FAILED",
    options?: ErrorOptions,
  ) {
    super("Acquisition workspace production reader failed.", options);
    this.name = "AcquisitionWorkspaceProductionReaderError";
  }
}

export class ProductionAcquisitionWorkspaceOpportunityReader implements AcquisitionWorkspaceOpportunityReader {
  public constructor(private readonly repository: InvestmentOpportunityRepository) {}

  public async findOpportunity(input: Parameters<AcquisitionWorkspaceOpportunityReader["findOpportunity"]>[0]): Promise<AcquisitionWorkspaceOpportunitySource | null> {
    try {
      const opportunity = await this.repository.findById(input.opportunityId, createOpportunityOwnerId(input.ownerId));
      if (!opportunity) return null;
      const props = opportunity.props;
      return Object.freeze({
        id: props.id,
        ownerId: props.ownerId.value,
        version: props.version,
        name: props.name.value,
        location: Object.freeze({
          ...props.property.normalizedAddress,
          display: props.property.displayAddress,
        }),
        route: props.route,
        status: props.status,
        archived: Boolean(props.archivedAt),
        tags: Object.freeze(props.tags.map((tag) => tag.displayValue)),
        createdAt: new Date(props.createdAt),
        updatedAt: new Date(props.updatedAt),
        ...headlineValue(props),
      });
    } catch (error) {
      throw new AcquisitionWorkspaceProductionReaderError("OPPORTUNITY_READ_FAILED", { cause: error });
    }
  }
}

export class ProductionAcquisitionWorkspaceAnalysisReader implements AcquisitionWorkspaceAnalysisReader {
  public constructor(private readonly repository: InvestmentOpportunityRepository) {}

  public async findLatestCompletedAnalysis(input: Parameters<AcquisitionWorkspaceAnalysisReader["findLatestCompletedAnalysis"]>[0]): Promise<AcquisitionWorkspaceAnalysisSource | null> {
    try {
      const analyses = await this.repository.listAnalyses(input.opportunityId, createOpportunityOwnerId(input.ownerId));
      const analysis = [...analyses].sort((left, right) => right.sequence - left.sequence || left.id.value.localeCompare(right.id.value))[0];
      if (!analysis) return null;
      const props = analysis.props;
      return Object.freeze({
        analysisId: props.id,
        opportunityId: props.opportunityId,
        version: props.sequence,
        analyzedAt: new Date(props.resultSnapshot.analyzedAt),
        route: props.route,
        recommendation: props.resultSnapshot.recommendation.recommendation,
        score: props.resultSnapshot.score.value,
        confidence: Object.freeze({ ...props.resultSnapshot.confidence }),
        complete: true,
      });
    } catch (error) {
      throw new AcquisitionWorkspaceProductionReaderError("ANALYSIS_READ_FAILED", { cause: error });
    }
  }
}

export class ProductionAcquisitionWorkspacePipelineReader implements AcquisitionWorkspacePipelineReader {
  public constructor(
    private readonly repository: AcquisitionPipelineRepository,
    private readonly boundOwnerId: string,
  ) {}

  public async findByOpportunity(input: Parameters<AcquisitionWorkspacePipelineReader["findByOpportunity"]>[0]): Promise<AcquisitionWorkspacePipelineSource | null> {
    if (input.ownerId !== this.boundOwnerId) throw new AcquisitionWorkspaceProductionReaderError("PIPELINE_READ_FAILED");
    try {
      const pipeline = await this.repository.findByOpportunity(input.opportunityId);
      if (!pipeline) return null;
      if (pipeline.opportunityId.value !== input.opportunityId.value || pipeline.currentStage() === "exited") {
        throw new AcquisitionWorkspaceProductionReaderError("PIPELINE_SOURCE_INVALID");
      }
      const props = pipeline.props;
      const activity = pipeline.activity();
      const updatedAt = activity.at(-1)?.occurredAt ?? pipeline.activation.activatedAt;
      return Object.freeze({
        id: pipeline.id.value,
        opportunityId: pipeline.opportunityId,
        route: pipeline.route,
        stage: pipeline.currentStage(),
        version: pipeline.version().value,
        activation: Object.freeze({
          activatedAt: new Date(pipeline.activation.activatedAt),
          activatedBy: Object.freeze({ ...pipeline.activation.activatedBy }),
        }),
        offers: Object.freeze(pipeline.offers()),
        responses: Object.freeze(pipeline.responses()),
        ...(pipeline.acceptedAgreement() ? { acceptedAgreement: pipeline.acceptedAgreement() } : {}),
        ...(pipeline.contract() ? { contract: pipeline.contract() } : {}),
        contingencies: Object.freeze(pipeline.contingencies()),
        dueDiligenceItems: Object.freeze(pipeline.dueDiligenceItems()),
        ...(props.closingFacts ? { closingFacts: structuredClone(props.closingFacts) } : {}),
        stageHistory: Object.freeze(pipeline.history()),
        activity: Object.freeze(activity),
        readiness: buildAcquisitionClosingReadiness({ pipeline, evaluatedAt: input.evaluatedAt }),
        updatedAt: new Date(updatedAt),
      });
    } catch (error) {
      if (error instanceof AcquisitionWorkspaceProductionReaderError) throw error;
      throw new AcquisitionWorkspaceProductionReaderError("PIPELINE_READ_FAILED", { cause: error });
    }
  }
}

export class ProductionAcquisitionWorkspaceActionReader implements AcquisitionWorkspaceActionReader {
  public constructor(private readonly reader: AcquisitionActionStateReader) {}

  public async getActionStates(input: Parameters<AcquisitionWorkspaceActionReader["getActionStates"]>[0]): Promise<readonly AcquisitionWorkspaceActionState[]> {
    assertBoundedUnique(input.actionIds, "ACTION_READ_FAILED");
    try {
      const states = await this.reader.getActionStates({
        ownerId: createOpportunityOwnerId(input.ownerId),
        actionIds: input.actionIds.map(createActionId),
      });
      if (states.some((state) => !state.updatedAt || Number.isNaN(state.updatedAt.getTime()))) {
        throw new AcquisitionWorkspaceProductionReaderError("ACTION_READ_FAILED");
      }
      return Object.freeze(states.map((state) => Object.freeze({
        actionId: state.actionId.value,
        status: state.status,
        blocked: state.blocked,
        updatedAt: new Date(state.updatedAt!),
      })));
    } catch (error) {
      if (error instanceof AcquisitionWorkspaceProductionReaderError) throw error;
      throw new AcquisitionWorkspaceProductionReaderError("ACTION_READ_FAILED", { cause: error });
    }
  }
}

export class ProductionAcquisitionWorkspaceEvidenceReader implements AcquisitionWorkspaceEvidenceReader {
  public constructor(private readonly reader: AcquisitionEvidenceStateReader) {}

  public async getEvidenceStates(input: Parameters<AcquisitionWorkspaceEvidenceReader["getEvidenceStates"]>[0]): Promise<readonly AcquisitionWorkspaceEvidenceState[]> {
    assertBoundedUnique(input.evidenceIds, "EVIDENCE_READ_FAILED");
    try {
      const states = await this.reader.getEvidenceStates({
        ownerId: createOpportunityOwnerId(input.ownerId),
        evidenceIds: input.evidenceIds.map(createEvidenceId),
      });
      return Object.freeze(states.map((state) => Object.freeze({
        evidenceId: state.evidenceId.value,
        available: state.exists && state.available,
        state: state.exists && state.available ? "available" as const : "unavailable" as const,
      })));
    } catch (error) {
      throw new AcquisitionWorkspaceProductionReaderError("EVIDENCE_READ_FAILED", { cause: error });
    }
  }
}

function headlineValue(props: InvestmentOpportunity["props"]): Pick<AcquisitionWorkspaceOpportunitySource, "headlineValue"> | Record<string, never> {
  const analysis = props.analyses.find((candidate) => candidate.id.equals(props.currentAnalysisId))
    ?? [...props.analyses].sort((left, right) => right.sequence - left.sequence)[0];
  const financials = analysis?.props.resultSnapshot.financials;
  if (props.route === "purchase" && financials?.purchasePrice) {
    return { headlineValue: Object.freeze({ type: "purchase-price", amount: Object.freeze({ amount: financials.purchasePrice.amount, currency: "USD" }) }) };
  }
  if (props.route === "rental-arbitrage" && financials?.proposedMonthlyLease) {
    return { headlineValue: Object.freeze({ type: "monthly-rent", amount: Object.freeze({ amount: financials.proposedMonthlyLease.amount, currency: "USD" }) }) };
  }
  return {};
}

function assertBoundedUnique(ids: readonly string[], code: "ACTION_READ_FAILED" | "EVIDENCE_READ_FAILED"): void {
  if (ids.length > EXTERNAL_REFERENCE_LIMIT || new Set(ids).size !== ids.length || ids.some((id) => !id.trim())) {
    throw new AcquisitionWorkspaceProductionReaderError(code);
  }
}
