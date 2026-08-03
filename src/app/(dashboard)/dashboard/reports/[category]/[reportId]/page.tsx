import { notFound, redirect } from "next/navigation";
import { ReportDefinitionView, isReportCategory, standardReportRegistry } from "@/features/reporting-workspace";

export default async function StandardReportPage({
  params,
}: {
  params: Promise<{ category: string; reportId: string }>;
}) {
  const { category, reportId } = await params;
  if (!isReportCategory(category)) notFound();

  const definition = standardReportRegistry.get(reportId);
  if (!definition) notFound();
  if (definition.category !== category) {
    redirect(`/dashboard/reports/${definition.category}/${definition.id}`);
  }

  return (
    <main className="px-5">
      <ReportDefinitionView definition={definition} />
    </main>
  );
}
