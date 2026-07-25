import { WorkspacePage, WorkspaceSkeleton } from "@/components/application-layout";

export default function LoadingOrganization() {
  return <WorkspacePage width="medium"><WorkspaceSkeleton cards={4} /></WorkspacePage>;
}
