"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { AcquisitionTypeSelector } from "./acquisition-type-selector";
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
  { id: "strategy", label: "Strategy", description: "Choose the investment path and identify the property." },
  { id: "property-market", label: "Property and Market", description: "Describe the asset and review the evidence available for the market." },
  { id: "revenue-operations", label: "Revenue and Operations", description: "Set revenue assumptions and recurring operating costs." },
  { id: "acquisition-capital", label: "Acquisition and Capital", description: "Enter the strategy-specific acquisition and funding assumptions." },
  { id: "review-decision", label: "Review and Decision", description: "Review assumptions, resolve blockers, and generate the decision." },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type StepState = "Not started" | "In progress" | "Complete" | "Needs attention";

export function InvestmentAnalysisStepPages({ resultsActions }: { resultsActions?: ReactNode }) {
  const workspace = useInvestmentWorkspaceState();
  const [step, setStep] = useState<StepId>(() => readStep());
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const index = STEPS.findIndex(item => item.id === step);
  const completion = useMemo(() => buildCompletion(workspace), [workspace]);

  useEffect(() => {
    const restore = () => {
      setStep(readStep());
      setValidationMessage(null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const navigate = (target: StepId) => {
    const targetIndex = STEPS.findIndex(item => item.id === target);
    if (targetIndex > index) {
      const blocker = validateStep(step, workspace);
      if (blocker) {
        setValidationMessage(blocker);
        return;
      }
    }
    setValidationMessage(null);
    goTo(target, setStep);
  };

  return (
    <div className="space-y-7">
      <nav aria-label="Investment analysis progress" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <ol className="grid divide-y divide-neutral-200 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          {STEPS.map((item, itemIndex) => {
            const active = item.id === step;
            const state = active && completion[item.id] !== "Needs attention" ? "In progress" : completion[item.id];
            return (
              <li key={item.id}>
                <button type="button" onClick={() => navigate(item.id)} aria-current={active ? "step" : undefined} className={`flex h-full w-full items-start gap-3 px-4 py-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 ${active ? "bg-neutral-950 text-white" : "hover:bg-neutral-50"}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${active ? "border-white/40 bg-white text-neutral-950" : state === "Complete" ? "border-emerald-700 bg-emerald-700 text-white" : state === "Needs attention" ? "border-amber-600 bg-amber-50 text-amber-800" : "border-neutral-300 bg-neutral-50 text-neutral-700"}`}>
                    {state === "Complete" ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : itemIndex + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className={`mt-1 block text-xs leading-5 ${active ? "text-white/70" : "text-neutral-500"}`}>{state}</span>
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

        {validationMessage ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span>{validationMessage}</span></div> : null}

        {step === "strategy" ? <div className="mx-auto max-w-4xl"><AcquisitionTypeSelector /></div> : null}
        {step === "property-market" ? <div className="space-y-6"><div className="mx-auto max-w-4xl"><PropertyProfileCard /></div><InvestmentMarketEvidencePanel /></div> : null}
        {step === "revenue-operations" ? <div className="grid gap-6 xl:grid-cols-2"><RevenueAssumptionsCard /><OperatingPlanCard /></div> : null}
        {step === "acquisition-capital" ? <div className="mx-auto max-w-4xl"><FinancingCard /></div> : null}
        {step === "review-decision" ? <div className="space-y-7"><LiveInvestmentSummary /><div className="grid gap-8 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)]"><DecisionReadinessCard /><GenerateInvestmentAnalysisCard /></div>{workspace.currentAnalysis.status === "completed" ? <><InvestmentAnalysisResults />{resultsActions}</> : null}</div> : null}
      </section>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
        <button type="button" disabled={index === 0} onClick={() => navigate(STEPS[index - 1].id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 px-5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:invisible"><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back</button>
        {index < STEPS.length - 1 ? <button type="button" onClick={() => navigate(STEPS[index + 1].id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">Continue <ArrowRight aria-hidden="true" className="h-4 w-4" /></button> : null}
      </div>
    </div>
  );
}

function buildCompletion(workspace: ReturnType<typeof useInvestmentWorkspaceState>): Record<StepId, StepState> {
  const { values, currentAnalysis } = workspace;
  return {
    strategy: values.acquisitionType ? "Complete" : "Not started",
    "property-market": values.address1.trim() && values.city.trim() && values.state.trim() && values.postalCode.trim() ? "Complete" : "Needs attention",
    "revenue-operations": values.projectedAdr > 0 && values.projectedOccupancyPercentage > 0 && values.projectedOccupancyPercentage <= 100 ? "Complete" : "Needs attention",
    "acquisition-capital": values.acquisitionType === "purchase"
      ? values.purchasePrice > 0 && values.downPaymentPercentage >= 0 ? "Complete" : "Needs attention"
      : values.monthlyLease > 0 && values.leaseTermMonths > 0 ? "Complete" : "Needs attention",
    "review-decision": currentAnalysis.status === "completed" ? "Complete" : currentAnalysis.status === "failed" ? "Needs attention" : "Not started",
  };
}

function validateStep(step: StepId, workspace: ReturnType<typeof useInvestmentWorkspaceState>): string | null {
  const { values } = workspace;
  if (step === "property-market" && (!values.address1.trim() || !values.city.trim() || !values.state.trim() || !values.postalCode.trim())) {
    return "Enter the street address, city, state, and postal code before continuing.";
  }
  if (step === "revenue-operations" && (values.projectedAdr <= 0 || values.projectedOccupancyPercentage <= 0 || values.projectedOccupancyPercentage > 100)) {
    return "Enter a positive nightly rate and an occupancy assumption between 0% and 100% before continuing.";
  }
  if (step === "acquisition-capital" && values.acquisitionType === "purchase" && values.purchasePrice <= 0) {
    return "Enter a purchase price before reviewing the decision.";
  }
  if (step === "acquisition-capital" && values.acquisitionType === "rental-arbitrage" && values.monthlyLease <= 0) {
    return "Enter the monthly rent before reviewing the decision.";
  }
  return null;
}

function readStep(): StepId {
  if (typeof window === "undefined") return "strategy";
  const value = new URL(window.location.href).searchParams.get("step");
  return STEPS.some(item => item.id === value) ? value as StepId : "strategy";
}

function goTo(step: StepId, update: (step: StepId) => void) {
  const url = new URL(window.location.href);
  url.searchParams.set("step", step);
  window.history.pushState({}, "", url);
  update(step);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
