import {
  WorkspaceHeader,
  WorkspacePage,
  WorkspaceSkeleton,
} from "@/components/application-layout";

export default function PropertiesLoading() {
  return (
    <WorkspacePage width="wide">
      <WorkspaceHeader
        eyebrow="Business operations"
        title="Properties"
        description="Loading live property operations."
      />
      <WorkspaceSkeleton cards={4} />
    </WorkspacePage>
  );
}
