"use client";

import { usePropertyStudio } from "@/components/admin/property-studio";

type Suggestion = {
  label: string;
  status: "good" | "warning" | "opportunity";
  message: string;
};

function getSuggestions(draft: Record<string, unknown>): Suggestion[] {
  const headline = String(draft.headline ?? draft.name ?? "");
  const description = String(draft.description ?? "");
  const city = String(draft.city ?? "");
  const nightlyRate = Number(draft.nightly_rate ?? 0);
  const amenities = Array.isArray(draft.amenities) ? draft.amenities : [];

  const suggestions: Suggestion[] = [];

  if (headline.length < 35) {
    suggestions.push({
      label: "Headline",
      status: "opportunity",
      message: "Headline may be too short. Add location, guest type, or nearby demand driver.",
    });
  } else {
    suggestions.push({
      label: "Headline",
      status: "good",
      message: "Headline has enough length for stronger search positioning.",
    });
  }

  if (city.toLowerCase().includes("mesa") && !headline.toLowerCase().includes("mesa")) {
    suggestions.push({
      label: "SEO",
      status: "warning",
      message: "Consider adding Mesa to the headline or short description.",
    });
  }

  if (description.length < 400) {
    suggestions.push({
      label: "Description",
      status: "opportunity",
      message: "Description is light. Add nearby attractions, guest fit, and stay experience.",
    });
  }

  if (amenities.length < 8) {
    suggestions.push({
      label: "Amenities",
      status: "warning",
      message: "Amenity list may be thin. Add WiFi, parking, workspace, laundry, coffee, and kitchen details.",
    });
  }

  if (nightlyRate > 0) {
    suggestions.push({
      label: "Pricing",
      status: "good",
      message: `Current base rate is $${nightlyRate.toLocaleString()}/night. Pricing intelligence can later compare this against comps.`,
    });
  }

  return suggestions;
}

const styles = {
  good: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-300/20 bg-amber-500/10 text-amber-100",
  opportunity: "border-sky-300/20 bg-sky-500/10 text-sky-100",
};

export function PropertyAiSidebar() {
  const { draft } = usePropertyStudio();
  const suggestions = getSuggestions(draft);

  return (
    <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brass">
        AI Assistant
      </p>

      <h3 className="mt-3 font-serif text-2xl text-white">
        Listing Intelligence
      </h3>

      <p className="mt-2 text-sm leading-6 text-white/50">
        Early rule-based recommendations. This panel will later connect to Luxe Haven AI.
      </p>

      <div className="mt-5 grid gap-3">
        {suggestions.map((item) => (
          <div
            key={`${item.label}-${item.message}`}
            className={`rounded-2xl border p-4 ${styles[item.status]}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">
              {item.label}
            </p>
            <p className="mt-2 text-sm leading-6 opacity-90">
              {item.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
