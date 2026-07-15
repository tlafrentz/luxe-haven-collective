import type {
  ActionCenterView,
} from "../domain";

import {
  ActionCenterHeader,
} from "./action-center-header";

import {
  ActionQueue,
} from "./action-queue";

import {
  ExecutionSummary,
} from "./execution-summary";

import {
  NextBestAction,
} from "./next-best-action";

type ActionCenterProps = {
  view: ActionCenterView;
};

export function ActionCenter({
  view,
}: ActionCenterProps) {
  const nextBestAction =
    view.activeActions[0];

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1480px] space-y-8">
        <ActionCenterHeader
          summary={view.summary}
        />

        <ExecutionSummary
          summary={view.summary}
        />

        {nextBestAction ? (
          <NextBestAction
            action={nextBestAction}
          />
        ) : null}

        <ActionQueue
          actions={view.activeActions}
        />
      </div>
    </main>
  );
}
