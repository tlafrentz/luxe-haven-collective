"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceDraft } from "./use-workspace-draft";
import {
  businessTypeLabels,
  integrationOptions,
  isWorkspaceConfigComplete,
  primaryGoalLabels,
  propertyCountLabels,
  type BusinessType,
  type PrimaryGoal,
  type PropertyCount,
} from "./types";
import { track } from "@/lib/analytics/track";
import type { Plan } from "@/lib/plans";
import type { BillingCycle } from "@/components/marketing/billing-toggle";

export function ConfigureWorkspaceForm({
  plan,
  billing,
}: {
  plan: Plan;
  billing: BillingCycle;
}) {
  const router = useRouter();
  const { answers, setAnswers, draftReady } = useWorkspaceDraft(`${plan.slug}:${billing}`);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    track("plan_selected", { plan: plan.slug, billing });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const complete = isWorkspaceConfigComplete(answers);

  function handleContinue() {
    setSubmitted(true);
    if (!isWorkspaceConfigComplete(answers)) return;
    track("workspace_configuration_completed", {
      plan: plan.slug,
      billing,
      businessType: answers.businessType,
      propertyCount: answers.propertyCount,
      primaryGoal: answers.primaryGoal,
    });
    router.push(`/commerce/create-account?plan=${plan.slug}&billing=${billing}`);
  }

  if (!draftReady) {
    return <div className="h-96" aria-hidden />;
  }

  return (
    <div className="rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
      <h1 className="font-serif text-4xl">Let&apos;s prepare your workspace.</h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
        We&apos;ll configure your workspace based on this today. A few quick questions before you
        create your account.
      </p>

      <fieldset className="mt-8">
        <legend className="text-sm font-bold uppercase tracking-[.14em] text-[#a56b19]">
          1. What best describes your business?
        </legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(businessTypeLabels) as BusinessType[]).map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border p-4 text-center font-semibold transition ${
                answers.businessType === value
                  ? "border-[#087251] bg-[#eff8f3] ring-2 ring-[#087251]/20"
                  : "border-[#dce2dd] bg-white hover:border-[#8da098]"
              }`}
            >
              <input
                type="radio"
                name="businessType"
                value={value}
                checked={answers.businessType === value}
                onChange={() => setAnswers((a) => ({ ...a, businessType: value }))}
                className="sr-only"
              />
              {businessTypeLabels[value]}
            </label>
          ))}
        </div>
        {submitted && !answers.businessType ? (
          <p className="mt-2 text-xs font-semibold text-red-700">Choose a business type.</p>
        ) : null}
      </fieldset>

      <fieldset className="mt-8">
        <legend className="text-sm font-bold uppercase tracking-[.14em] text-[#a56b19]">
          2. How many properties do you manage?
        </legend>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {(Object.keys(propertyCountLabels) as PropertyCount[]).map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border p-4 text-center font-semibold transition ${
                answers.propertyCount === value
                  ? "border-[#087251] bg-[#eff8f3] ring-2 ring-[#087251]/20"
                  : "border-[#dce2dd] bg-white hover:border-[#8da098]"
              }`}
            >
              <input
                type="radio"
                name="propertyCount"
                value={value}
                checked={answers.propertyCount === value}
                onChange={() => setAnswers((a) => ({ ...a, propertyCount: value }))}
                className="sr-only"
              />
              {propertyCountLabels[value]}
            </label>
          ))}
        </div>
        {submitted && !answers.propertyCount ? (
          <p className="mt-2 text-xs font-semibold text-red-700">Choose a property count.</p>
        ) : null}
      </fieldset>

      <fieldset className="mt-8">
        <legend className="text-sm font-bold uppercase tracking-[.14em] text-[#a56b19]">
          3. What is your primary goal?
        </legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(Object.keys(primaryGoalLabels) as PrimaryGoal[]).map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border p-4 text-center font-semibold transition ${
                answers.primaryGoal === value
                  ? "border-[#087251] bg-[#eff8f3] ring-2 ring-[#087251]/20"
                  : "border-[#dce2dd] bg-white hover:border-[#8da098]"
              }`}
            >
              <input
                type="radio"
                name="primaryGoal"
                value={value}
                checked={answers.primaryGoal === value}
                onChange={() => setAnswers((a) => ({ ...a, primaryGoal: value }))}
                className="sr-only"
              />
              {primaryGoalLabels[value]}
            </label>
          ))}
        </div>
        {submitted && !answers.primaryGoal ? (
          <p className="mt-2 text-xs font-semibold text-red-700">Choose a primary goal.</p>
        ) : null}
      </fieldset>

      <fieldset className="mt-8">
        <legend className="text-sm font-bold uppercase tracking-[.14em] text-stone-500">
          4. Which integrations do you use? (optional)
        </legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {integrationOptions.map((integration) => {
            const checked = answers.integrations?.includes(integration) ?? false;
            return (
              <label
                key={integration}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                  checked
                    ? "border-[#087251] bg-[#eff8f3] text-[#087251]"
                    : "border-[#dce2dd] bg-white text-stone-600 hover:border-[#8da098]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setAnswers((a) => {
                      const current = a.integrations ?? [];
                      const integrations = current.includes(integration)
                        ? current.filter((item) => item !== integration)
                        : [...current, integration];
                      return { ...a, integrations };
                    })
                  }
                  className="sr-only"
                />
                {integration}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-8 block max-w-xs text-sm font-semibold text-stone-700">
        Preferred onboarding date (optional)
        <input
          type="date"
          value={answers.preferredOnboardingDate ?? ""}
          onChange={(event) =>
            setAnswers((a) => ({ ...a, preferredOnboardingDate: event.target.value || undefined }))
          }
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 font-normal outline-none ring-brass/20 focus:ring-4"
        />
      </label>

      <div className="mt-9 flex items-center justify-between">
        <span />
        <button
          type="button"
          onClick={handleContinue}
          className="inline-flex min-h-11 items-center rounded-md bg-emerald-900 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          Continue
        </button>
      </div>
      {submitted && !complete ? (
        <p className="mt-3 text-right text-xs font-semibold text-red-700">
          Answer the required questions above to continue.
        </p>
      ) : null}
    </div>
  );
}
