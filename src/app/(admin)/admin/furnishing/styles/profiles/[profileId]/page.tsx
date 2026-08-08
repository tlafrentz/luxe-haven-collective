import { DesignProfileDetail } from "@/components/furnishing/design-system-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  return <DesignProfileDetail profileId={(await params).profileId} />;
}
