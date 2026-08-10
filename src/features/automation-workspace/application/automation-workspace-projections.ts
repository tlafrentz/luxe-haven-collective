import type {
  AutomationApproval,
  AutomationDefinition,
  AutomationDefinitionStatus,
  AutomationDefinitionVersion,
  AutomationRun,
  AutomationRunStep,
} from "@/platform/automations";

export type AutomationExperienceCommandType =
  | "create-draft"
  | "validate-draft"
  | "submit-review"
  | "activate"
  | "pause"
  | "resume"
  | "retire"
  | "manual-run"
  | "approve"
  | "reject"
  | "defer"
  | "request-revision"
  | "cancel"
  | "retry"
  | "reconcile"
  | "open-approval";
export type AutomationExperienceCommand = Readonly<{
  type: AutomationExperienceCommandType;
  label: string;
  consequence: string;
  targetId: string;
  expectedVersion: number;
  confirmationRequired: boolean;
  reason: Readonly<{
    required: boolean;
    minimumLength: number;
    maximumLength: number;
  }>;
  createsApproval: boolean;
  idempotencyRequired: boolean;
}>;
export type ProjectionNotice = Readonly<{
  classification: "partial" | "stale" | "unavailable" | "restricted";
  message: string;
}>;
export type AutomationListItem = Readonly<{
  id: string;
  name: string;
  description: string;
  scopeLabel: string;
  propertyIds: readonly string[];
  currentVersion: number;
  aggregateVersion: number;
  status: AutomationDefinitionStatus;
  trigger: string;
  ownerId: string;
  templateOrigin?: string;
  attention: "none" | "review" | "paused";
  href: string;
  validCommands: readonly AutomationExperienceCommand[];
}>;
export type AutomationRunItem = Readonly<{
  id: string;
  automationId: string;
  definitionVersion: number;
  status: AutomationRun["status"];
  propertyIds: readonly string[];
  updatedAt: string;
  progress: Readonly<{ complete: number; total: number }>;
  outcome: string;
  attention: "none" | "failed" | "uncertain" | "approval";
  href: string;
  validCommands: readonly AutomationExperienceCommand[];
}>;
export type AutomationApprovalItem = Readonly<{
  id: string;
  runId: string;
  status: AutomationApproval["status"];
  requestedAt: string;
  expiresAt: string;
  automationId: string;
  consequence: string;
  href: string;
  validCommands: readonly AutomationExperienceCommand[];
}>;
export type AutomationTemplate = Readonly<{
  id: string;
  version: number;
  name: string;
  purpose: string;
  scope: string;
  trigger: string;
  steps: readonly string[];
  approval: string;
  prerequisites: readonly string[];
  available: boolean;
}>;
export type AutomationWorkspaceProjection = Readonly<{
  projectionVersion: "au001d-workspace.v1";
  generatedAt: string;
  freshness: "current" | "stale" | "partial";
  scope: Readonly<{
    tenantId: string;
    propertyIds: readonly string[];
    label: string;
    timeZone: string;
  }>;
  notices: readonly ProjectionNotice[];
  counts: Readonly<{
    active: number;
    paused: number;
    draft: number;
    attention: number;
    approvals: number;
    running: number;
    failed: number;
    reconciliation: number;
  }>;
  automations: readonly AutomationListItem[];
  approvals: readonly AutomationApprovalItem[];
  runs: readonly AutomationRunItem[];
  templates: readonly AutomationTemplate[];
}>;

export function projectAutomationWorkspace(
  input: Readonly<{
    tenantId: string;
    propertyIds: readonly string[];
    scopeLabel: string;
    timeZone: string;
    definitions: readonly Readonly<{
      definition: AutomationDefinition;
      current: AutomationDefinitionVersion;
    }>[];
    runs: readonly Readonly<{
      run: AutomationRun;
      steps: readonly AutomationRunStep[];
    }>[];
    approvals: readonly Readonly<{
      approval: AutomationApproval;
      automationId: string;
    }>[];
    generatedAt: string;
    notices?: readonly ProjectionNotice[];
  }>,
): AutomationWorkspaceProjection {
  const allowed = new Set(input.propertyIds);
  const definitions = input.definitions
    .filter(({ current }) =>
      current.configuration.scope.propertyIds.every((id) => allowed.has(id)),
    )
    .map(projectDefinition);
  const runs = input.runs
    .filter(({ run }) => run.propertyIds.every((id) => allowed.has(id)))
    .map(({ run, steps }) => projectRun(run, steps));
  const visibleRunIds = new Set(runs.map(({ id }) => id));
  const approvals = input.approvals
    .filter(({ approval }) => visibleRunIds.has(approval.runId))
    .map(({ approval, automationId }) =>
      projectApproval(approval, automationId, input.generatedAt),
    );
  const notices = Object.freeze([...(input.notices ?? [])]);
  return Object.freeze({
    projectionVersion: "au001d-workspace.v1",
    generatedAt: input.generatedAt,
    freshness: notices.some(({ classification }) => classification === "stale")
      ? "stale"
      : notices.length
        ? "partial"
        : "current",
    scope: Object.freeze({
      tenantId: input.tenantId,
      propertyIds: Object.freeze([...input.propertyIds]),
      label: input.scopeLabel,
      timeZone: input.timeZone,
    }),
    notices,
    counts: Object.freeze({
      active: definitions.filter(({ status }) => status === "active").length,
      paused: definitions.filter(({ status }) => status === "paused").length,
      draft: definitions.filter(
        ({ status }) => status === "draft" || status === "ready-for-review",
      ).length,
      attention:
        definitions.filter(({ attention }) => attention !== "none").length +
        runs.filter(({ attention }) => attention !== "none").length,
      approvals: approvals.filter(({ status }) => status === "pending").length,
      running: runs.filter(({ status }) =>
        ["queued", "running"].includes(status),
      ).length,
      failed: runs.filter(({ status }) => status === "failed").length,
      reconciliation: runs.filter(({ attention }) => attention === "uncertain")
        .length,
    }),
    automations: Object.freeze(definitions),
    approvals: Object.freeze(approvals),
    runs: Object.freeze(runs),
    templates: AUTOMATION_TEMPLATES,
  });
}

