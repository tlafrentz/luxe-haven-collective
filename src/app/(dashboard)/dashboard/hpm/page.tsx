import { getHpmWorkspaceProjection, HpmFailure, HpmOverview, HpmWorkspaceFrame, parseHpmWorkspaceQuery } from "@/features/hpm-workspace";

export default async function HpmOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseHpmWorkspaceQuery(await searchParams);
  const result = await getHpmWorkspaceProjection(query);
  if (!result.ok) return <HpmFailure {...result} />;
  return <HpmWorkspaceFrame activeHref="/dashboard/hpm" query={query} model={result.value}><HpmOverview model={result.value} query={query} /></HpmWorkspaceFrame>;
}
