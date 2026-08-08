"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import {
  investmentPackages,
  investmentPackagesBySlug,
  type InvestmentPackageSlug,
} from "@/lib/investment-packages";

type Goal = "single" | "compare" | "portfolio" | "guidance";
type Timeline = "quick-look" | "serious-decision";

type Answers = {
  goal: Goal;
  strategy: string;
  timeline: Timeline;
  shareWithLender: boolean;
};

const defaultAnswers: Answers = {
  goal: "single",
  strategy: "short_term_rental",
  timeline: "serious-decision",
  shareWithLender: false,
};

function recommend(answers: Answers): {
  slug: InvestmentPackageSlug;
  reasons: string[];
  portfolioNote: boolean;
} {
  const reasons: string[] = [];
  let slug: InvestmentPackageSlug = "pro";

  if (answers.timeline === "quick-look") {
    slug = "essentials";
    reasons.push("A quick first-look snapshot fits the Essentials package.");
  } else if (answers.shareWithLender) {
    slug = "premier";
    reasons.push("Sharing your analysis with a lender or partner calls for Premier's expert review and executive report.");
  } else {
    slug = "pro";
    reasons.push("A serious purchase decision benefits from Pro's full scenario modeling and risk assessment.");
  }

  if (answers.goal === "guidance" && slug !== "premier") {
    slug = "premier";
    reasons.push("Wanting expert guidance means a licensed analyst's review, included on Premier.");
  }

  const portfolioNote = answers.goal === "portfolio";
  if (portfolioNote) {
    reasons.push("For a multi-property portfolio, start with one analysis and ask about Portfolio Advisory for ongoing coverage.");
  }

  return { slug, reasons: reasons.slice(0, 3), portfolioNote };
}

export function InvestmentFindMyFitQuiz() {
  const [answers, setAnswers] = useState<Answers>(defaultAnswers);
  const [result, setResult] = useState<ReturnType<typeof recommend> | null>(null);

  const submit = () => setResult(recommend(answers));

  if (result) {
    const pkg = investmentPackagesBySlug[result.slug];
    const configureParams = new URLSearchParams({
      package: pkg.slug,
      strategy: answers.strategy,
    });
    return (
      <div className="rounded-xl border border-[#dce2dd] bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
          Recommended for you
        </p>
        <h2 className="mt-3 font-serif text-3xl">{pkg.name}</h2>
        <p className="mt-2 text-2xl font-bold">
          {pkg.priceLabel}
          <span className="ml-1 text-sm font-normal text-stone-500">per analysis</span>
        </p>
        <p className="mt-2 text-sm text-stone-600">{pkg.tagline}</p>
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-stone-500">
            Why we recommended this
          </p>
          <ul className="mt-3 space-y-2">
            {result.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2 text-sm text-stone-700">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {result.portfolioNote ? (
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white"
            >
              Ask about Portfolio Advisory <ArrowRight className="size-4" />
            </Link>
          ) : null}
          <Link
            href={`/investment-intelligence/purchase/configure?${configureParams.toString()}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white"
          >
            Continue with {pkg.name} <ArrowRight className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="inline-flex min-h-11 items-center rounded-md border border-[#789487] bg-white px-5 text-sm font-semibold"
          >
            Retake quiz
          </button>
        </div>
        <div className="mt-6 border-t pt-5">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-stone-500">
            Prefer a different package? You can always override.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {investmentPackages.map((option) => (
              <Link
                key={option.slug}
                href={`/investment-intelligence/packages/${option.slug}`}
                className={`rounded-lg border p-3 text-sm ${option.slug === pkg.slug ? "border-emerald-800 bg-emerald-50" : ""}`}
              >
                <p className="font-semibold">{option.name}</p>
                <p className="text-stone-500">{option.priceLabel}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#dce2dd] bg-white p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">
          What are you trying to do?
          <select
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.goal}
            onChange={(e) => setAnswers((a) => ({ ...a, goal: e.target.value as Goal }))}
          >
            <option value="single">Evaluate a single property</option>
            <option value="compare">Compare multiple properties</option>
            <option value="portfolio">Build a portfolio</option>
            <option value="guidance">Need expert guidance</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Primary strategy
          <select
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.strategy}
            onChange={(e) => setAnswers((a) => ({ ...a, strategy: e.target.value }))}
          >
            <option value="short_term_rental">Short-term rental</option>
            <option value="rental_arbitrage">Rental arbitrage</option>
            <option value="mid_term_rental">Mid-term rental</option>
            <option value="traditional_rental">Traditional rental</option>
            <option value="vacation_home">Vacation home</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          How far along are you?
          <select
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.timeline}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, timeline: e.target.value as Timeline }))
            }
          >
            <option value="quick-look">Just want a quick first look</option>
            <option value="serious-decision">Actively deciding whether to move forward</option>
          </select>
        </label>
      </div>
      <fieldset className="mt-5">
        <legend className="text-sm font-semibold">
          Will you share this analysis with a lender or partner?
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            [true, "Yes"],
            [false, "No, just for me"],
          ].map(([value, label]) => (
            <label
              key={String(value)}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${answers.shareWithLender === value ? "border-emerald-800 bg-emerald-50" : "border-stone-300"}`}
            >
              <input
                type="radio"
                name="shareWithLender"
                className="sr-only"
                checked={answers.shareWithLender === value}
                onChange={() => setAnswers((a) => ({ ...a, shareWithLender: value as boolean }))}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        onClick={submit}
        className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white"
      >
        Get my recommendation <ArrowRight className="size-4" />
      </button>
      <p className="mt-4 text-center text-xs text-stone-500">
        Takes about 2 minutes. This is a starting point, not a purchase — you
        can change your package at any time before checkout.
      </p>
    </div>
  );
}
