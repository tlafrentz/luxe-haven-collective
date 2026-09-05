import { createActionActor, type ActionActor } from "./action-actor";
export const ACTION_SOURCE_TYPES = ["recommendation", "decision", "manual", "automation", "import", "api"] as const;
export type ActionSourceType = (typeof ACTION_SOURCE_TYPES)[number];
// NOTE (AUTH-012 Phase 1): sourceModule/requiredPrivilege are additive,
// in-memory-only metadata for now. public.platform_action_sources has no
// matching columns, and SupabasePlatformActionRepository / action-persistence-mapper.ts
// only read/write source_type, source_id, capability, external_system,
// recorded_at, recorded_by_type, recorded_by_id -- so these two fields are
// silently dropped on save and will NOT come back after a reload from
// Supabase until a future migration adds matching columns. A future Phase 3
// (enforcement) must not assume these survive a save/reload round-trip.
// requiredPrivilege is typed as `string` rather than the platform-access
// feature's `PrivilegeId` union: platform packages are architecturally
// forbidden from importing anything from the features layer (enforced by
// automated guard tests with no exception mechanism), and `PrivilegeId` is
// itself just a string-literal union, so this is functionally equivalent
// for callers that pass a real privilege identifier.
export type PlatformActionSource = Readonly<{ type: ActionSourceType; sourceId?: string; capability?: string; externalSystem?: string; sourceModule?: string; requiredPrivilege?: string; recordedAt: Date; recordedBy: ActionActor }>;
export function createActionSource(input: PlatformActionSource): PlatformActionSource {
  if (!ACTION_SOURCE_TYPES.includes(input.type)) throw new TypeError("Action source type is invalid.");
  const sourceId = clean(input.sourceId), capability = clean(input.capability), externalSystem = clean(input.externalSystem);
  const sourceModule = clean(input.sourceModule), requiredPrivilege = clean(input.requiredPrivilege);
  if ((input.type === "recommendation" || input.type === "decision") && !sourceId) throw new TypeError(`${input.type} Action sources require a source ID.`);
  if (input.sourceModule !== undefined && !sourceModule) throw new TypeError("Action source module must be a non-empty string when provided.");
  if (input.requiredPrivilege !== undefined && !requiredPrivilege) throw new TypeError("Action source required privilege must be a non-empty string when provided.");
  const recordedAt = new Date(input.recordedAt); if (Number.isNaN(recordedAt.getTime())) throw new TypeError("Action source date must be valid.");
  return Object.freeze({ type: input.type, ...(sourceId ? { sourceId } : {}), ...(capability ? { capability } : {}), ...(externalSystem ? { externalSystem } : {}), ...(sourceModule ? { sourceModule } : {}), ...(requiredPrivilege ? { requiredPrivilege } : {}), recordedAt, recordedBy: createActionActor(input.recordedBy) });
}
export function actionSourceKey(value: PlatformActionSource): string { return [value.type, value.sourceId ?? "", value.capability ?? "", value.externalSystem ?? ""].join(":"); }
function clean(value?: string): string | undefined { const result = value?.trim(); return result || undefined; }
