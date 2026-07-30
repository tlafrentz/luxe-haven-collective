"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { DecisionReadinessCard } from "./decision-readiness-card";
import { FinancingCard } from "./financing-card";
import { GenerateInvestmentAnalysisCard } from "./generate-investment-analysis-card";
import { InvestmentAnalysisResults } from "./investment-analysis-results";
import { InvestmentMarketEvidencePanel } from "./investment-market-evidence-panel";
import { LiveInvestmentSummary } from "./live-investment-summary";
import { OperatingPlanCard } from "./operating-plan-card";
import { PropertyProfileCard } from "./property-profile-card";
import { RevenueAssumptionsCard } from "./revenue-assumptions-card";
import { useInvestmentWorkspaceState } from "./investment-workspace-state";

const STEPS = [
  { id: "property", label: "Property", description: "Asset & location details" },
  { id: "capital-structure", label: "Capital Structure", description: "Financing & acquisition costs" },
  { id: "revenue-operations", label: "Revenue & Operations", description: "Operating assumptions & forecast" },
  { id: "intelligence", label: "Intelligence", description: "Market & financial intelligence" },
  { id: "decision-summary", label: "Decision Summary", description: "Recommendation & next steps" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function InvestmentAnalysisStepPages({ resultsActions }: { resultsActions?: ReactNode }) {
  const { currentAnalysis } = useInvestmentWorkspaceState();
  const [step, setStep] = useState<StepId>(() => readStep());
  const index = STEPS.findIndex(item => item.id === step);
  const previousAnalysisStatus = useRef(currentAnalysis.status);

  useEffect(() => {
    const restore = () => setStep(readStep());
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    const justCompleted = previousAnalysisStatus.current !== "completed" && currentAnalysis.status === "completed";
    previousAnalysisStatus.current = currentAnalysis.status;
    if (justCompleted && step === "intelligence") {
      goTo("decision-summary", setStep);
    }
  }, [currentAnalysis.status, step]);

  const nextDisabled = step === "intelligence" && currentAnalysis.status !== "completed";

  return (
    <div className="space-y-7">
      <nav aria-label="Investment analysis progress" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <ol className="grid divide-y divide-neutral-200 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          {STEPS.map((item, itemIndex) => {
            const active = item.id === step;
            const complete = itemIndex < index || (item.id === "intelligence" && currentAnalysis.status === "completed");
            return (
              <li key={item.id}>
                <button type="button" onClick={() => goTo(item.id, setStep)} aria-current={active ? "step" : undefined} className={`flex h-full w-full items-start gap-3 px-4 py-4 text-left transition ${active ? "bg-neutral-950 text-white" : "hover:bg-neutral-50"}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${active ? "border-white/40 bg-white text-neutral-950" : complete ? "border-emerald-700 bg-emerald-700 text-white" : "border-neutral-300 bg-neutral-50 text-neutral-700"}`}>
                    {complete ? <Check className="h-3.5 w-3.5" /> : itemIndex + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className={`mt-1 block text-xs leading-5 ${active ? "text-white/65" : "text-neutral-500"}`}>{item.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby={`${step}-title`} className="space-y-6">
        <header className="border-b border-neutral-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Step {index + 1} of {STEPS.length}</p>
          <h2 id={`${step}-title`} className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">{STEPS[index].label}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{STEPS[index].description}</p>
        </header>

        {step === "property" ? <div className="mx-auto max-w-4xl"><PropertyProfileCard /></div> : null}
        {step === "capital-structure" ? <div className="mx-auto max-w-4xl"><FinancingCard /></div> : null}
        {step === "revenue-operations" ? <div className="grid gap-6 xl:grid-cols-2"><RevenueAssumptionsCard /><OperatingPlanCard /></div> : null}
        {step === "intelligence" ? <div className="space-y-7"><InvestmentMarketEvidencePanel /><LiveInvestmentSummary /><div className="grid gap-8 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)]"><DecisionReadinessCard /><GenerateInvestmentAnalysisCard /></div></div> : null}
        {step === "decision-summary" ? <div className="space-y-7"><InvestmentAnalysisResults />{resultsActions}</div> : null}
      </section>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
        <button type="button" disabled={index === 0} onClick={() => goTo(STEPS[index - 1].id, setStep)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 px-5 text-sm font-semibold disabled:invisible"><ArrowLeft className="h-4 w-4" /> Back</button>
        {index < STEPS.length - 1 ? <button type="button" disabled={nextDisabled} onClick={() => goTo(STEPS[index + 1].id, setStep)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Continue <ArrowRight className="h-4 w-4" /></button> : null}
      </div>
    </div>
  );
}

function readStep(): StepId {
  if (typeof window === "undefined") return "property";
  const value = new URL(window.location.href).searchParams.get("step");
  return STEPS.some(item => item.id === value) ? value as StepId : "property";
}

function goTo(step: StepId, update: (step: StepId) => void) {
  const url = new URL(window.location.href);
  url.searchParams.set("step", step);
  window.history.pushState({}, "", url);
  update(step);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
