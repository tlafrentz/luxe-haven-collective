import { getHpmWorkspaceProjection, HpmFailure, HpmThreadDetail, HpmWorkspaceFrame, parseHpmWorkspaceQuery } from "@/features/hpm-workspace";

export default async function HpmThreadPage({ params, searchParams }: { params: Promise<{ threadId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ threadId }, values] = await Promise.all([params, searchParams]);
  const query = parseHpmWorkspaceQuery(values);
  const result = await getHpmWorkspaceProjection(query);
  if (!result.ok) return <HpmFailure {...result} />;
  const thread = result.value.lifecycle.threads.find((item) => item.threadKey === decodeURIComponent(threadId));
  if (!thread) return <HpmFailure code="HPM_THREAD_NOT_FOUND" message="This lifecycle thread is no longer available in the authorized projection." correlationId={result.value.correlationId} />;
  return <HpmWorkspaceFrame activeHref="/dashboard/hpm/lifecycle" query={query} model={result.value}><HpmThreadDetail thread={thread} query={query} /></HpmWorkspaceFrame>;
}
