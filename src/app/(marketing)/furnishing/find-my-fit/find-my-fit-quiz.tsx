"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import {
  furnishingPackages,
  furnishingPackagesBySlug,
  type FurnishingPackageSlug,
} from "@/lib/furnishing-packages";

type ProjectType = "new" | "existing" | "multi" | "exploring";
type ServicePreference = "delivery" | "installation" | "styling" | "concierge";

type Answers = {
  projectType: ProjectType;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  approxSize: string;
  targetBudget: number | null;
  launchDate: string;
  servicePreferences: ServicePreference[];
  zip: string;
};

const defaultAnswers: Answers = {
  projectType: "new",
  propertyType: "short_term_rental",
  bedrooms: 2,
  bathrooms: 2,
  approxSize: "",
  targetBudget: null,
  launchDate: "",
  servicePreferences: [],
  zip: "",
};

function recommend(answers: Answers): {
  slug: FurnishingPackageSlug;
  reasons: string[];
} {
  const scores: Record<FurnishingPackageSlug, number> = {
    essential: 0,
    elevated: 0,
    luxury: 0,
  };
  const reasons: string[] = [];

  const budget = answers.targetBudget;
  if (budget !== null) {
    if (budget < 6000) {
      scores.essential += 2;
      reasons.push(`Your target budget of $${budget.toLocaleString()} fits Essential's starting price.`);
    } else if (budget < 10500) {
      scores.elevated += 2;
      reasons.push(`Your target budget of $${budget.toLocaleString()} fits Elevated's starting price.`);
    } else {
      scores.luxury += 2;
      reasons.push(`Your target budget of $${budget.toLocaleString()} fits Luxury's starting price.`);
    }
  } else {
    scores.elevated += 1;
  }

  if (answers.bedrooms <= 2) {
    scores.essential += 1;
    reasons.push(`${answers.bedrooms} bedroom${answers.bedrooms === 1 ? "" : "s"} fits within Essential's coverage.`);
  } else if (answers.bedrooms <= 3) {
    scores.elevated += 1;
    reasons.push(`${answers.bedrooms} bedrooms fits within Elevated's coverage.`);
  } else {
    scores.luxury += 1;
    reasons.push(`${answers.bedrooms} bedrooms needs Luxury's whole-property coverage.`);
  }

  const prefs = answers.servicePreferences;
  if (prefs.includes("concierge")) {
    scores.luxury += 2;
    reasons.push("You want a dedicated concierge project manager, included only on Luxury.");
  }
  if (prefs.includes("installation") || prefs.includes("styling")) {
    scores.elevated += 1;
    scores.luxury += 1;
    reasons.push("You want installation and styling support, included on Elevated and Luxury.");
  }
  if (prefs.length === 0) {
    scores.essential += 1;
  }

  if (answers.projectType === "multi") {
    scores.luxury += 1;
    reasons.push("Multi-property projects typically benefit from Luxury's dedicated concierge.");
  }

  const winner = (Object.keys(scores) as FurnishingPackageSlug[]).reduce((a, b) =>
    scores[b] > scores[a] ? b : a,
  );

  return { slug: winner, reasons: reasons.slice(0, 3) };
}

export function FurnishingFindMyFitQuiz() {
  const [answers, setAnswers] = useState<Answers>(defaultAnswers);
  const [result, setResult] = useState<ReturnType<typeof recommend> | null>(
    null,
  );

  const toggleService = (pref: ServicePreference) => {
    setAnswers((prev) => ({
      ...prev,
      servicePreferences: prev.servicePreferences.includes(pref)
        ? prev.servicePreferences.filter((x) => x !== pref)
        : [...prev.servicePreferences, pref],
    }));
  };

  const submit = () => {
    setResult(recommend(answers));
  };

  if (result) {
    const pkg = furnishingPackagesBySlug[result.slug];
    const configureParams = new URLSearchParams({
      package: pkg.slug,
      propertyType: answers.propertyType,
      bedrooms: String(answers.bedrooms),
      bathrooms: String(answers.bathrooms),
      ...(answers.targetBudget ? { budget: String(answers.targetBudget) } : {}),
      ...(answers.launchDate ? { launchDate: answers.launchDate } : {}),
      ...(answers.zip ? { zip: answers.zip } : {}),
    });
    return (
      <div className="rounded-xl border border-[#dce2dd] bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
          Recommended for you
        </p>
        <h2 className="mt-3 font-serif text-3xl">{pkg.name}</h2>
        <p className="mt-2 text-2xl font-bold">
          {pkg.priceLabel}
          <span className="ml-1 text-sm font-normal text-stone-500">
            starting at
          </span>
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
          <Link
            href={`/furnishing/purchase/configure?${configureParams.toString()}`}
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
            {furnishingPackages.map((option) => (
              <Link
                key={option.slug}
                href={`/furnishing/packages/${option.slug}`}
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
        <label className="text-sm font-semibold">
          Project type
          <select
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.projectType}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                projectType: e.target.value as ProjectType,
              }))
            }
          >
            <option value="new">A new property</option>
            <option value="existing">Updating an existing property</option>
            <option value="multi">Multiple properties</option>
            <option value="exploring">I&apos;m still exploring</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Property type
          <select
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.propertyType}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, propertyType: e.target.value }))
            }
          >
            <option value="short_term_rental">Short-term rental</option>
            <option value="mid_term_rental">Mid-term rental</option>
            <option value="boutique_hotel">Boutique hotel</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Bedrooms
          <input
            type="number"
            min={0}
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.bedrooms}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                bedrooms: Number(e.target.value) || 0,
              }))
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Bathrooms
          <input
            type="number"
            min={0}
            step={0.5}
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.bathrooms}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                bathrooms: Number(e.target.value) || 0,
              }))
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Approximate size (sq ft)
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 1,800"
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.approxSize}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, approxSize: e.target.value }))
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Target furnishing budget
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 8000"
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.targetBudget ?? ""}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                targetBudget: e.target.value
                  ? Number(e.target.value.replace(/[^0-9]/g, ""))
                  : null,
              }))
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Desired launch date
          <input
            type="date"
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.launchDate}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, launchDate: e.target.value }))
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Market or ZIP code
          <input
            type="text"
            placeholder="e.g. 85254"
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm"
            value={answers.zip}
            onChange={(e) => setAnswers((a) => ({ ...a, zip: e.target.value }))}
          />
        </label>
      </div>
      <fieldset className="mt-5">
        <legend className="text-sm font-semibold">
          Which services matter most to you?
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["delivery", "Delivery"],
              ["installation", "Installation"],
              ["styling", "Styling"],
              ["concierge", "Concierge"],
            ] as [ServicePreference, string][]
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${answers.servicePreferences.includes(value) ? "border-emerald-800 bg-emerald-50" : "border-stone-300"}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={answers.servicePreferences.includes(value)}
                onChange={() => toggleService(value)}
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
