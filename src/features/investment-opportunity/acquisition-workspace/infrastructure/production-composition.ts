import type { InvestmentOpportunityRepository } from "@/features/investment-opportunity/application";
import type { AcquisitionActionStateReader, AcquisitionEvidenceStateReader } from "@/features/investment-opportunity/acquisition-pipeline/application";
import type { AcquisitionPipelineRepository } from "@/features/investment-opportunity/acquisition-pipeline/domain";
import type { AcquisitionWorkspaceDeploymentStatus } from "../application";
import { GetAcquisitionWorkspaceHandler } from "./get-acquisition-workspace-handler";
import { ProductionAcquisitionWorkspaceAuthorizer, type AcquisitionWorkspacePrincipalReader } from "./production-authorization";
import { ProductionAcquisitionWorkspaceQueryObserver, type AcquisitionWorkspaceQueryLogger, type AcquisitionWorkspaceQueryMetrics } from "./production-observability";
import {
  ProductionAcquisitionWorkspaceActionReader,
  ProductionAcquisitionWorkspaceAnalysisReader,
  ProductionAcquisitionWorkspaceEvidenceReader,
  ProductionAcquisitionWorkspaceOpportunityReader,
  ProductionAcquisitionWorkspacePipelineReader,
} from "./production-readers";

export type AcquisitionWorkspaceProductionDependencies = Readonly<{
  ownerId: string;
  opportunities: InvestmentOpportunityRepository;
  pipelines: AcquisitionPipelineRepository;
  actions: AcquisitionActionStateReader;
  evidence: AcquisitionEvidenceStateReader;
  principals: AcquisitionWorkspacePrincipalReader;
  deployment: AcquisitionWorkspaceDeploymentStatus;
  logger: AcquisitionWorkspaceQueryLogger;
  metrics: AcquisitionWorkspaceQueryMetrics;
  now: () => Date;
  monotonicNow?: () => number;
}>;

export function composeAcquisitionWorkspaceProduction(dependencies: AcquisitionWorkspaceProductionDependencies): Readonly<{
  getAcquisitionWorkspace: GetAcquisitionWorkspaceHandler;
}> {
  const monotonicNow = dependencies.monotonicNow ?? (() => performance.now());
  const observer = new ProductionAcquisitionWorkspaceQueryObserver(dependencies.metrics, monotonicNow);
  const getAcquisitionWorkspace = new GetAcquisitionWorkspaceHandler({
    opportunities: new ProductionAcquisitionWorkspaceOpportunityReader(dependencies.opportunities),
    analyses: new ProductionAcquisitionWorkspaceAnalysisReader(dependencies.opportunities),
    pipelines: new ProductionAcquisitionWorkspacePipelineReader(dependencies.pipelines, dependencies.ownerId),
    actions: new ProductionAcquisitionWorkspaceActionReader(dependencies.actions),
    evidence: new ProductionAcquisitionWorkspaceEvidenceReader(dependencies.evidence),
    authorization: new ProductionAcquisitionWorkspaceAuthorizer(dependencies.principals),
    deployment: Object.freeze({ ...dependencies.deployment, documentReaderAvailable: false }),
    now: dependencies.now,
    observer,
  }, dependencies.logger, dependencies.metrics, monotonicNow);
  return Object.freeze({ getAcquisitionWorkspace });
}
