import { notFound } from "next/navigation";
import { ExecutionDetailWorkspace } from "@/features/action-center";
import { getExecuteActionDetailAction } from "@/app/actions/execute-controls";

export default async function ActionWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getExecuteActionDetailAction({ actionId: decodeURIComponent(id) });
  if (!result.ok) {
    if (result.code === "ACTION_NOT_FOUND") notFound();
    return <main className="mx-auto max-w-3xl px-5 py-16"><p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">{result.message}</p></main>;
  }
  return <ExecutionDetailWorkspace detail={result.value} />;
}
