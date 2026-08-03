import type { ReportCategory } from "../domain/report-registry";
import { standardReportRegistry } from "../domain/report-registry";
import { ReportLibrary } from "./report-library";

const categoryDescriptions: Record<ReportCategory, string> = {
  executive: "Portfolio-level, cross-capability records for leadership review, distribution, and archival.",
  owner: "Owner-safe property records designed to stand without internal operating context.",
  investment: "Versioned acquisition and strategy records that preserve assumptions, evidence, and lineage.",
  operations: "Period-bound execution records for property and portfolio operations.",
  custom: "Governed composition using only approved canonical measures, dimensions, and fields.",
};

export function ReportCategoryPage({ category }: { category: ReportCategory }) {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <header className="mb-8 max-w-3xl">
        <p className="eyebrow">Governed reporting</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold capitalize">{category} reports</h1>
        <p className="mt-3 text-stone-600">{categoryDescriptions[category]}</p>
      </header>
      <ReportLibrary definitions={standardReportRegistry.byCategory(category)} activeCategory={category} />
    </main>
  );
}
