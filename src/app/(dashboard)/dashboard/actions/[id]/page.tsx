import {
  notFound,
} from "next/navigation";

import {
  ACTION_CENTER_RECORDS,
  ExecutionWorkspacePage,
  buildExecutionWorkspace,
  findActionCenterRecord,
} from "@/features/action-center";

type ActionWorkspacePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ActionWorkspacePage({
  params,
}: ActionWorkspacePageProps) {
  const { id } = await params;

  const record =
    findActionCenterRecord(
      ACTION_CENTER_RECORDS,
      id,
    );

  if (!record) {
    notFound();
  }

  const workspace =
    buildExecutionWorkspace(record);

  return (
    <ExecutionWorkspacePage
      workspace={workspace}
    />
  );
}
