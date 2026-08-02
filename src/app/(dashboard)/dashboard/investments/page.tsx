import { redirect } from "next/navigation";
import { HpmDashboard } from "@/components/hpm-dashboard";

export default async function InvestmentIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.strategy || params.opportunity || params.mode) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
    }
    redirect(`/dashboard/investments/new?${query}`);
  }
  return <HpmDashboard screen="investment" />;
}
