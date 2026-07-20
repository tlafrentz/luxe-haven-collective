import type { ObservationValue } from "../../observations";

export const AUTOMATION_TRIGGER_TYPES = [
  "decision-created",
  "action-completed",
  "workflow-started",
  "workflow-completed",
  "observation-created",
  "schedule",
  "external-event",
  "manual",
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export type PlatformEvent = Readonly<{
  type: AutomationTriggerType;
  name?: string;
  occurredAt: Date;
  data?: Readonly<Record<string, ObservationValue>>;
}>;
export type AutomationTriggerInput = Readonly<{
  type: AutomationTriggerType;
  eventName?: string;
}>;

export class AutomationTrigger {
  public readonly type: AutomationTriggerType;
  public readonly eventName?: string;
  private constructor(input: AutomationTriggerInput) {
    if (!AUTOMATION_TRIGGER_TYPES.includes(input.type)) throw new TypeError("Automation trigger type is invalid.");
    this.type = input.type;
    this.eventName = input.eventName ? text(input.eventName) : undefined;
    Object.freeze(this);
  }
  public static create(input: AutomationTriggerInput): AutomationTrigger { return new AutomationTrigger(input); }
  public matches(event: PlatformEvent): boolean {
    return this.type === event.type && (!this.eventName || this.eventName === event.name?.trim());
  }
}
function text(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError("Automation trigger event name cannot be empty.");
  return normalized;
}
