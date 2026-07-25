import { WorkspaceHeader, WorkspacePage } from "@/components/application-layout";
export default function Loading() { return <WorkspacePage width="medium"><WorkspaceHeader eyebrow="Personal settings" title="Preferences" description="Loading effective personal settings…" /><div className="h-96 animate-pulse rounded-2xl bg-stone-100" aria-busy /></WorkspacePage>; }
