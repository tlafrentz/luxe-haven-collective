import { InvalidActionSchedule } from "./action-errors";
export type PlatformActionSchedule = Readonly<{ created: Date; scheduled?: Date; startAfter?: Date; due?: Date; completed?: Date }>;
export function createActionSchedule(input: PlatformActionSchedule): PlatformActionSchedule {
  const created = date(input.created, "Action schedule creation date");
  const scheduled = optional(input.scheduled, "Action scheduled date"), startAfter = optional(input.startAfter, "Action start-after date"), due = optional(input.due, "Action due date"), completed = optional(input.completed, "Action completion date");
  if (startAfter && due && due < startAfter) throw new InvalidActionSchedule("Action due date cannot be earlier than its start-after date.");
  return Object.freeze({ created, ...(scheduled ? { scheduled } : {}), ...(startAfter ? { startAfter } : {}), ...(due ? { due } : {}), ...(completed ? { completed } : {}) });
}
function date(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new InvalidActionSchedule(`${field} must be valid.`); return result; }
function optional(value: Date | undefined, field: string): Date | undefined { return value ? date(value, field) : undefined; }
