import { ProductionVerificationError } from "../domain";
import { definitionFingerprint } from "./registration";

export type VerificationIdentityRegistration = { opaqueAuthSubjectReference: string; identityTypeCode: string; tenantId?: string; customerAccountId?: string; allowedScenarioCodes: readonly string[]; expiresAt: Date; fixtureOwnershipCode: string; retentionClassification: "retain" | "cleanup_required" };
export interface ControlledIdentityRegistrationRepository { resolveAuthSubject(reference: string): Promise<{ actorId: string; active: boolean; roles: readonly string[]; tenantIds: readonly string[] } | null>; find(reference: string): Promise<{ fingerprint: string } | null>; register(input: VerificationIdentityRegistration & { fingerprint: string }, actorId: string, correlationId: string): Promise<void>; }
export interface IdentityRegistrationAuthorization { authorize(actorId: string): Promise<boolean>; }

export class RegisterControlledVerificationIdentity {
  constructor(private auth: IdentityRegistrationAuthorization, private repository: ControlledIdentityRegistrationRepository) {}
  async execute(input: { actorId: string; identity: VerificationIdentityRegistration; correlationId: string }) {
    if (!(await this.auth.authorize(input.actorId))) throw new ProductionVerificationError("IDENTITY_REGISTRATION_NOT_AUTHORIZED");
    if (input.identity.expiresAt <= new Date()) throw new ProductionVerificationError("CONTROLLED_IDENTITY_INELIGIBLE");
    const subject = await this.repository.resolveAuthSubject(input.identity.opaqueAuthSubjectReference);
    if (!subject?.active || (input.identity.tenantId && !subject.tenantIds.includes(input.identity.tenantId))) throw new ProductionVerificationError("CONTROLLED_IDENTITY_NOT_AUTHORITATIVE");
    const fingerprint=definitionFingerprint({ ...input.identity, expiresAt: input.identity.expiresAt.toISOString(), allowedScenarioCodes: [...input.identity.allowedScenarioCodes].sort() });
    const existing = await this.repository.find(input.identity.opaqueAuthSubjectReference);
    if (existing) { if (existing.fingerprint !== fingerprint) throw new ProductionVerificationError("CONTROLLED_IDENTITY_DRIFT"); return Object.freeze({ registered: false, fingerprint }); }
    await this.repository.register({ ...input.identity, fingerprint }, input.actorId, input.correlationId); return Object.freeze({ registered: true, fingerprint });
  }
}

export interface ReviewerAuthorization { resolve(actorId: string): Promise<{ active: boolean; roles: readonly string[] } | null>; }
export async function authorizeReviewer(authority: ReviewerAuthorization, reviewerId: string, verifierId: string) {
  const reviewer = await authority.resolve(reviewerId);
  if (!reviewer?.active || !reviewer.roles.includes("release_reviewer")) throw new ProductionVerificationError("REVIEWER_NOT_AUTHORIZED");
  if (reviewerId === verifierId) throw new ProductionVerificationError("REVIEWER_SEPARATION_REQUIRED");
  return true;
}
