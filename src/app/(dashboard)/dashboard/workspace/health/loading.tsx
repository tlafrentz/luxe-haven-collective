import { WorkspaceHeader, WorkspacePage } from "@/components/application-layout";
export default function Loading(){return <WorkspacePage width="wide"><WorkspaceHeader eyebrow="Operating readiness" title="Workspace Health" description="Evaluating bounded capability health…" /><div className="h-96 animate-pulse rounded-2xl bg-stone-100" aria-busy /></WorkspacePage>;}