export function projectDefinition(
  value: Readonly<{
    definition: AutomationDefinition;
    current: AutomationDefinitionVersion;
  }>,
): AutomationListItem {
  const { definition, current } = value;
  return Object.freeze({
    id: definition.id,
    name: current.name,
    description: current.description,
    scopeLabel: scopeLabel(current),
    propertyIds: current.configuration.scope.propertyIds,
    currentVersion: definition.currentVersion,
    aggregateVersion: definition.version,
    status: definition.status,
    trigger: `${current.configuration.trigger.kind} · ${current.configuration.trigger.sourceCapability}`,
    ownerId: current.configuration.ownerId,
    ...(current.templateOrigin
      ? { templateOrigin: current.templateOrigin }
      : {}),
    attention:
      definition.status === "ready-for-review"
        ? "review"
        : definition.status === "paused"
          ? "paused"
          : "none",
    href: `/dashboard/automations/definitions/${encodeURIComponent(definition.id)}`,
    validCommands: definitionCommands(definition),
  });
}

export function projectRun(
  run: AutomationRun,
  steps: readonly AutomationRunStep[],
): AutomationRunItem {
  const complete = steps.filter(({ status }) =>
    ["succeeded", "skipped", "compensated", "cancelled"].includes(status),
  ).length;
  const uncertain =
    run.status === "reconciliation_required" ||
    steps.some(({ status }) =>
      ["reconciliation_required", "reconciling"].includes(status),
    );
  const failed =
    run.status === "failed" ||
    steps.some(({ status }) => status === "failed_terminal");
  return Object.freeze({
    id: run.id,
    automationId: run.automationDefinitionId,
    definitionVersion: run.automationDefinitionVersion,
    status: run.status,
    propertyIds: run.propertyIds,
    updatedAt: run.updatedAt,
    progress: Object.freeze({ complete, total: steps.length }),
    outcome: uncertain
      ? "Outcome must be reconciled"
      : failed
        ? "Command failed"
        : run.status === "succeeded"
          ? "Command completed"
          : "Execution in progress",
    attention: uncertain
      ? "uncertain"
      : failed
        ? "failed"
        : run.status === "awaiting_approval"
          ? "approval"
          : "none",
    href: `/dashboard/automations/runs/${encodeURIComponent(run.id)}`,
    validCommands: runCommands(run, steps),
  });
}

export function projectApproval(
  approval: AutomationApproval,
  automationId: string,
  now: string,
): AutomationApprovalItem {
  const actionable =
    approval.status === "pending" &&
    Date.parse(approval.expiresAt) > Date.parse(now);
  return Object.freeze({
    id: approval.id,
    runId: approval.runId,
    status: actionable
      ? approval.status
      : approval.status === "pending"
        ? "expired"
        : approval.status,
    requestedAt: approval.requestedAt,
    expiresAt: approval.expiresAt,
    automationId,
    consequence:
      "Authorizing permits the governed command to continue; it does not approve the underlying business decision.",
    href: `/dashboard/automations/approvals/${encodeURIComponent(approval.id)}`,
    validCommands: actionable
      ? Object.freeze([
          command(
            "approve",
            "Approve request",
            approval.id,
            approval.version,
            true,
            false,
          ),
          command(
            "reject",
            "Reject request",
            approval.id,
            approval.version,
            true,
            true,
          ),
          command(
            "defer",
            "Defer request",
            approval.id,
            approval.version,
            true,
            true,
          ),
          command(
            "request-revision",
            "Request revision",
            approval.id,
            approval.version,
            true,
            true,
          ),
        ])
      : Object.freeze([]),
  });
}

