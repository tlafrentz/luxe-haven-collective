"use client";

import { WorkspaceErrorState, WorkspacePage } from "@/components/application-layout";

export default function BookingsError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <WorkspacePage width="wide">
      <WorkspaceErrorState
        title="Unable to load bookings"
        description="Your reservation data was not changed. Try loading the operational view again."
        retry={reset}
      />
    </WorkspacePage>
  );
}
