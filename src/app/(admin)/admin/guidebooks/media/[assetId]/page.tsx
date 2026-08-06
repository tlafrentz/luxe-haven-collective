import { MediaAssetWorkspace } from "@/components/guidebooks/media-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{tab?:string}>;
}) {
  const [{assetId},query]=await Promise.all([params,searchParams]);return <MediaAssetWorkspace id={assetId} tab={query.tab}/>;
}
