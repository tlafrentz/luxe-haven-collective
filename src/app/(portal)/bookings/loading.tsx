import {
  WorkspaceHeader,
  WorkspacePage,
  WorkspaceSkeleton,
} from "@/components/application-layout";

export default function BookingsLoading() {
  return (
    <WorkspacePage width="wide">
      <WorkspaceHeader
        eyebrow="Business operations"
        title="Bookings"
        description="Loading your operational reservation view."
      />
      <WorkspaceSkeleton cards={5} />
    </WorkspacePage>
  );
}
