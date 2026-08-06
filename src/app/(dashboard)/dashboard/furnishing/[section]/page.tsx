import { notFound } from "next/navigation";
import { getCustomerFurnishingStudio } from "@/app/actions/furnishing-studio";
import { CustomerFurnishingWorkspace } from "@/features/furnishing-studio/presentation/customer-furnishing-workspace";

const sections = [
  "projects",
  "packages",
  "procurement",
  "installation",
  "analytics",
  "settings",
] as const;
export const dynamic = "force-dynamic";
export default async function FurnishingSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();
  return (
    <CustomerFurnishingWorkspace
      section={section as (typeof sections)[number]}
      data={await getCustomerFurnishingStudio()}
    />
  );
}
