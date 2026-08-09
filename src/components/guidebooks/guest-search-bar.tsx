"use client";

import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { PublicGuidebookView } from "@/features/guidebook-studio";

type SearchEntry = {
  sectionKey: string;
  sectionTitle: string;
  text: string;
  kind: "section" | "recommendation";
};

export function GuestSearchBar({
  guidebook,
  track,
}: {
  guidebook: PublicGuidebookView;
  track: (event: string, section: string, target: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo<SearchEntry[]>(() => {
    const entries: SearchEntry[] = guidebook.sections.map((section) => ({
      sectionKey: section.key,
      sectionTitle: section.title,
      text: [
        section.title,
        ...section.blocks.flatMap((block) => [
          block.text,
          block.name,
          block.label,
          block.caption,
          ...(block.items ?? []),
        ]),
      ]
        .filter(Boolean)
        .join(" · "),
      kind: "section" as const,
    }));
    for (const item of guidebook.recommendations)
      entries.push({
        sectionKey: "recommendations",
        sectionTitle: item.title,
        text: [item.category, item.title, item.description]
          .filter(Boolean)
          .join(" · "),
        kind: "recommendation",
      });
    return entries;
  }, [guidebook.sections, guidebook.recommendations]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return index
      .filter((entry) => entry.text.toLowerCase().includes(term))
      .slice(0, 8);
  }, [index, query]);

  function go(entry: SearchEntry) {
    document
      .getElementById(entry.sectionKey)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    track("search-result-click", entry.sectionKey, entry.kind);
    setQuery("");
    inputRef.current?.blur();
  }

  const open = query.trim().length >= 2;

  return (
    <div className="relative mx-auto w-full max-w-md px-1 pb-2">
      <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 shadow-sm">
        <Search className="size-4 shrink-0 text-stone-400" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
            if (event.key === "Enter" && matches[0]) go(matches[0]);
          }}
          placeholder="Search this guide…"
          aria-label="Search this guide"
          className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="shrink-0 text-stone-400"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="absolute inset-x-1 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-xl">
          {matches.length ? (
            <ul>
              {matches.map((entry, position) => (
                <li key={`${entry.sectionKey}-${position}`}>
                  <button
                    type="button"
                    onClick={() => go(entry)}
                    className="block w-full px-4 py-3 text-left hover:bg-stone-50"
                  >
                    <p className="text-sm font-semibold text-stone-900">
                      {entry.sectionTitle}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">
                      {excerpt(entry.text, query)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-stone-500">
              No matches. Try a different word — like &quot;wifi&quot; or
              &quot;parking.&quot;
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function excerpt(text: string, query: string) {
  const term = query.trim().toLowerCase();
  const position = text.toLowerCase().indexOf(term);
  if (position === -1) return text.slice(0, 90);
  const start = Math.max(0, position - 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + 90)}…`;
}