function definitionCommands(
  definition: AutomationDefinition,
): readonly AutomationExperienceCommand[] {
  const values: AutomationExperienceCommand[] = [];
  if (definition.status === "draft")
    values.push(
      command(
        "validate-draft",
        "Validate draft",
        definition.id,
        definition.version,
        false,
        false,
      ),
      command(
        "submit-review",
        "Submit for review",
        definition.id,
        definition.version,
        true,
        false,
      ),
    );
  if (definition.status === "ready-for-review")
    values.push(
      command(
        "activate",
        "Activate version",
        definition.id,
        definition.version,
        true,
        false,
      ),
    );
  if (definition.status === "active")
    values.push(
      command(
        "manual-run",
        "Create manual run",
        definition.id,
        definition.version,
        true,
        false,
        true,
      ),
      command(
        "pause",
        "Pause automation",
        definition.id,
        definition.version,
        true,
        true,
      ),
    );
  if (definition.status === "paused")
    values.push(
      command(
        "resume",
        "Resume automation",
        definition.id,
        definition.version,
        true,
        true,
      ),
      command(
        "retire",
        "Retire automation",
        definition.id,
        definition.version,
        true,
        true,
      ),
    );
  return Object.freeze(values);
}
function runCommands(
  run: AutomationRun,
  steps: readonly AutomationRunStep[],
): readonly AutomationExperienceCommand[] {
  const values: AutomationExperienceCommand[] = [];
  if (["approved", "queued", "running"].includes(run.status))
    values.push(
      command("cancel", "Cancel run", run.id, run.version, true, true),
    );
  if (steps.some(({ status }) => status === "failed_retryable"))
    values.push(
      command("retry", "Schedule safe retry", run.id, run.version, true, false),
    );
  if (steps.some(({ status }) => status === "reconciliation_required"))
    values.push(
      command(
        "reconcile",
        "Reconcile outcome",
        run.id,
        run.version,
        true,
        false,
      ),
    );
  if (run.status === "awaiting_approval" && run.approvalId)
    values.push(
      command(
        "open-approval",
        "Open approval",
        run.approvalId,
        run.version,
        false,
        false,
      ),
    );
  return Object.freeze(values);
}
function command(
  type: AutomationExperienceCommandType,
  label: string,
  targetId: string,
  expectedVersion: number,
  confirmationRequired: boolean,
  reasonRequired: boolean,
  createsApproval = false,
): AutomationExperienceCommand {
  return Object.freeze({
    type,
    label,
    consequence: consequence(type),
    targetId,
    expectedVersion,
    confirmationRequired,
    reason: Object.freeze({
      required: reasonRequired,
      minimumLength: reasonRequired ? 3 : 0,
      maximumLength: 500,
    }),
    createsApproval,
    idempotencyRequired: true,
  });
}
function consequence(type: AutomationExperienceCommandType) {
  return (
    {
      "create-draft": "Creates a new customer-owned draft.",
      "validate-draft":
        "Validates the immutable candidate without activating it.",
      "submit-review": "Moves this version into review.",
      activate:
        "Activates this immutable version for future eligible occurrences.",
      pause: "Stops future run creation without changing historical runs.",
      resume: "Allows future eligible occurrences again.",
      retire: "Permanently ends future use of this automation.",
      "manual-run":
        "Creates a governed run request; it does not bypass approval.",
      approve: "Authorizes the exact requested automation command.",
      reject: "Rejects the current request.",
      defer: "Defers the current request.",
      "request-revision": "Returns the request for revision.",
      cancel:
        "Requests cancellation; accepted external work may require reconciliation.",
      retry:
        "Schedules the same logical command only after retry safety is proven.",
      reconcile:
        "Queries the owning capability for the original command outcome.",
      "open-approval": "Opens the required approval request.",
    } as const
  )[type];
}
function scopeLabel(version: AutomationDefinitionVersion) {
  const count = version.configuration.scope.propertyIds.length;
  return version.configuration.scope.type === "portfolio" ||
    version.configuration.scope.type === "organization"
    ? "Authorized portfolio"
    : `${count} propert${count === 1 ? "y" : "ies"}`;
}

export const AUTOMATION_TEMPLATES: readonly AutomationTemplate[] =
  Object.freeze([
    {
      id: "execute-follow-up",
      version: 1,
      name: "Decision follow-up",
      purpose: "Create governed Execute follow-up after an approved decision.",
      scope: "Property or selected properties",
      trigger: "Canonical decision event",
      steps: Object.freeze(["Create draft action plan"]),
      approval: "Policy evaluated before run",
      prerequisites: Object.freeze([
        "Execute capability",
        "Authorized decision source",
      ]),
      available: true,
    },
    {
      id: "measurement-reminder",
      version: 1,
      name: "Measurement reminder",
      purpose: "Create review work when an outcome measurement window opens.",
      scope: "Property",
      trigger: "Canonical measurement state change",
      steps: Object.freeze(["Create measurement follow-up"]),
      approval: "No external mutation",
      prerequisites: Object.freeze(["Outcome Measurement capability"]),
      available: true,
    },
  ]);
