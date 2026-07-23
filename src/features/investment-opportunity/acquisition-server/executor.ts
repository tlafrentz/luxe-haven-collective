import type { AcquisitionServerCommandResult, AcquisitionServerCommandType } from "./contracts";
import type { AcquisitionServerApplicationDispatcher, TrustedAcquisitionCommandContext } from "./application-dispatcher";
import type { AcquisitionCommandDeploymentRegistry } from "./deployment-registry";
import { mapAcquisitionServerCommandError } from "./error-mapper";
import { parseAcquisitionServerCommand } from "./parsers";
import { acquisitionCommandRevalidationPaths, type AcquisitionCommandRevalidator } from "./revalidation";

export type AcquisitionServerIdentity =
  | Readonly<{ authenticated: false }>
  | Readonly<{ authenticated: true; actor: Readonly<{ type: "user" | "system"; id: string }>; ownerId: string }>;
export interface AcquisitionServerIdentityResolver { resolve(): Promise<AcquisitionServerIdentity>; }
export interface AcquisitionServerCommandAuthorizer {
  authorize(input: Readonly<{ commandType: AcquisitionServerCommandType; actor: Readonly<{ type: "user" | "system"; id: string }>; ownerId: string; opportunityId: string; pipelineId?: string }>): Promise<Readonly<{ allowed: boolean; conceal?: boolean }>>;
}
export interface AcquisitionServerCommandTelemetry {
  record(input: Readonly<{ commandType: AcquisitionServerCommandType; commandId: string; correlationId: string; actorId: string; ownerId: string; opportunityId: string; pipelineId?: string; expectedVersion?: number; status: AcquisitionServerCommandResult["status"]; durationMs: number; replayed: boolean; revalidationTargetCount: number }>): void;
}
export type AcquisitionServerCommandBoundaryDependencies = Readonly<{
  identities: AcquisitionServerIdentityResolver;
  authorization: AcquisitionServerCommandAuthorizer;
  deployment: AcquisitionCommandDeploymentRegistry;
  dispatcher: AcquisitionServerApplicationDispatcher;
  revalidator: AcquisitionCommandRevalidator;
  clock: Readonly<{ now(): Date; monotonicNow(): number }>;
  correlationId: () => string;
  telemetry: AcquisitionServerCommandTelemetry;
}>;

export class AcquisitionServerCommandBoundary {
  public constructor(private readonly dependencies: AcquisitionServerCommandBoundaryDependencies) {}

  public async execute(raw: unknown): Promise<AcquisitionServerCommandResult> {
    const parsed = parseAcquisitionServerCommand(raw);
    if (!parsed.ok) return parsed.result;
    const input = parsed.value;
    const started = this.dependencies.clock.monotonicNow();
    const identity = await this.dependencies.identities.resolve();
    if (!identity.authenticated) return { status: "not-authenticated", code: "ACQUISITION_COMMAND_NOT_AUTHENTICATED" };
    const authorization = await this.dependencies.authorization.authorize({ commandType: input.commandType, actor: identity.actor, ownerId: identity.ownerId, opportunityId: input.envelope.opportunityId, ...(input.envelope.pipelineId ? { pipelineId: input.envelope.pipelineId } : {}) });
    if (!authorization.allowed) return authorization.conceal ? { status: "not-found", code: "ACQUISITION_COMMAND_TARGET_NOT_FOUND" } : { status: "not-authorized", code: "ACQUISITION_COMMAND_NOT_AUTHORIZED" };
    const availability = this.dependencies.deployment[input.commandType];
    if (availability.status !== "enabled") return unavailable(availability.status);
    const commandId = `acquisition-command-${input.envelope.idempotencyKey}`;
    const correlationId = this.dependencies.correlationId();
    const trusted: TrustedAcquisitionCommandContext = { commandId, requestFingerprint: fingerprint(input), actor: identity.actor, ownerId: identity.ownerId, requestedAt: this.dependencies.clock.now() };
    let result: AcquisitionServerCommandResult;
    try {
      const executed = await this.dependencies.dispatcher.execute(input, trusted);
      const paths = acquisitionCommandRevalidationPaths(input.commandType, input.envelope.opportunityId);
      await this.dependencies.revalidator.revalidate(paths);
      result = {
        status: "succeeded",
        data: {
          opportunityId: input.envelope.opportunityId,
          pipelineId: executed.data.pipelineId,
          opportunityVersion: executed.opportunityVersion,
          pipelineVersion: executed.pipelineVersion,
          workspaceState: executed.data.terminal ? "pipeline-terminal" : "pipeline-active",
          stage: executed.data.stage,
          ...(input.commandType === "activate-pipeline" ? { redirectHref: `/dashboard/investments/opportunities/${input.envelope.opportunityId}` } : {}),
        },
        receipt: { commandId: executed.commandId, idempotencyKey: input.envelope.idempotencyKey, outcome: executed.replayed ? "replayed" : "executed" },
        revalidation: { paths },
      };
    } catch (error) {
      result = mapAcquisitionServerCommandError(error, correlationId);
    }
    this.dependencies.telemetry.record({ commandType: input.commandType, commandId, correlationId, actorId: identity.actor.id, ownerId: identity.ownerId, opportunityId: input.envelope.opportunityId, ...(input.envelope.pipelineId ? { pipelineId: input.envelope.pipelineId } : {}), expectedVersion: input.envelope.expectedPipelineVersion ?? input.envelope.expectedOpportunityVersion, status: result.status, durationMs: Math.max(0, this.dependencies.clock.monotonicNow() - started), replayed: result.status === "succeeded" && result.receipt.outcome === "replayed", revalidationTargetCount: result.status === "succeeded" ? result.revalidation.paths.length : 0 });
    return result;
  }
}

export function createAcquisitionServerCommandBoundary(dependencies: AcquisitionServerCommandBoundaryDependencies): AcquisitionServerCommandBoundary {
  return new AcquisitionServerCommandBoundary(dependencies);
}

function unavailable(status: Exclude<AcquisitionCommandDeploymentRegistry[AcquisitionServerCommandType]["status"], "enabled">): AcquisitionServerCommandResult {
  if (status === "not-verified") return { status: "unavailable", code: "ACQUISITION_COMMAND_NOT_VERIFIED", retryable: false };
  if (status === "dependency-unavailable") return { status: "unavailable", code: "ACQUISITION_COMMAND_DEPENDENCY_UNAVAILABLE", retryable: true };
  return { status: "unavailable", code: "ACQUISITION_COMMAND_NOT_DEPLOYED", retryable: false };
}
function fingerprint(value: unknown): string {
  const source = stable(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return `v1:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
  return JSON.stringify(value);
}
