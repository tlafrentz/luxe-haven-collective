import { redirect } from "next/navigation";
import { getFurnishingStudio } from "@/app/actions/furnishing-studio";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = await params,
    data = await getFurnishingStudio(),
    variant = data.variants.find(
      (x: Record<string, unknown>) => x.package_id === packageId,
    );
  redirect(
    variant
      ? `/admin/furnishing/packages/${packageId}/variants/${variant.id}`
      : "/admin/furnishing/packages",
  );
}
