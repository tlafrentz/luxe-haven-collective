import { notFound } from "next/navigation";
import { getCustomerFurnishingStudio } from "@/app/actions/furnishing-studio";
import { FurnishingProjectWorkspace } from "@/features/furnishing-studio/presentation/furnishing-project-workspace";

export const dynamic = "force-dynamic";
export default async function FurnishingProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const [{ projectId }, query, data] = await Promise.all([
    params,
    searchParams,
    getCustomerFurnishingStudio(),
  ]);
  const project = data.projects.find((item) => String(item.id) === projectId);
  if (!project) notFound();
  return (
    <FurnishingProjectWorkspace
      project={project}
      orders={data.orders.filter((item) => item.project_id === project.id)}
      installations={data.installations.filter(
        (item) => item.project_id === project.id,
      )}
      punch={data.punch.filter((item) => item.project_id === project.id)}
      activity={data.activity.filter((item) => item.project_id === project.id)}
      stage={query.stage}
    />
  );
}
