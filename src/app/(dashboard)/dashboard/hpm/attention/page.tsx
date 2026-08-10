import { getHpmWorkspaceProjection, HpmAttentionView, HpmFailure, HpmWorkspaceFrame, parseHpmWorkspaceQuery } from "@/features/hpm-workspace";

export default async function HpmAttentionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseHpmWorkspaceQuery(await searchParams);
  const result = await getHpmWorkspaceProjection(query);
  if (!result.ok) return <HpmFailure {...result} />;
  return <HpmWorkspaceFrame activeHref="/dashboard/hpm/attention" query={query} model={result.value}><HpmAttentionView model={result.value} query={query} /></HpmWorkspaceFrame>;
}
