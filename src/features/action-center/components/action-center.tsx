import type { ActionPlanProps } from "@/platform/actions";
import type { ActionCenterView, ActionCenterViewSelection } from "../domain";
import { ActionCenterHeader } from "./action-center-header";
import { ActionQueue } from "./action-queue";
import { ExecutionSummary } from "./execution-summary";
import { ActionPlanQueue } from "./action-plan-queue";

export function ActionCenter({ view, selectedView, workspaceId, plans = [] }: { view: ActionCenterView; selectedView: ActionCenterViewSelection; workspaceId:string; plans?: readonly ActionPlanProps[] }) {
  const actions = selectedView === "completed" ? view.completedActions : selectedView === "all" ? view.allActions : view.activeActions;
  return <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div className="mx-auto max-w-[1480px] space-y-8">
    <ActionCenterHeader summary={view.summary} selectedView={selectedView} />{selectedView === "overview" ? <ExecutionSummary summary={view.summary} /> : null}
    {selectedView === "plans" ? <ActionPlanQueue plans={plans} workspaceId={workspaceId} /> : <ActionQueue actions={actions} selectedView={selectedView} />}
  </div></main>;
}
