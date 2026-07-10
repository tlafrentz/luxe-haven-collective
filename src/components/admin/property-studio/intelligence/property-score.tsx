"use client";

import { usePropertyStudio } from "@/components/admin/property-studio";

type ScoreItem = {
  label: string;
  score: number;
  reason: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function calculateScores(draft: Record<string, unknown>): ScoreItem[] {
  const headline = String(draft.headline ?? draft.name ?? "");
  const description = String(draft.description ?? "");
  const shortDescription = String(draft.short_description ?? "");
  const city = String(draft.city ?? "");
  const amenities = getArray(draft.amenities);
  const highlights = getArray(draft.highlights);
  const images = getArray(draft.image_urls);
  const nightlyRate = Number(draft.nightly_rate ?? 0);
  const bedrooms = Number(draft.bedrooms ?? 0);
  const maxGuests = Number(draft.max_guests ?? 0);

  const seoScore = clamp(
    35 +
      Math.min(headline.length, 70) * 0.45 +
      (city && headline.toLowerCase().includes(city.toLowerCase()) ? 15 : 0) +
      (shortDescription.length > 120 ? 15 : 0),
  );

  const contentScore = clamp(
    25 +
      Math.min(description.length, 800) * 0.06 +
      (highlights.length >= 3 ? 15 : highlights.length * 4) +
      (headline.length >= 35 ? 10 : 0),
  );

  const amenityScore = clamp(
    25 +
      Math.min(amenities.length, 15) * 4 +
      (amenities.some((a) => a.toLowerCase().includes("wifi")) ? 10 : 0) +
      (amenities.some((a) => a.toLowerCase().includes("parking")) ? 10 : 0),
  );

  const photoScore = clamp(
    20 +
      Math.min(images.length, 12) * 6 +
      (String(draft.featured_image_url ?? "") ? 12 : 0),
  );

  const pricingScore = clamp(
    45 +
      (nightlyRate > 0 ? 20 : 0) +
      (bedrooms > 0 ? 10 : 0) +
      (maxGuests > 0 ? 10 : 0),
  );

  return [
    {
      label: "SEO",
      score: Math.round(seoScore),
      reason: "Headline, location usage, and short description strength.",
    },
    {
      label: "Content",
      score: Math.round(contentScore),
      reason: "Depth of description, highlights, and guest-facing storytelling.",
    },
    {
      label: "Amenities",
      score: Math.round(amenityScore),
      reason: "Completeness of amenity list and high-value guest conveniences.",
    },
    {
      label: "Photos",
      score: Math.round(photoScore),
      reason: "Gallery depth and featured image readiness.",
    },
    {
      label: "Pricing",
      score: Math.round(pricingScore),
      reason: "Base rate, occupancy details, and stay configuration.",
    },
  ];
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Needs polish";
  return "Opportunity";
}

export function PropertyScore() {
  const { draft } = usePropertyStudio();
  const scores = calculateScores(draft);
  const overall = Math.round(
    scores.reduce((sum, item) => sum + item.score, 0) / scores.length,
  );

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brass">
        Property Intelligence
      </p>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-serif text-5xl text-white">{overall}</p>
          <p className="mt-1 text-sm text-white/45">Property Score</p>
        </div>

        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          {getScoreLabel(overall)}
        </span>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-brass"
          style={{ width: `${overall}%` }}
        />
      </div>

      <div className="mt-6 grid gap-3">
        {scores.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="text-sm font-semibold text-white/75">{item.score}/100</p>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/60"
                style={{ width: `${item.score}%` }}
              />
            </div>

            <p className="mt-3 text-xs leading-5 text-white/45">{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
