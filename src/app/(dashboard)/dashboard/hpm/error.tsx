"use client";
import { WorkspaceErrorState, WorkspacePage } from "@/components/application-layout";
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <WorkspacePage width="medium"><WorkspaceErrorState title="HPM could not load" description="The workspace projection failed safely. No lifecycle source records were changed." retry={reset} /></WorkspacePage>; }
