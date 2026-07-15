import type {
  ExecutionWorkspace as ExecutionWorkspaceView,
} from "../domain";

import {
  ExecutionContext,
} from "./execution-context";

import {
  ExecutionHeader,
} from "./execution-header";

import {
  ExecutionLearning,
} from "./execution-learning";

import {
  ExecutionMetadata,
} from "./execution-metadata";

import {
  ExecutionPlan,
} from "./execution-plan";

import {
  ExecutionTimeline,
} from "./execution-timeline";

type ExecutionWorkspacePageProps = {
  workspace: ExecutionWorkspaceView;
};

export function ExecutionWorkspacePage({
  workspace,
}: ExecutionWorkspacePageProps) {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1380px] space-y-8">
        <ExecutionHeader
          workspace={workspace}
        />

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)]">
          <div className="space-y-8">
            <ExecutionContext
              workspace={workspace}
            />

            <ExecutionTimeline
              workspace={workspace}
            />

            <ExecutionLearning
              workspace={workspace}
            />
          </div>

          <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
            <ExecutionPlan
              workspace={workspace}
            />

            <ExecutionMetadata
              workspace={workspace}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
