import { ExperienceComponentDetail } from "@/components/guidebooks/experience-component-library";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ componentId: string }>;
  searchParams: Promise<{tab?:string;channel?:string}>;
}) {
  const [{componentId},query]=await Promise.all([params,searchParams]);
  return <ExperienceComponentDetail id={componentId} tab={query.tab} channel={query.channel}/>;
}
