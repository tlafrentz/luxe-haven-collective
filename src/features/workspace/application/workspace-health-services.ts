import { buildWorkspaceHealth, type CanonicalWorkspaceHealth, type WorkspaceReadinessInput } from "../domain/health-onboarding";
export function evaluateWorkspaceReadiness(input: WorkspaceReadinessInput, now?: Date): CanonicalWorkspaceHealth { return buildWorkspaceHealth(input, now); }
export function getWorkspaceSetupChecklist(health: CanonicalWorkspaceHealth) { return health.onboarding.tasks; }
export function getWorkspaceCapabilityAvailability(health: CanonicalWorkspaceHealth) { return health.capabilities; }
export function getWorkspaceNextActions(health: CanonicalWorkspaceHealth) { return health.nextActions; }
export function completeWorkspaceReadinessReviewAllowed(health: CanonicalWorkspaceHealth) { return health.onboarding.requiredCompleted === health.onboarding.requiredTotal && health.status !== "blocked" && health.status !== "degraded"; }
