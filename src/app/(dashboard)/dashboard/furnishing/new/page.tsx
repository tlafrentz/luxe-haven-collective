import {
  createCustomerFurnishingProjectAction,
  getCustomerFurnishingStudio,
} from "@/app/actions/furnishing-studio";
import { FurnishingLaunchWizard } from "@/features/furnishing-studio/presentation/furnishing-launch-wizard";

export const dynamic = "force-dynamic";

export default async function FurnishingLaunchPage() {
  const data = await getCustomerFurnishingStudio();
  const activePropertyIds = new Set(
    data.projects
      .filter(
        (project) =>
          !["completed", "archived"].includes(String(project.status)),
      )
      .map((project) => String(project.property_id)),
  );
  return (
    <FurnishingLaunchWizard
      properties={data.properties.filter(
        (property) => !activePropertyIds.has(String(property.id)),
      )}
      packages={data.packages}
      variants={data.variants}
      rooms={data.rooms}
      createAction={createCustomerFurnishingProjectAction}
    />
  );
}
