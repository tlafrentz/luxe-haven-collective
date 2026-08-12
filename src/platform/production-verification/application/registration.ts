import { createHash } from "node:crypto";
import { CA001F_PLAN, MANUAL_OBSERVATION_DEFINITIONS, VERIFICATION_CLEANUP_POLICIES, VERIFICATION_EVIDENCE_DEFINITIONS, VERIFICATION_GATE_POLICIES, VERIFICATION_RETRY_POLICIES, VERIFICATION_SCENARIOS, VERIFICATION_TIMEOUT_POLICIES } from "../domain/registry";
import { ProductionVerificationError } from "../domain";

export type PublishedDefinition = { kind: string; code: string; version: number; fingerprint: string; definition: Readonly<Record<string, unknown>> };
export interface VerificationDefinitionRepository { find(kind: string, code: string, version: number): Promise<{ fingerprint: string; status: string } | null>; publish(definition: PublishedDefinition, actorId: string, correlationId: string): Promise<void>; }
export interface DefinitionRegistrationAuthorization { authorizeRegistration(actorId: string): Promise<boolean>; }

function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`; return JSON.stringify(value); }
export function definitionFingerprint(value: unknown) { return createHash("sha256").update(canonical(value)).digest("hex"); }

export function productionDefinitions(): readonly PublishedDefinition[] {
  const values: Array<readonly [string, { code: string; version: number } & Record<string, unknown>]> = [
    ["plan", CA001F_PLAN], ...VERIFICATION_SCENARIOS.map(v => ["scenario", v] as const), ...VERIFICATION_EVIDENCE_DEFINITIONS.map(v => ["evidence", v] as const),
    ...VERIFICATION_RETRY_POLICIES.map(v => ["retry_policy", v] as const), ...VERIFICATION_TIMEOUT_POLICIES.map(v => ["timeout_policy", v] as const),
    ...VERIFICATION_CLEANUP_POLICIES.map(v => ["cleanup_policy", v] as const), ...VERIFICATION_GATE_POLICIES.map(v => ["gate_policy", v] as const),
    ...MANUAL_OBSERVATION_DEFINITIONS.map(v => ["manual_observation", v] as const),
  ];
  return Object.freeze(values.map(([kind, definition]) => Object.freeze({ kind, code: definition.code, version: definition.version, fingerprint: definitionFingerprint(definition), definition: Object.freeze({ ...definition }) })));
}

export class RegisterProductionVerificationDefinitions {
  constructor(private authorization: DefinitionRegistrationAuthorization, private repository: VerificationDefinitionRepository) {}
  async execute(input: { actorId: string; environmentCode: "production"; correlationId: string }) {
    if (input.environmentCode !== "production" || !(await this.authorization.authorizeRegistration(input.actorId))) throw new ProductionVerificationError("REGISTRY_REGISTRATION_NOT_AUTHORIZED");
    let created = 0, unchanged = 0;
    for (const definition of productionDefinitions()) {
      const existing = await this.repository.find(definition.kind, definition.code, definition.version);
      if (existing) { if (existing.fingerprint !== definition.fingerprint || existing.status !== "active") throw new ProductionVerificationError("PRODUCTION_REGISTRY_DRIFT"); unchanged++; continue; }
      await this.repository.publish(definition, input.actorId, input.correlationId); created++;
    }
    return Object.freeze({ created, unchanged, fingerprint: definitionFingerprint(productionDefinitions().map(({ kind, code, version, fingerprint }) => ({ kind, code, version, fingerprint }))) });
  }
}
