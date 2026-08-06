import { ExperienceComponentLibrary } from "@/components/guidebooks/experience-component-library";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    channel?: string;
    sort?: string;
    view?: string;
  }>;
}) {
  return (
    <ExperienceComponentLibrary filters={await searchParams} />
  );
}
