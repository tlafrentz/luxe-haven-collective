import { TemplateDetailWorkspace } from "@/components/guidebooks/template-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{tab?:string;channel?:string}>;
}) {
  const [{templateId},query]=await Promise.all([params,searchParams]);
  return <TemplateDetailWorkspace id={templateId} tab={query.tab} channel={query.channel}/>;
}
