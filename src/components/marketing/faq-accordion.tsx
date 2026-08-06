"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Faq } from "@/lib/faqs";

export function FaqAccordion({
  faqs,
  searchable = false,
}: {
  faqs: Faq[];
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    if (!searchable || !query.trim()) return faqs;
    const needle = query.trim().toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(needle) ||
        faq.answer.toLowerCase().includes(needle),
    );
  }, [faqs, query, searchable]);

  return (
    <div>
      {searchable ? (
        <div className="relative mb-5">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400"
          />
          <label htmlFor="faq-search" className="sr-only">
            Search frequently asked questions
          </label>
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions..."
            className="w-full rounded-xl border border-[#dce2dd] bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-emerald-700"
          />
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-[#dce2dd] p-6 text-sm text-stone-500"
        >
          No questions match &quot;{query}&quot;. Try a different search or{" "}
          <a href="/contact" className="underline">
            contact us
          </a>
          .
        </p>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="divide-y rounded-xl border border-[#dce2dd] bg-white"
        >
          {visible.map((faq) => (
            <details key={faq.id} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
                {faq.question}
                <span aria-hidden className="shrink-0 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
