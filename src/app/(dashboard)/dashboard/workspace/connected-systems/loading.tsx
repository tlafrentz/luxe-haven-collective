import { WorkspaceHeader, WorkspacePage } from "@/components/application-layout";

export default function Loading() {
  return <WorkspacePage width="wide"><WorkspaceHeader eyebrow="Workspace configuration" title="Connected Systems" description="Loading connections and synchronization health…" /><div className="h-64 animate-pulse rounded-2xl bg-stone-100" aria-busy="true" /></WorkspacePage>;
}
