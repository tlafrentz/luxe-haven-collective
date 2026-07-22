import { createActionActor, type ActionActor } from "./action-actor";
export const ACTION_SOURCE_TYPES = ["recommendation", "decision", "manual", "automation", "import", "api"] as const;
export type ActionSourceType = (typeof ACTION_SOURCE_TYPES)[number];
export type PlatformActionSource = Readonly<{ type: ActionSourceType; sourceId?: string; capability?: string; externalSystem?: string; recordedAt: Date; recordedBy: ActionActor }>;
export function createActionSource(input: PlatformActionSource): PlatformActionSource {
  if (!ACTION_SOURCE_TYPES.includes(input.type)) throw new TypeError("Action source type is invalid.");
  const sourceId = clean(input.sourceId), capability = clean(input.capability), externalSystem = clean(input.externalSystem);
  if ((input.type === "recommendation" || input.type === "decision") && !sourceId) throw new TypeError(`${input.type} Action sources require a source ID.`);
  const recordedAt = new Date(input.recordedAt); if (Number.isNaN(recordedAt.getTime())) throw new TypeError("Action source date must be valid.");
  return Object.freeze({ type: input.type, ...(sourceId ? { sourceId } : {}), ...(capability ? { capability } : {}), ...(externalSystem ? { externalSystem } : {}), recordedAt, recordedBy: createActionActor(input.recordedBy) });
}
export function actionSourceKey(value: PlatformActionSource): string { return [value.type, value.sourceId ?? "", value.capability ?? "", value.externalSystem ?? ""].join(":"); }
function clean(value?: string): string | undefined { const result = value?.trim(); return result || undefined; }
