export const actionCenterViews = ["overview", "my-work", "all", "plans", "completed"] as const;

export type ActionCenterViewSelection = (typeof actionCenterViews)[number];

export function parseActionCenterView(value?: string): ActionCenterViewSelection {
  return actionCenterViews.includes(value as ActionCenterViewSelection) ? (value as ActionCenterViewSelection) : "overview";
}
