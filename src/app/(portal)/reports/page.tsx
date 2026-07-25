"use client";

import {
  Archive,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileBarChart,
  Landmark,
  Presentation,
  Share2,
  Sparkles,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { WorkspaceActivity, WorkspaceContent, WorkspaceHeader, WorkspaceOverview, WorkspacePage, WorkspaceSupporting } from "@/components/application-layout";

type EditionId = "executive" | "owner" | "investment" | "portfolio" | "operations" | "exports";

type Edition = Readonly<{
  id: EditionId;
  title: string;
  shortTitle: string;
  audience: string;
  question: string;
  description: string;
  icon: LucideIcon;
  color: string;
}>;

const editions: readonly Edition[] = [
  { id: "executive", title: "Executive Edition", shortTitle: "Executive", audience: "Owner · CEO · Executive team", question: "How is the business doing?", description: "A concise narrative of business performance, health, priorities, recommendations, and execution.", icon: Presentation, color: "bg-teal-950 text-teal-100" },
  { id: "owner", title: "Owner Edition", shortTitle: "Owner", audience: "Property owner", question: "How is my property performing?", description: "Property revenue, occupancy, NOI, guest experience, payout context, and recommendations.", icon: Building2, color: "bg-amber-100 text-amber-900" },
  { id: "investment", title: "Investment Edition", shortTitle: "Investment", audience: "Investor · Partner · Lender", question: "Should we make this investment?", description: "Decision-ready market evidence, comparables, financial scenarios, risks, and recommendation.", icon: CircleDollarSign, color: "bg-blue-100 text-blue-900" },
  { id: "portfolio", title: "Portfolio Edition", shortTitle: "Portfolio", audience: "Operator · Investor · Board", question: "How healthy is the portfolio?", description: "Portfolio health, capital allocation, diversification, concentration, learning, and opportunity.", icon: Landmark, color: "bg-violet-100 text-violet-900" },
  { id: "operations", title: "Operations Edition", shortTitle: "Operations", audience: "Operations · Property management", question: "How well are we operating?", description: "Action completion, guest communications, maintenance, cleaning, and operating bottlenecks.", icon: BriefcaseBusiness, color: "bg-rose-100 text-rose-900" },
  { id: "exports", title: "Exports", shortTitle: "Exports", audience: "Analysts · Finance · External systems", question: "How do I share this?", description: "Portable point-in-time data in PDF, CSV, and Excel formats with its source context preserved.", icon: Download, color: "bg-stone-200 text-stone-800" },
];

const recentReports = [
  { id: "hpr-0724", title: "July Hospitality Performance Review", edition: "Executive Edition", audience: "Leadership team", period: "Jul 1–23, 2026", published: "Jul 24, 2026", status: "Published", icon: Presentation },
  { id: "owner-mesa", title: "Mesa Downtown Retreat · June", edition: "Owner Edition", audience: "Property owner", period: "Jun 1–30, 2026", published: "Jul 5, 2026", status: "Shared", icon: Building2 },
  { id: "portfolio-q2", title: "Q2 Portfolio Health Review", edition: "Portfolio Edition", audience: "Investment partners", period: "Apr 1–Jun 30, 2026", published: "Jul 2, 2026", status: "Published", icon: Landmark },
] as const;

export default function ReportsPage() {
  const [activeEdition, setActiveEdition] = useState<EditionId>("executive");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [audience, setAudience] = useState("Executive team");
  const [reportType, setReportType] = useState<EditionId>("executive");

  const active = editions.find((edition) => edition.id === activeEdition) ?? editions[0];

  const openGenerator = (edition: EditionId = "executive") => {
    setReportType(edition === "exports" ? "executive" : edition);
    setStep(1);
    setGeneratorOpen(true);
  };

  return (
    <WorkspacePage width="medium">
      <WorkspaceHeader
        eyebrow="Luxe Haven Press"
        title="Hospitality Performance Reports"
        description="Package platform intelligence into decision-ready narratives for every hospitality stakeholder."
        actions={
        <button type="button" onClick={() => openGenerator()} className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white outline-none hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Generate report
        </button>
        }
      />

      <WorkspaceOverview className="overflow-hidden rounded-3xl border border-stone-200 bg-stone-950 text-white shadow-sm">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200"><FileBarChart aria-hidden="true" className="h-4 w-4" />Flagship publishing system</div>
            <h2 className="mt-5 max-w-xl text-2xl font-semibold leading-tight sm:text-3xl">One report system. Purpose-built for every audience.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-stone-300">
              Every Hospitality Performance Report combines metrics, insights, recommendations, evidence, and executive narrative in a consistent Luxe Haven format.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {editions.slice(0, 5).map((edition) => <span key={edition.id} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-stone-300">{edition.shortTitle}</span>)}
            </div>
          </div>
          <div className="border-t border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Publishing lifecycle</p>
            <div className="mt-6 space-y-1">
              {["Select audience", "Curate intelligence", "Review narrative", "Publish snapshot", "Share decision context"].map((label, index) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-amber-200">{index + 1}</span>
                  <span className="text-sm font-medium text-stone-200">{label}</span>
                  {index < 4 ? <span className="ml-auto text-stone-600">↓</span> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </WorkspaceOverview>

      <WorkspaceContent aria-labelledby="editions-heading">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div><h2 id="editions-heading" className="text-xl font-semibold text-stone-950">Report editions</h2><p className="mt-1 text-sm text-stone-600">Begin with the audience—not a file format.</p></div>
          <p className="text-xs text-stone-500">Point-in-time snapshots · Versioned at publication</p>
        </div>
        <div className="mt-5 grid overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm lg:grid-cols-[260px_1fr]">
          <nav aria-label="Report editions" className="border-b border-stone-200 bg-stone-50 p-3 lg:border-b-0 lg:border-r">
            <div className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
              {editions.map((edition) => {
                const Icon = edition.icon;
                const selected = edition.id === activeEdition;
                return <button key={edition.id} type="button" onClick={() => setActiveEdition(edition.id)} className={["flex min-w-max items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600 lg:w-full", selected ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"].join(" ")} aria-current={selected ? "page" : undefined}><Icon aria-hidden="true" className="h-4 w-4" /><span>{edition.shortTitle}</span></button>;
              })}
            </div>
          </nav>
          <div className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row">
              <div>
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${active.color}`}><active.icon aria-hidden="true" className="h-5 w-5" /></span>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{active.audience}</p>
                <h3 className="mt-2 text-2xl font-semibold text-stone-950">{active.title}</h3>
                <p className="mt-2 text-base font-medium text-teal-800">{active.question}</p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">{active.description}</p>
              </div>
              {active.id !== "exports" ? <button type="button" onClick={() => openGenerator(active.id)} className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-teal-600">Create edition <ChevronRight aria-hidden="true" className="h-4 w-4" /></button> : null}
            </div>
            <div className="mt-7 grid gap-3 border-t border-stone-200 pt-6 sm:grid-cols-3">
              <NarrativePart title="What happened?" description="Trusted performance metrics and material changes." />
              <NarrativePart title="Why does it matter?" description="Insights, supporting evidence, and audience context." />
              <NarrativePart title="What happens next?" description="Prioritized recommendations and accountable actions." />
            </div>
          </div>
        </div>
      </WorkspaceContent>

      <WorkspaceActivity aria-labelledby="recent-reports">
        <div className="flex items-end justify-between gap-4"><div><h2 id="recent-reports" className="text-xl font-semibold text-stone-950">Recent reports</h2><p className="mt-1 text-sm text-stone-600">Published snapshots preserve exactly what each audience received.</p></div><button type="button" className="hidden text-sm font-semibold text-stone-600 hover:text-stone-950 sm:inline-flex">View archive</button></div>
        <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          {recentReports.map((report) => {
            const Icon = report.icon;
            return (
              <article key={report.id} className="grid gap-4 border-b border-stone-200 p-5 last:border-b-0 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-stone-700"><Icon aria-hidden="true" className="h-5 w-5" /></span>
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-stone-950">{report.title}</h3><span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-800">{report.status}</span></div><p className="mt-1 text-xs text-stone-500">{report.edition} · {report.audience}</p><p className="mt-2 text-xs text-stone-400">{report.period} · Published {report.published}</p></div>
                <div className="flex gap-2 sm:justify-end"><button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-600 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-teal-600" aria-label={`Share ${report.title}`}><Share2 aria-hidden="true" className="h-4 w-4" /></button><button type="button" className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-teal-600">View snapshot <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></button></div>
              </article>
            );
          })}
        </div>
      </WorkspaceActivity>

      <WorkspaceSupporting className="grid gap-4 md:grid-cols-3">
        <FeatureCard icon={CalendarClock} title="Scheduled" description="Recurring delivery is planned for a future release. Every delivery will create a new immutable snapshot." />
        <FeatureCard icon={UsersRound} title="Shared" description="Share links and audience access are planned. Distribution will preserve report version and context." />
        <FeatureCard icon={Archive} title="Archive" description="Published reports remain available as an auditable record of what was communicated." />
      </WorkspaceSupporting>

      {generatorOpen ? <ReportGenerator step={step} setStep={setStep} audience={audience} setAudience={setAudience} reportType={reportType} setReportType={setReportType} onClose={() => setGeneratorOpen(false)} /> : null}
    </WorkspacePage>
  );
}

function NarrativePart({ title, description }: Readonly<{ title: string; description: string }>) {
  return <div className="rounded-2xl bg-stone-50 p-4"><p className="text-sm font-semibold text-stone-900">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{description}</p></div>;
}

function FeatureCard({ icon: Icon, title, description }: Readonly<{ icon: LucideIcon; title: string; description: string }>) {
  return <article className="rounded-2xl border border-stone-200 bg-white p-5"><Icon aria-hidden="true" className="h-5 w-5 text-stone-500" /><h2 className="mt-4 text-sm font-semibold text-stone-950">{title}</h2><p className="mt-2 text-xs leading-5 text-stone-500">{description}</p></article>;
}

function ReportGenerator({ step, setStep, audience, setAudience, reportType, setReportType, onClose }: Readonly<{ step: number; setStep: (step: number) => void; audience: string; setAudience: (audience: string) => void; reportType: EditionId; setReportType: (type: EditionId) => void; onClose: () => void }>) {
  const selectedEdition = editions.find((edition) => edition.id === reportType) ?? editions[0];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="generator-title">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-start justify-between border-b border-stone-200 p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-700">Hospitality Performance Report</p><h2 id="generator-title" className="mt-2 text-xl font-semibold text-stone-950">Generate a decision-ready report</h2></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100" aria-label="Close report generator"><X aria-hidden="true" className="h-5 w-5" /></button></header>
        <div className="flex border-b border-stone-200 px-5 sm:px-6">{["Audience", "Report type", "Scope"].map((label, index) => <div key={label} className={["flex-1 border-b-2 py-3 text-center text-xs font-semibold", step === index + 1 ? "border-teal-700 text-teal-800" : step > index + 1 ? "border-stone-300 text-stone-600" : "border-transparent text-stone-400"].join(" ")}>{step > index + 1 ? <Check aria-hidden="true" className="mr-1 inline h-3 w-3" /> : null}{label}</div>)}</div>
        <div className="p-5 sm:p-6">
          {step === 1 ? <div><h3 className="font-semibold text-stone-950">Who needs to understand this?</h3><p className="mt-1 text-sm text-stone-500">The audience shapes narrative depth, evidence, and recommendations.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{["Executive team", "Property owner", "Investor or partner", "Lender", "Operations team", "CPA or advisor"].map((item) => <button key={item} type="button" onClick={() => setAudience(item)} className={["flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600", audience === item ? "border-teal-700 bg-teal-50 text-teal-950" : "border-stone-200 text-stone-700 hover:border-stone-300"].join(" ")}><span className={["flex h-5 w-5 items-center justify-center rounded-full border", audience === item ? "border-teal-700 bg-teal-700 text-white" : "border-stone-300"].join(" ")}>{audience === item ? <Check aria-hidden="true" className="h-3 w-3" /> : null}</span>{item}</button>)}</div></div> : null}
          {step === 2 ? <div><h3 className="font-semibold text-stone-950">Which report serves this audience?</h3><p className="mt-1 text-sm text-stone-500">Choose the HPR edition that matches the decision.</p><div className="mt-5 space-y-2">{editions.slice(0, 5).map((edition) => <button key={edition.id} type="button" onClick={() => setReportType(edition.id)} className={["flex w-full items-center gap-3 rounded-2xl border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-600", reportType === edition.id ? "border-teal-700 bg-teal-50" : "border-stone-200 hover:border-stone-300"].join(" ")}><edition.icon aria-hidden="true" className="h-5 w-5 text-stone-600" /><span className="flex-1"><span className="block text-sm font-semibold text-stone-900">{edition.title}</span><span className="mt-0.5 block text-xs text-stone-500">{edition.question}</span></span>{reportType === edition.id ? <Check aria-hidden="true" className="h-4 w-4 text-teal-700" /> : null}</button>)}</div></div> : null}
          {step === 3 ? <div><h3 className="font-semibold text-stone-950">Define the point-in-time snapshot</h3><p className="mt-1 text-sm text-stone-500">Generation will curate existing intelligence; it will not recalculate source metrics.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><GeneratorField label="Properties" value="All properties (3)" /><GeneratorField label="Reporting period" value="July 1–24, 2026" /></div><div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Report brief</p><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-stone-500">Audience</dt><dd className="font-semibold text-stone-800">{audience}</dd></div><div className="flex justify-between gap-3"><dt className="text-stone-500">Edition</dt><dd className="font-semibold text-stone-800">{selectedEdition.title}</dd></div><div className="flex justify-between gap-3"><dt className="text-stone-500">Snapshot</dt><dd className="font-semibold text-stone-800">As of Jul 24, 2026</dd></div></dl></div><div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />Generation will become available when report composition services are connected. This flow currently defines the report brief.</div></div> : null}
        </div>
        <footer className="flex items-center justify-between border-t border-stone-200 p-5 sm:px-6"><button type="button" onClick={() => step === 1 ? onClose() : setStep(step - 1)} className="text-sm font-semibold text-stone-600 hover:text-stone-950">{step === 1 ? "Cancel" : "Back"}</button>{step < 3 ? <button type="button" onClick={() => setStep(step + 1)} className="inline-flex items-center gap-1 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white">Continue <ArrowRight aria-hidden="true" className="h-4 w-4" /></button> : <button type="button" disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white opacity-40"><FileBarChart aria-hidden="true" className="h-4 w-4" />Generate snapshot</button>}</footer>
      </div>
    </div>
  );
}

function GeneratorField({ label, value }: Readonly<{ label: string; value: string }>) {
  return <label className="block"><span className="text-xs font-semibold text-stone-700">{label}</span><button type="button" className="mt-2 flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left text-sm text-stone-800">{value}<ChevronRight aria-hidden="true" className="h-4 w-4 text-stone-400" /></button></label>;
}
