import { getHpmWorkspaceProjection, HpmFailure, HpmLifecycleView, HpmWorkspaceFrame, parseHpmWorkspaceQuery } from "@/features/hpm-workspace";

export default async function HpmLifecyclePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseHpmWorkspaceQuery(await searchParams);
  const result = await getHpmWorkspaceProjection(query);
  if (!result.ok) return <HpmFailure {...result} />;
  return <HpmWorkspaceFrame activeHref="/dashboard/hpm/lifecycle" query={query} model={result.value}><HpmLifecycleView model={result.value} query={query} /></HpmWorkspaceFrame>;
}
