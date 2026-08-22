import Link from "next/link";
import type {
  CompositionDimension,
  PortfolioComposition,
  PortfolioConcentration,
} from "../application/composition";
export function PortfolioCompositionView({
  composition,
}: {
  composition: PortfolioComposition;
}) {
  if (!composition.scope.propertyCount) return <Empty />;
  return (
    <main className="mx-auto max-w-[1500px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <Header composition={composition} />
      {composition.scope.authorization.type === "assigned-properties" ? (
        <Notice title="Your Assigned Portfolio">
          Composition and dependency measures include only properties assigned
          to your role.
        </Notice>
      ) : null}
      {composition.scope.propertyCount === 1 ? (
        <Notice title="Single-property portfolio">
          Composition is available. Diversification analysis requires multiple
          properties.
        </Notice>
      ) : null}
      {composition.freshness !== "current" ? (
        <Notice title="Composition is partially degraded">
          Current structural facts remain visible while stale dimensions are
          labeled.
        </Notice>
      ) : null}
      <Summary composition={composition} />
      <div className="grid gap-8 xl:grid-cols-2">
        <DimensionCard dimension={composition.markets} />
        <DimensionCard dimension={composition.geography} />
        <DimensionCard dimension={composition.propertyTypes} />
        <DimensionCard dimension={composition.bedrooms} />
        <DimensionCard dimension={composition.operatingModels} />
        <DimensionCard dimension={composition.acquisitionStrategies} />
      </div>
      <Distribution composition={composition} />
      <div className="grid gap-8 xl:grid-cols-2">
        <DimensionCard dimension={composition.bookingSources} />
        <Seasonality composition={composition} />
      </div>
      <Concentrations composition={composition} />
      <History composition={composition} />
      <Evidence composition={composition} />
    </main>
  );
}
function Header({ composition }: { composition: PortfolioComposition }) {
  return (
    <header className="rounded-[2rem] bg-[#101416] p-6 text-white sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
        Portfolio Intelligence · Concentration
      </p>
      <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Composition &amp; Concentration
          </h1>
          <p className="mt-3 text-lg text-stone-200">
            {composition.scopeLabel}
          </p>
          <p className="mt-1 text-sm text-stone-400">
            {composition.scope.propertyCount} included properties ·{" "}
            {composition.period.current.from}–{composition.period.current.to}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-5 text-sm sm:grid-cols-3">
          <Fact
            label="Comparison"
            value={title(composition.period.comparisonType)}
          />
          <Fact label="Confidence" value={title(composition.confidence)} />
          <Fact label="Freshness" value={title(composition.freshness)} />
          <Fact
            label="Evaluated"
            value={new Date(composition.evaluatedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          />
        </dl>
      </div>
      <p className="mt-7 border-t border-white/10 pt-5 text-xs text-stone-300">
        Workspace, scope, reporting period, comparison, and basis are inherited
        from the shared context.
      </p>
    </header>
  );
}
function Summary({ composition }: { composition: PortfolioComposition }) {
  return (
    <section aria-labelledby="summary-heading">
      <Heading
        id="summary-heading"
        title="Composition summary"
        description="A descriptive inventory of structural breadth. No diversification score or strategic judgment is applied."
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          value={composition.diversification.propertyCount}
          label="Properties"
        />
        <Stat value={composition.diversification.marketCount} label="Markets" />
        <Stat
          value={composition.diversification.propertyTypeCount}
          label="Property types"
        />
        <Stat
          value={composition.diversification.operatingModelCount}
          label="Operating models"
        />
      </div>
      <ul className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-700">
        {composition.diversification.statements.map((statement) => (
          <li key={statement}>{statement}</li>
        ))}
      </ul>
    </section>
  );
}
function DimensionCard({ dimension }: { dimension: CompositionDimension }) {
  return (
    <section
      aria-labelledby={`dimension-${dimension.type}`}
      className="rounded-[2rem] border border-stone-200 bg-white p-6"
    >
      <Heading
        id={`dimension-${dimension.type}`}
        title={dimension.label}
        description={`${Math.round(dimension.coverage * 100)}% coverage · ${title(dimension.confidence)} confidence · ${title(dimension.freshness)}`}
      />
      {dimension.entries.length ? (
        <>
          <div className="mt-5 space-y-4" aria-hidden="true">
            {dimension.entries.map((entry) => (
              <div key={entry.key}>
                <div className="flex justify-between text-sm">
                  <span>{entry.label}</span>
                  <strong>
                    {percent(entry.revenueShare ?? entry.propertyShare)}
                  </strong>
                </div>
                <div className="mt-2 h-2 rounded-full bg-stone-100">
                  <div
                    className="h-2 rounded-full bg-teal-700"
                    style={{
                      width: percent(entry.revenueShare ?? entry.propertyShare),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <table className="mt-5 w-full text-left text-sm">
            <caption className="sr-only">
              {dimension.label} accessible distribution table
            </caption>
            <thead>
              <tr>
                <th scope="col" className="py-2">
                  Category
                </th>
                <th scope="col">Properties</th>
                <th scope="col">Revenue</th>
                <th scope="col">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {dimension.entries.map((entry) => (
                <tr key={entry.key} className="border-t border-stone-100">
                  <th scope="row" className="py-3 font-medium">
                    {entry.label}
                  </th>
                  <td>{entry.propertyCount}</td>
                  <td>{percent(entry.revenueShare)}</td>
                  <td>{percent(entry.bookingShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <Unavailable>
          {dimension.unavailableReason ?? "This dimension is unavailable."}
        </Unavailable>
      )}
    </section>
  );
}
function Distribution({ composition }: { composition: PortfolioComposition }) {
  return (
    <section aria-labelledby="distribution-heading">
      <Heading
        id="distribution-heading"
        title="Revenue & booking distribution"
        description="Structural allocation by property is distinct from PI-001C performance contribution and momentum."
      />
      <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Revenue and booking distribution by authorized property
          </caption>
          <thead className="bg-stone-50">
            <tr>
              <th scope="col" className="px-4 py-3">
                Property
              </th>
              <th scope="col">Revenue share</th>
              <th scope="col">Booking share</th>
              <th scope="col">Revenue</th>
              <th scope="col">Bookings</th>
            </tr>
          </thead>
          <tbody>
            {composition.revenueDistribution.byProperty.map((entry) => (
              <tr key={entry.key} className="border-t border-stone-100">
                <th scope="row" className="px-4 py-4">
                  {entry.label}
                </th>
                <td>{percent(entry.revenueShare)}</td>
                <td>{percent(entry.bookingShare)}</td>
                <td>{money(entry.revenue)}</td>
                <td>{entry.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Seasonality({ composition }: { composition: PortfolioComposition }) {
  return (
    <section
      aria-labelledby="seasonality-heading"
      className="rounded-[2rem] border border-stone-200 bg-white p-6"
    >
      <Heading
        id="seasonality-heading"
        title="Seasonality"
        description="Revenue and bookings by operating month; no forecast is produced."
      />
      {composition.seasonality.months.length ? (
        <>
          <p className="mt-5 text-sm text-stone-700">
            {percent(composition.seasonality.peakWindowShare)} of observed
            revenue occurs in {composition.seasonality.peakWindowLabel}.
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">
              Monthly revenue and booking distribution
            </caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Revenue</th>
                <th scope="col">Share</th>
                <th scope="col">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {composition.seasonality.months.map((month) => (
                <tr className="border-t border-stone-100" key={month.month}>
                  <th scope="row" className="py-3">
                    {month.label}
                  </th>
                  <td>{money(month.revenue)}</td>
                  <td>{percent(month.revenueShare)}</td>
                  <td>{month.bookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <Unavailable>
          Monthly booking evidence is unavailable for the selected period.
        </Unavailable>
      )}
    </section>
  );
}
function Concentrations({
  composition,
}: {
  composition: PortfolioComposition;
}) {
  return (
    <section aria-labelledby="concentration-heading">
      <Heading
        id="concentration-heading"
        title="Concentration summary"
        description="Each dependency is measured independently and names its basis, threshold, evidence confidence, and freshness."
      />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {composition.concentration.map((item) => (
          <ConcentrationCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
function ConcentrationCard({ item }: { item: PortfolioConcentration }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <Pill>{title(item.status)}</Pill>
      <h3 className="mt-3 font-semibold">{item.label}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-700">{item.statement}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Fact label="Measured basis" value={title(item.basis)} />
        <Fact label="Top share" value={percent(item.topShare)} />
        <Fact label="Policy threshold" value={percent(item.threshold)} />
        <Fact label="Confidence" value={title(item.confidence)} />
        <Fact label="Freshness" value={title(item.freshness)} />
        <Fact
          label="Evidence references"
          value={String(item.evidenceIds.length)}
        />
      </dl>
    </article>
  );
}
function History({ composition }: { composition: PortfolioComposition }) {
  return (
    <section aria-labelledby="history-heading">
      <Heading
        id="history-heading"
        title="Composition changes"
        description="New, removed, archived, and materially shifted characteristics are disclosed separately from operating performance."
      />
      <div className="mt-5">
        {composition.history.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {composition.history.map((item) => (
              <li
                className="rounded-2xl border border-stone-200 bg-white p-4"
                key={item.id}
              >
                <Pill>{title(item.type)}</Pill>
                <p className="mt-2 font-semibold">{item.label}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {title(item.dimension)} ·{" "}
                  {item.previousShare === undefined
                    ? "New"
                    : percent(item.previousShare)}{" "}
                  →{" "}
                  {item.currentShare === undefined
                    ? "Removed"
                    : percent(item.currentShare)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Unavailable>
            No material composition change is established for the selected
            comparison.
          </Unavailable>
        )}
      </div>
    </section>
  );
}
function Evidence({ composition }: { composition: PortfolioComposition }) {
  const values = [
    ["Property", composition.evidence.propertyCoverage],
    ["Revenue", composition.evidence.revenueCoverage],
    ["Bookings", composition.evidence.bookingCoverage],
    ["Property type", composition.evidence.propertyTypeCoverage],
    ["Bedrooms", composition.evidence.bedroomCoverage],
    ["Operating model", composition.evidence.operatingModelCoverage],
    ["Acquisition strategy", composition.evidence.acquisitionStrategyCoverage],
    ["Booking source", composition.evidence.bookingSourceCoverage],
  ] as const;
  return (
    <section
      aria-labelledby="evidence-heading"
      className="rounded-[2rem] border border-stone-200 bg-white p-6 sm:p-8"
    >
      <Heading
        id="evidence-heading"
        title="Composition evidence"
        description="Coverage limitations remain visible by dimension."
      />
      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {values.map(([label, value]) => (
          <Fact
            key={label}
            label={`${label} coverage`}
            value={percent(value)}
          />
        ))}
      </dl>
      {composition.evidence.limitingDimensions.length ? (
        <p className="mt-5 text-sm text-amber-800">
          Limited dimensions:{" "}
          {composition.evidence.limitingDimensions.map(title).join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
function Empty() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <section
        role="status"
        className="rounded-[2rem] border border-stone-200 bg-white p-8 text-center"
      >
        <h1 className="text-3xl font-semibold">
          Portfolio composition unavailable
        </h1>
        <p className="mt-4 text-sm text-stone-600">
          Add properties to begin composition analysis.
        </p>
        <Link
          href="/dashboard/workspace/properties"
          className="mt-6 inline-flex rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white"
        >
          Review workspace properties
        </Link>
      </section>
    </main>
  );
}
export function PortfolioCompositionError({
  message = "Portfolio composition could not be loaded. No portfolio data was changed.",
}: {
  message?: string;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <section
        role="alert"
        className="rounded-[2rem] border border-rose-200 bg-white p-8"
      >
        <h1 className="text-3xl font-semibold">
          Portfolio composition is unavailable
        </h1>
        <p className="mt-3 text-sm text-stone-600">{message}</p>
      </section>
    </main>
  );
}
export function PortfolioCompositionSkeleton() {
  return (
    <main
      aria-hidden="true"
      className="mx-auto max-w-[1500px] animate-pulse space-y-7 px-4 py-8"
    >
      <span className="sr-only">Loading portfolio composition</span>
      <div className="h-64 rounded-[2rem] bg-stone-200" />
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-stone-200" />
        ))}
      </div>
      <div className="grid gap-8 xl:grid-cols-2">
        <div className="h-80 rounded-[2rem] bg-stone-200" />
        <div className="h-80 rounded-[2rem] bg-stone-200" />
      </div>
    </main>
  );
}
function Heading({
  id,
  title: heading,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 id={id} className="text-2xl font-semibold">
        {heading}
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
        {description}
      </p>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-stone-600">{label}</p>
    </div>
  );
}
function Notice({
  title: heading,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      role="status"
      className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"
    >
      <strong>{heading}.</strong> {children}
    </aside>
  );
}
function Unavailable({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
      {children}
    </p>
  );
}
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold">
      {children}
    </span>
  );
}
function title(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function percent(value: number | null) {
  return value === null ? "Unavailable" : `${(value * 100).toFixed(1)}%`;
}
function money(value: number | null) {
  return value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
}
