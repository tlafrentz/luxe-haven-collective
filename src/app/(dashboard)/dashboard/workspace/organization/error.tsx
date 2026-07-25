"use client";

import { WorkspaceErrorState, WorkspacePage } from "@/components/application-layout";

export default function OrganizationError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <WorkspacePage width="medium"><WorkspaceErrorState title="Organization settings could not be loaded" description="Your saved organization details have not been changed. Try loading the section again." retry={reset} details={error.digest ? `Reference: ${error.digest}` : undefined} /></WorkspacePage>;
}
