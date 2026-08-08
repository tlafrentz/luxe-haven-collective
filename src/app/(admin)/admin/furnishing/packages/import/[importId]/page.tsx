import { PackageImportReview } from "@/components/furnishing/package-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  return <PackageImportReview importId={(await params).importId} />;
}
