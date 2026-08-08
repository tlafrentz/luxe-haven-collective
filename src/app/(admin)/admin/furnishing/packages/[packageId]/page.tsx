import { PropertyPackageDetail } from "@/components/furnishing/package-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  return <PropertyPackageDetail packageId={(await params).packageId} />;
}
