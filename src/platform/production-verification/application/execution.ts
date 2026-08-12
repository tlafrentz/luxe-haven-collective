import { ProductionVerificationError, VerificationScenarioInstance } from "../domain";
import { VERIFICATION_SCENARIOS } from "../domain/registry";

export type ControlledIdentity = { id: string; environmentCode: "production"; identityTypeCode: string; allowedScenarioCodes: readonly string[]; status: "active" | "reserved" | "retired"; expiresAt?: Date };
export interface VerificationAuthorization { authorize(actorId: string, operation: string): Promise<{ allowed: boolean; roles: readonly string[] }>; }
export interface VerificationAttemptRepository { hasActiveAttempt(instanceId: string): Promise<boolean>; findAttemptByIdempotencyHash(hash: string): Promise<{ id: string } | null>; createAttempt(input: { instanceId: string; executorCode: string; actorId: string; correlationId: string; idempotencyKeyHash: string }): Promise<{ id: string }>; }
export interface VerificationExecutorPort { execute(executorCode: string, input: { runId: string; scenarioInstanceId: string; controlledIdentityId: string; correlationId: string }): Promise<{ stableResultCode: string }> }

export class ExecuteVerificationScenario {
  constructor(private auth: VerificationAuthorization, private attempts: VerificationAttemptRepository, private executors: VerificationExecutorPort) {}
  async execute(input: { actorId: string; runId: string; instance: VerificationScenarioInstance; identity: ControlledIdentity; completedScenarioCodes: readonly string[]; correlationId: string; idempotencyKeyHash: string }) {
    const definition = VERIFICATION_SCENARIOS.find(s => s.code === input.instance.scenarioCode && s.version === input.instance.scenarioVersion);
    if (!definition || definition.status !== "active") throw new ProductionVerificationError("SCENARIO_NOT_REGISTERED");
    const authorization = await this.auth.authorize(input.actorId, "production_verification.execute");
    if (!authorization.allowed || !definition.requiredIdentityRoles.some(role => authorization.roles.includes(role))) throw new ProductionVerificationError("VERIFIER_NOT_AUTHORIZED");
    if (input.identity.environmentCode !== "production" || input.identity.status !== "active" || (input.identity.expiresAt && input.identity.expiresAt <= new Date())) throw new ProductionVerificationError("CONTROLLED_IDENTITY_INELIGIBLE");
    if (!input.identity.allowedScenarioCodes.includes(definition.code)) throw new ProductionVerificationError("CONTROLLED_IDENTITY_SCENARIO_DENIED");
    if (definition.prerequisiteScenarioCodes.some(code => !input.completedScenarioCodes.includes(code))) throw new ProductionVerificationError("SCENARIO_PREREQUISITE_MISSING");
    const prior = await this.attempts.findAttemptByIdempotencyHash(input.idempotencyKeyHash); if (prior) return { attemptId: prior.id, duplicate: true };
    if (await this.attempts.hasActiveAttempt(input.instance.id)) throw new ProductionVerificationError("SCENARIO_ATTEMPT_ACTIVE");
    const attempt = await this.attempts.createAttempt({ instanceId: input.instance.id, executorCode: definition.executorCode, actorId: input.actorId, correlationId: input.correlationId, idempotencyKeyHash: input.idempotencyKeyHash });
    const result = await this.executors.execute(definition.executorCode, { runId: input.runId, scenarioInstanceId: input.instance.id, controlledIdentityId: input.identity.id, correlationId: input.correlationId });
    return { attemptId: attempt.id, duplicate: false, stableResultCode: result.stableResultCode };
  }
}
