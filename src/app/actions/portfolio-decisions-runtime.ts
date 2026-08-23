"use server";

import { revalidatePath } from "next/cache";
import type { PortfolioComparison } from "@/features/portfolio";
import {
  applyPortfolioDecisionCommand, buildPortfolioDecisionWorkspace,
  createDecisionMeasurementPlan,
  createPortfolioDecision, getCapitalAllocationCandidates,
  PortfolioDecisionError, savePortfolioDecisionMeasurementPlan,
  SupabasePortfolioDecisionRepository,
  type DecisionCommandType,
} from "@/features/portfolio-intelligence";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";
import { getPortfolioFindingsRouteState } from "./portfolio-findings-runtime";

type RouteInput = Readonly<{
  workspaceId?: string; propertyIds?: readonly string[];
  periodPreset: "30d" | "90d" | "ytd" | "12m"; comparisonType: PortfolioComparison; now?: Date;
}>;
export type PortfolioDecisionActionResult =
  | Readonly<{ ok: true; message: string; decisionId: string; revision: number }>
  | Readonly<{ ok: false; code: "permission" | "evidence" | "conflict" | "expired" | "concurrency" | "unavailable"; message: string }>;

export async function getPortfolioDecisionsRouteState(input: RouteInput) {
  const started = Date.now();
  try {
    const context = await requestContext(input.workspaceId);
    if (!context) return { ok: false as const, code: "permission" as const, message: "Sign in to review portfolio decisions." };
    const findingsState = await getPortfolioFindingsRouteState(input);
    if (!findingsState.ok) return findingsState;
    const repository = new SupabasePortfolioDecisionRepository();
    const decisions = await repository.list(context.access.workspaceId);
    const workspace = buildPortfolioDecisionWorkspace({
      findings: findingsState.findings, decisions, role: context.access.role,
      now: (input.now ?? new Date()).toISOString(),
    });
    console.info("portfolio_decisions_evaluated", {
      workspaceId: context.access.workspaceId, actorRole: context.access.role,
      recommendationCount: workspace.candidates.length, decisionCount: decisions.length,
      conflictCount: workspace.conflicts.length, canApprove: workspace.canApprove,
      durationMilliseconds: Date.now() - started, policyVersion: "portfolio-decision-policy-v1",
    });
    return { ok: true as const, workspace };
  } catch (error) {
    console.error("portfolio_decisions_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
      durationMilliseconds: Date.now() - started,
    });
    return { ok: false as const, code: "unavailable" as const, message: "Portfolio decisions could not be loaded. No recommendation, decision, or action was changed." };
  }
}

export async function createPortfolioDecisionAction(
  input: RouteInput & Readonly<{ candidateId: string; commandId: string }>,
): Promise<PortfolioDecisionActionResult> {
  try {
    const loaded = await loadCandidate(input);
    if (!loaded) return denied();
    if (loaded.access.role !== "owner") return denied("You may review recommendations but only a workspace owner can create a capital decision in v1.");
    const now = (input.now ?? new Date()).toISOString();
    const decision = createPortfolioDecision({
      candidate: loaded.candidate, ownerProfileId: loaded.access.profileId,
      evidence: loaded.findings.evidence, now,
    });
    const saved = await new SupabasePortfolioDecisionRepository().save(decision, 0, input.commandId);
    refresh(saved.decisionId);
    return { ok: true, message: "Portfolio decision created for review.", decisionId: saved.decisionId, revision: saved.revision };
  } catch (error) { return failure(error); }
}

export async function commandPortfolioDecisionAction(
  input: RouteInput & Readonly<{
    decisionId: string; candidateId: string; commandId: string; commandType: DecisionCommandType;
    expectedRevision: number; selectedAlternativeId?: string; rationale?: string; reviewAt?: string;
  }>,
): Promise<PortfolioDecisionActionResult> {
  try {
    const loaded = await loadCandidate(input);
    if (!loaded) return denied();
    const repository = new SupabasePortfolioDecisionRepository();
    const current = await repository.get(loaded.access.workspaceId, input.decisionId);
    if (!current) return { ok: false, code: "unavailable", message: "Portfolio decision was not found." };
    if (current.activity.some(({ id }) => id.endsWith(`:${input.commandId}`))) {
      return { ok: true, message: `Portfolio decision ${current.status.replaceAll("-", " ")}.`, decisionId: current.decisionId, revision: current.revision };
    }
    const now = (input.now ?? new Date()).toISOString();
    const saved = await applyPortfolioDecisionCommand(repository, current, loaded.candidate, {
      commandId: input.commandId, type: input.commandType, expectedRevision: input.expectedRevision,
      actorProfileId: loaded.access.profileId, actorRole: loaded.access.role, occurredAt: now,
      ...(input.selectedAlternativeId ? { selectedAlternativeId: input.selectedAlternativeId } : {}),
      ...(input.rationale ? { rationale: input.rationale } : {}),
      ...(input.reviewAt ? { reviewAt: input.reviewAt } : {}),
    });
    if (saved.status === "approved") {
      const measurement = createDecisionMeasurementPlan(saved);
      await savePortfolioDecisionMeasurementPlan(
        saved.workspaceId, measurement, saved.evidenceVersion, loaded.access.profileId,
      );
    }
    refresh(saved.decisionId);
    return { ok: true, message: `Portfolio decision ${saved.status.replaceAll("-", " ")}.`, decisionId: saved.decisionId, revision: saved.revision };
  } catch (error) { return failure(error); }
}

async function loadCandidate(input: RouteInput & { candidateId: string }) {
  const context = await requestContext(input.workspaceId);
  if (!context) return null;
  const findingsState = await getPortfolioFindingsRouteState(input);
  if (!findingsState.ok) return null;
  const candidate = getCapitalAllocationCandidates(findingsState.findings).find(({ id }) => id === input.candidateId);
  if (!candidate) throw new PortfolioDecisionError("expired", "The recommendation is no longer active.");
  if (candidate.affectedPropertyIds.some((id) => !findingsState.findings.identity.scope.propertyIds.includes(id))) {
    throw new PortfolioDecisionError("permission", "The recommendation is outside the current authorized property scope.");
  }
  return { ...context, findings: findingsState.findings, candidate };
}
async function requestContext(workspaceId?: string) {
  const { user } = await getSessionProfile();
  if (!user) return null;
  const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, workspaceId);
  return { user, access };
}
function denied(message = "Only an authorized workspace owner may approve capital decisions."): PortfolioDecisionActionResult {
  return { ok: false, code: "permission", message };
}
function failure(error: unknown): PortfolioDecisionActionResult {
  if (error instanceof PortfolioDecisionError) return { ok: false, code: error.code === "invalid-command" ? "evidence" : error.code, message: error.message };
  const message = error instanceof Error && error.message.includes("revision conflict")
    ? "This decision changed while you were reviewing it. Reload the latest version."
    : "The portfolio decision command could not be completed.";
  return { ok: false, code: message.startsWith("This decision") ? "concurrency" : "unavailable", message };
}
function refresh(decisionId: string) {
  revalidatePath("/dashboard/portfolio");
  revalidatePath("/dashboard/portfolio/decisions");
  revalidatePath(`/dashboard/portfolio/decisions/${encodeURIComponent(decisionId)}`);
  revalidatePath("/dashboard/actions");
}
