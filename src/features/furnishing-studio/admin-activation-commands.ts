import { resolveFurnishingActivation } from "./activation";

export type FurnishingControlTarget = "global" | "workspace" | "cohort" | "capability";
export type FurnishingControlState = "disabled" | "internal" | "limited" | "enabled" | "paused";
export type FurnishingAdminCommand = Readonly<{
  command: string;
  target: FurnishingControlTarget;
  targetId: string;
  state: FurnishingControlState;
  expectedVersion: number;
  reason: string;
  actorId: string;
  actorRole: string;
  tenantId?: string;
  correlationId: string;
  idempotencyKey: string;
}>;
export type FurnishingControlRecord = Readonly<{ target: FurnishingControlTarget; targetId: string; state: FurnishingControlState; version: number; tenantId?: string }>;
export type FurnishingAuditEvent = Readonly<{ actorId: string; command: string; target: string; before: FurnishingControlState; after: FurnishingControlState; reason: string; fromVersion: number; toVersion: number; correlationId: string; idempotencyKey: string; policyVersion: string; occurredAt: string }>;
export type FurnishingCommandResult = Readonly<{ status: "accepted"; record: FurnishingControlRecord; audit: FurnishingAuditEvent }>;
export class FurnishingActivationCommandError extends Error { constructor(public readonly code: "NOT_AUTHORIZED" | "REASON_REQUIRED" | "VERSION_CONFLICT" | "IDEMPOTENCY_CONFLICT" | "TRANSITION_PROHIBITED" | "TARGET_INVALID", message: string) { super(message); this.name = "FurnishingActivationCommandError"; } }

export interface FurnishingActivationCommandRepository {
  read(target: FurnishingControlTarget, targetId: string): Promise<FurnishingControlRecord | null>;
  tenantOwnsTarget(target: FurnishingControlTarget, targetId: string, tenantId?: string): Promise<boolean>;
  findIdempotency(key: string): Promise<Readonly<{ fingerprint: string; result: FurnishingCommandResult }> | null>;
  commit(input: Readonly<{ before: FurnishingControlRecord; after: FurnishingControlRecord; audit: FurnishingAuditEvent; fingerprint: string }>): Promise<void>;
}

const fingerprint = (command: FurnishingAdminCommand) => JSON.stringify({ command: command.command, target: command.target, targetId: command.targetId, state: command.state, expectedVersion: command.expectedVersion, reason: command.reason, tenantId: command.tenantId });
const allowedState = (state: FurnishingControlState) => state !== "enabled";

/** Canonical server-side mutation boundary for FS-008A activation controls. */
export async function executeFurnishingActivationCommand(repository: FurnishingActivationCommandRepository, command: FurnishingAdminCommand, now = () => new Date()): Promise<FurnishingCommandResult> {
  if (command.actorRole !== "admin" || !command.actorId) throw new FurnishingActivationCommandError("NOT_AUTHORIZED", "Authorized Admin is required.");
  if (!command.reason.trim()) throw new FurnishingActivationCommandError("REASON_REQUIRED", "A reason is required.");
  if (!command.targetId || !command.correlationId || !command.idempotencyKey) throw new FurnishingActivationCommandError("TARGET_INVALID", "Canonical target and idempotency identifiers are required.");
  if (!allowedState(command.state)) throw new FurnishingActivationCommandError("TRANSITION_PROHIBITED", "The FS-008A safe ceiling prohibits public activation.");
  if (!await repository.tenantOwnsTarget(command.target, command.targetId, command.tenantId)) throw new FurnishingActivationCommandError("TARGET_INVALID", "The target is not in the authorized tenant scope.");
  const key = await repository.findIdempotency(command.idempotencyKey), hash = fingerprint(command);
  if (key) { if (key.fingerprint !== hash) throw new FurnishingActivationCommandError("IDEMPOTENCY_CONFLICT", "The idempotency key was reused with different input."); return key.result; }
  const before = await repository.read(command.target, command.targetId);
  if (!before || before.version !== command.expectedVersion) throw new FurnishingActivationCommandError("VERSION_CONFLICT", "The activation control changed; reload and retry.");
  const after = Object.freeze({ ...before, state: command.state, version: before.version + 1 });
  const audit: FurnishingAuditEvent = Object.freeze({ actorId: command.actorId, command: command.command, target: `${command.target}:${command.targetId}`, before: before.state, after: after.state, reason: command.reason.trim(), fromVersion: before.version, toVersion: after.version, correlationId: command.correlationId, idempotencyKey: command.idempotencyKey, policyVersion: "fs008a-v1", occurredAt: now().toISOString() });
  const result = Object.freeze({ status: "accepted" as const, record: after, audit });
  await repository.commit({ before, after, audit, fingerprint: hash });
  return result;
}

export function furnishingActivationDecisionForControls() { return resolveFurnishingActivation({ globalKillSwitch: true, globalState: "disabled", workspaceKillSwitch: false, workspaceEnabled: false, cohortEligible: false, capabilityEnabled: false, configurationValid: true, policyVersion: "fs008a-v1" }); }
