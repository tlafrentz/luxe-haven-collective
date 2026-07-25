"use client";

import {
  WorkspaceErrorState,
  WorkspacePage,
} from "@/components/application-layout";

export default function PropertiesError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <WorkspacePage width="wide">
      <WorkspaceErrorState
        title="Unable to load operational properties"
        description="Your property and reservation records were not changed. Try loading the operational view again."
        retry={reset}
      />
    </WorkspacePage>
  );
}
