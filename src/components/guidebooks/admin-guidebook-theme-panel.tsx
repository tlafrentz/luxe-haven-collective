"use client";

import { useState } from "react";
import { updateGuidebookBrandAction } from "@/app/actions/guidebook-brand";
import type { GuidebookBrandIdentity } from "@/features/guidebook-studio";

const DEFAULT_PRIMARY = "#1d1a17";
const DEFAULT_ACCENT = "#d7b77d";

export function AdminGuidebookThemePanel({
  guidebookId,
  workspaceId,
  brand,
}: {
  guidebookId: string;
  workspaceId: string;
  brand: GuidebookBrandIdentity | null | undefined;
}) {
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    brand?.primaryColor ?? DEFAULT_PRIMARY,
  );
  const [accentColor, setAccentColor] = useState(
    brand?.accentColor ?? DEFAULT_ACCENT,
  );

  return (
    <section className="rounded-2xl border bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
        Theme &amp; brand
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_.7fr]">
        <form action={updateGuidebookBrandAction} className="space-y-4">
          <input type="hidden" name="guidebookId" value={guidebookId} />
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <label className="block text-sm font-medium text-stone-700">
            Logo URL
            <input
              type="url"
              name="logoUrl"
              placeholder="https://…"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-stone-700">
              Primary color
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  name="primaryColor"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="h-10 w-12 shrink-0 rounded-lg border border-stone-200"
                />
                <span className="font-mono text-xs text-stone-500">
                  {primaryColor}
                </span>
              </div>
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Accent color
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  name="accentColor"
                  value={accentColor}
                  onChange={(event) => setAccentColor(event.target.value)}
                  className="h-10 w-12 shrink-0 rounded-lg border border-stone-200"
                />
                <span className="font-mono text-xs text-stone-500">
                  {accentColor}
                </span>
              </div>
            </label>
          </div>
          <button className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
            Save theme
          </button>
        </form>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Preview
          </p>
          <div
            className="mt-3 overflow-hidden rounded-xl border border-stone-200"
            style={{ backgroundColor: "#fff" }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ backgroundColor: primaryColor }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-8 w-8 rounded-full bg-white object-contain"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-white/30" />
              )}
              <span className="text-sm font-semibold text-white">
                Guest guide
              </span>
            </div>
            <div className="space-y-2 p-4">
              <div
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: accentColor }}
              >
                Sample button
              </div>
              <p className="text-xs text-stone-500">
                This preview approximates guest-facing colors. Uploaded
                images are validated separately in the block editor below.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
