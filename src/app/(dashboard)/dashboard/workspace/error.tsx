"use client";

import { WorkspaceErrorState, WorkspacePage } from "@/components/application-layout";

export default function WorkspaceError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <WorkspacePage width="medium">
      <WorkspaceErrorState
        title="Workspace could not be loaded"
        description="An unexpected failure interrupted the workspace overview. Your configuration has not been changed."
        retry={reset}
        details={error.digest ? `Reference: ${error.digest}` : undefined}
      />
    </WorkspacePage>
  );
}
