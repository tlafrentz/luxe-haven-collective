import type { CanonicalWorkspaceHealth } from "@/features/workspace";

export type SetupStepId = "workspace" | "connect" | "import" | "team";

export type SetupStepDefinition = {
  id: SetupStepId;
  label: string;
  /**
   * Health task codes that must be complete for this step to be satisfied.
   * A step is also satisfied if its id is present in skippedSteps, which
   * this app uses both for genuinely optional steps (team) and for steps
   * whose only path in this pass is a manual acknowledgement rather than a
   * live health signal (connect - no real PMS OAuth exists yet).
   */
  taskCodes: readonly string[];
  href: string;
  optional?: boolean;
};

export const SETUP_STEPS: readonly SetupStepDefinition[] = [
  { id: "workspace", label: "Workspace", taskCodes: ["organization_required"], href: "/dashboard/setup/workspace" },
  { id: "connect", label: "Connect Properties", taskCodes: [], href: "/dashboard/setup/connect" },
  { id: "import", label: "Import Properties", taskCodes: ["property_included"], href: "/dashboard/setup/import" },
  { id: "team", label: "Invite Team", taskCodes: [], optional: true, href: "/dashboard/setup/team" },
];

export type SetupStepProgress = SetupStepDefinition & { complete: boolean; skipped: boolean };

export type SetupProgress = {
  steps: readonly SetupStepProgress[];
  currentIndex: number;
  currentStep: SetupStepProgress | null;
  allComplete: boolean;
  completionPercent: number;
};

export function computeSetupProgress(
  health: CanonicalWorkspaceHealth,
  skippedSteps: readonly string[],
): SetupProgress {
  const taskByCode = new Map(health.onboarding.tasks.map((task) => [task.code, task]));
  const steps: SetupStepProgress[] = SETUP_STEPS.map((step) => {
    const skipped = skippedSteps.includes(step.id);
    // A step with no health task codes (connect, team) can only be driven by an
    // explicit user action recorded in skippedSteps — an empty task list must
    // never be treated as vacuously "already complete".
    const tasksComplete =
      step.taskCodes.length > 0 && step.taskCodes.every((code) => taskByCode.get(code)?.complete ?? false);
    const complete = skipped || tasksComplete;
    return { ...step, complete, skipped };
  });
  const currentIndex = steps.findIndex((step) => !step.complete);
  const allComplete = currentIndex === -1;
  const completionPercent = Math.round(
    (steps.filter((step) => step.complete).length / steps.length) * 100,
  );
  return {
    steps,
    currentIndex,
    currentStep: allComplete ? null : steps[currentIndex],
    allComplete,
    completionPercent,
  };
}

export function isStepReachable(stepId: SetupStepId, progress: SetupProgress): boolean {
  const index = SETUP_STEPS.findIndex((step) => step.id === stepId);
  if (index === -1) return false;
  if (progress.allComplete) return true;
  return index <= progress.currentIndex;
}
