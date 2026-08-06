import { getCustomerFurnishingStudio } from "@/app/actions/furnishing-studio";
import { CustomerFurnishingWorkspace } from "@/features/furnishing-studio/presentation/customer-furnishing-workspace";

export const dynamic = "force-dynamic";
export default async function FurnishingStudioPage() {
  return (
    <CustomerFurnishingWorkspace
      section="overview"
      data={await getCustomerFurnishingStudio()}
    />
  );
}
