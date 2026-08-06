import { ContentRecordWorkspace } from "@/components/guidebooks/content-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<{tab?:string}>;
}) {
  const [{contentId},query]=await Promise.all([params,searchParams]);return <ContentRecordWorkspace id={contentId} tab={query.tab}/>;
}
