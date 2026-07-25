import { WorkspacePage, WorkspaceSkeleton } from "@/components/application-layout";

export default function LoadingWorkspace() {
  return (
    <WorkspacePage width="medium">
      <WorkspaceSkeleton cards={6} />
    </WorkspacePage>
  );
}
