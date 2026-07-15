import type {
  ExecutiveAction,
} from "../domain";

export type StartActionInput = {
  action: ExecutiveAction;
  startedAt: string;
};

export function startAction({
  action,
  startedAt,
}: StartActionInput): ExecutiveAction {
  if (action.status !== "accepted") {
    throw new Error(
      `Cannot start action with status "${action.status}".`,
    );
  }

  return {
    ...action,
    status: "in-progress",
    startedAt,
  };
}
