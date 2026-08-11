import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { generateCanonicalReportAction } from "@/app/actions/canonical-reporting";
import { getGenerationOptions } from "@/features/reporting-suite/application/reporting-workspace-composition";
import { CustomReportBuilder } from "@/features/reporting-suite";
import {
  CUSTOM_REPORT_SECTION_REGISTRY,
  REPORT_METRIC_SOURCE_MATRIX,
} from "@/platform/reporting";
export default async function ConfigureReportPage({
  params,
}: {
  params: Promise<{ definitionId: string }>;
}) {
  const { definitionId } = await params,
    options = await getGenerationOptions();
  if (!options) redirect("/login");
  const item = options.definitions.find(
    (value) =>
      value.definition.definitionId === decodeURIComponent(definitionId),
  );
  if (!item) notFound();
  const d = item.definition,
    isInvestment = d.family === "investment",
    isComparison = d.reportType === "investment_comparison",
    isCustom = d.family === "custom";
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <header>
        <Link href="/dashboard/reports/new">← Choose report</Link>
        <h1 className="mt-3 text-4xl font-semibold">{d.title}</h1>
        <p className="mt-2 text-stone-600">{d.businessQuestion}</p>
      </header>
      <form
        action={generateCanonicalReportAction}
        className="space-y-6 rounded-3xl border bg-white p-6"
      >
        <input name="definitionId" type="hidden" value={d.definitionId} />
        <input
          name="idempotencyKey"
          type="hidden"
          value={crypto.randomUUID()}
        />
        <section>
          <h2 className="text-xl font-semibold">1. Choose scope</h2>
          {isInvestment ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: isComparison ? 2 : 1 }, (_, index) => (
                <label key={index}>
                  Saved analysis {index + 1}
                  <select
                    className="mt-1 w-full rounded-lg border p-3"
                    name="analysisSelections"
                    required
                  >
                    <option value="">Choose an exact version</option>
                    {options.analyses.map((analysis) => (
                      <option
                        key={analysis.id}
                        value={`${analysis.opportunity_id}|${analysis.id}`}
                      >
                        Analysis {analysis.sequence} · {analysis.route} ·{" "}
                        {new Date(analysis.created_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : (
            <fieldset className="mt-3">
              <legend className="text-sm text-stone-600">
                Leave all properties unchecked for portfolio scope where
                supported.
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {options.properties.map((property) => (
                  <label
                    className="flex items-center gap-2 rounded-lg border p-3"
                    key={property.id}
                  >
                    <input
                      name="propertyIds"
                      type={d.family === "owner" ? "radio" : "checkbox"}
                      value={property.id}
                    />
                    {property.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </section>
        <section>
          <h2 className="text-xl font-semibold">2. Choose period</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label>
              Start date
              <input
                className="mt-1 w-full rounded-lg border p-3"
                name="startDate"
                required
                type="date"
                defaultValue="2026-07-01"
              />
            </label>
            <label>
              End date
              <input
                className="mt-1 w-full rounded-lg border p-3"
                name="endDate"
                required
                type="date"
                defaultValue="2026-07-31"
              />
            </label>
            <label>
              Timezone
              <select
                className="mt-1 w-full rounded-lg border p-3"
                name="timezone"
              >
                <option>America/Chicago</option>
                <option>America/New_York</option>
                <option>America/Los_Angeles</option>
                <option>UTC</option>
              </select>
            </label>
          </div>
        </section>
        <section>
          <h2 className="text-xl font-semibold">3. Configure options</h2>
          <label className="mt-3 block">
            Report title
            <input
              className="mt-1 w-full rounded-lg border p-3"
              maxLength={160}
              name="title"
              placeholder={d.title}
            />
          </label>
          {isCustom ? (
            <div className="mt-4 space-y-4">
              <label className="block">
                Introductory note
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border p-3"
                  maxLength={1000}
                  name="introductoryNote"
                />
              </label>
              <input name="includeLineageAppendix" type="hidden" value="true" />
              <CustomReportBuilder
                sections={CUSTOM_REPORT_SECTION_REGISTRY.filter((section) =>
                  section.supportedScopeKinds.includes("property"),
                )
                  .slice(0, 12)
                  .map((section) => ({
                    key: section.key,
                    label: section.label,
                    description: section.description,
                    metrics: section.optionalMetricKeys.flatMap((key) => {
                      const metric = REPORT_METRIC_SOURCE_MATRIX.find(
                        (item) => item.metricKey === key,
                      );
                      return metric
                        ? [{ key, visibility: metric.visibility }]
                        : [];
                    }),
                    visibilities: section.supportedVisibility.filter(
                      (value): value is "internal" | "owner_safe" =>
                        value === "internal" || value === "owner_safe",
                    ),
                  }))}
                ownerOnly={options.access.role === "owner"}
              />
            </div>
          ) : null}
        </section>
        <section className="rounded-2xl bg-stone-50 p-5">
          <h2 className="text-xl font-semibold">4. Review and generate</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Definition</dt>
              <dd>
                {d.definitionId} · v{d.definitionVersion}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Comparison</dt>
              <dd>{d.comparisonPolicy}</dd>
            </div>
            <div>
              <dt className="font-semibold">Visibility</dt>
              <dd>
                {isCustom
                  ? "Selected above"
                  : d.visibilityPolicy.default.replace("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Sections</dt>
              <dd>{isCustom ? "Selected above" : d.sectionDefinitions.length}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm">
            Generating this report creates an immutable version using the data
            and saved evidence available to the report at generation time.
          </p>
        </section>
        <button
          disabled={item.availability.state !== "available"}
          className="rounded-full bg-stone-950 px-6 py-3 font-semibold text-white disabled:opacity-40"
        >
          Generate report
        </button>
      </form>
    </main>
  );
}
