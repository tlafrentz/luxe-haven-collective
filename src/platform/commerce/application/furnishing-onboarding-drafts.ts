import type { FurnishingActivationContext } from "./furnishing-offers";
import type { FurnishingOnboardingActor, FurnishingOnboardingSession } from "./furnishing-onboarding";

export type FurnishingStep = Readonly<{ id: string; required: readonly string[]; labels: Readonly<Record<string, string>> }>;
export type FurnishingOnboardingSchema = Readonly<{ id: "FS-CONSULT" | "FS-DESIGN"; version: number; steps: readonly FurnishingStep[] }>;
const consult: FurnishingOnboardingSchema = { id: "FS-CONSULT", version: 1, steps: ["service_confirmation", "property_context", "target_guest", "design_direction", "budget", "priority_rooms", "inventory", "consultation_objectives", "scheduling", "reference_materials", "review"].map(id => ({ id, required: id === "service_confirmation" ? ["confirmed"] : [id], labels: { [id]: id.replaceAll("_", " ") } })) };
const design: FurnishingOnboardingSchema = { id: "FS-DESIGN", version: 1, steps: ["service_confirmation", "property_context", "property_basics", "rooms_occupancy", "target_guest", "design_direction", "color_materials", "inventory", "budget_constraints", "timeline", "workspace_requirements", "tv_mounts", "durability", "special_requirements", "file_status", "review"].map(id => ({ id, required: id === "service_confirmation" ? ["confirmed"] : [id], labels: { [id]: id.replaceAll("_", " ") } })) };
export function resolveFurnishingOnboardingSchema(input: Readonly<{ offerId: string; offerVersion: number; schemaVersion: number }>): FurnishingOnboardingSchema | null { if (input.offerVersion !== 1 || input.schemaVersion !== 1) return null; return input.offerId === "FS-CONSULT" ? consult : input.offerId === "FS-DESIGN" ? design : null; }
type DraftValue = string | number | boolean | null;
export type SaveDraftResult = Readonly<{ status: "saved" | "conflict" | "denied" | "invalid"; errors?: readonly string[]; session?: FurnishingOnboardingSession }>;
export interface FurnishingDraftRepository { findSession(id: string): Promise<FurnishingOnboardingSession | null>; saveStep(input: Readonly<{ session: FurnishingOnboardingSession; stepId: string; values: Readonly<Record<string, DraftValue>>; expectedVersion: number; idempotencyKey: string }>): Promise<FurnishingOnboardingSession>; audit(value: Readonly<Record<string, string>>): Promise<void>; }
const sanitize = (value: DraftValue): DraftValue => typeof value === "string" ? value.replace(/[<>]/g, "").trim().slice(0, 2000) : value;
export class SaveFurnishingOnboardingStep {
  constructor(private readonly dependencies: Readonly<{ repository: FurnishingDraftRepository; activation: FurnishingActivationContext; onboardingEnabled: boolean }>) {}
  async execute(input: Readonly<{ actor: FurnishingOnboardingActor; onboardingSessionId: string; stepId: string; expectedVersion: number; values: Readonly<Record<string, DraftValue>>; idempotencyKey: string; correlationId: string }>): Promise<SaveDraftResult> {
    const session = await this.dependencies.repository.findSession(input.onboardingSessionId);
    if (!session || session.customerId !== input.actor.userId || session.tenantId !== input.actor.tenantId) return { status: "denied" };
    if (!["in_progress", "ready_to_submit"].includes(session.status) || !this.dependencies.onboardingEnabled || this.dependencies.activation.globalKillSwitch || this.dependencies.activation.globalState === "disabled" || !this.dependencies.activation.capabilityEnabled) return { status: "denied" };
    if (session.version !== input.expectedVersion) return { status: "conflict", session };
    const schema = resolveFurnishingOnboardingSchema({ offerId: session.offerId, offerVersion: session.offerVersion, schemaVersion: session.schemaVersion }); const step = schema?.steps.find(value => value.id === input.stepId);
    if (!step) return { status: "invalid", errors: ["unsupported_step"] };
    const values = Object.fromEntries(Object.entries(input.values).map(([key, value]) => [key, sanitize(value)])); const errors = step.required.filter(field => values[field] === undefined || values[field] === null || values[field] === "");
    if (input.stepId === "budget" && typeof values.budget === "number" && (values.budget < 0 || values.budget > 10000000)) errors.push("budget_out_of_range");
    if (input.stepId === "reference_materials" && values.reference_material_available === undefined) errors.push("reference_material_available_required");
    if (Object.keys(values).some(key => !step.required.includes(key) && key !== "reference_material_available" && key !== "budget")) errors.push("unsupported_field");
    if (errors.length) return { status: "invalid", errors };
    try { const updated = await this.dependencies.repository.saveStep({ session, stepId: input.stepId, values, expectedVersion: input.expectedVersion, idempotencyKey: input.idempotencyKey }); await this.dependencies.repository.audit({ event: "furnishing_onboarding_step_saved", sessionId: session.id, stepId: input.stepId, correlationId: input.correlationId }); return { status: "saved", session: updated }; } catch { return { status: "conflict", session }; }
  }
}
