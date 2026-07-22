import type { ActionCenterView } from "../domain";
import { ActionCenterHeader } from "./action-center-header";
import { ActionQueue } from "./action-queue";
import { ExecutionSummary } from "./execution-summary";

export function ActionCenter({ view }: { view: ActionCenterView }) {
  return <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div className="mx-auto max-w-[1480px] space-y-8">
    <ActionCenterHeader summary={view.summary} /><ExecutionSummary summary={view.summary} />
    <ActionQueue actions={view.activeActions} isEmpty={view.isEmpty} />
  </div></main>;
}
