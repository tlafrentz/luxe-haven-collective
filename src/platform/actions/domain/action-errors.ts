import { PlatformError } from "../../kernel";

class ActionDomainError extends PlatformError {
  protected constructor(code: string, message: string, metadata?: Readonly<Record<string, unknown>>) {
    super(code, message, { metadata });
    Object.freeze(this);
  }
}
export class InvalidActionTransition extends ActionDomainError {
  public constructor(from: string, to: string) { super("INVALID_ACTION_TRANSITION", `Cannot transition Action from "${from}" to "${to}".`, { from, to }); }
}
export class InvalidActionVersion extends ActionDomainError {
  public constructor(version: number) { super("INVALID_ACTION_VERSION", "Action version must be a positive integer.", { version }); }
}
export class MissingActionSource extends ActionDomainError {
  public constructor() { super("MISSING_ACTION_SOURCE", "At least one Action source is required."); }
}
export class DuplicateActionSource extends ActionDomainError {
  public constructor(key: string) { super("DUPLICATE_ACTION_SOURCE", "Duplicate Action source references are not allowed.", { key }); }
}
export class InvalidActionSchedule extends ActionDomainError {
  public constructor(message: string) { super("INVALID_ACTION_SCHEDULE", message); }
}
export class ActionAlreadyAssigned extends ActionDomainError {
  public constructor() { super("ACTION_ALREADY_ASSIGNED", "Action already has an active assignment."); }
}
export class NoActiveAssignment extends ActionDomainError {
  public constructor() { super("NO_ACTIVE_ASSIGNMENT", "Action has no active assignment."); }
}
export class InvalidAssignmentClaim extends ActionDomainError {
  public constructor() { super("INVALID_ASSIGNMENT_CLAIM", "Only an active queued or assigned Action assignment may be claimed."); }
}
export class DuplicateOutcomeReference extends ActionDomainError {
  public constructor(outcomeId: string) { super("DUPLICATE_OUTCOME_REFERENCE", "Outcome is already linked to this Action.", { outcomeId }); }
}
export class ActionAlreadyArchived extends ActionDomainError {
  public constructor() { super("ACTION_ALREADY_ARCHIVED", "Archived Actions cannot be changed."); }
}
export class WorkspaceScopeViolation extends ActionDomainError {
  public constructor() { super("WORKSPACE_SCOPE_VIOLATION", "Command workspace does not match the Action workspace."); }
}
