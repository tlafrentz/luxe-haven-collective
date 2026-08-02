import { ExecutivePageView, type ExecutiveSearchParams } from "../executive-page";

export default function ExecutiveIntelligencePage({ searchParams }: Readonly<{ searchParams: ExecutiveSearchParams }>) {
  return <ExecutivePageView searchParams={searchParams} tab="overview" />;
}
