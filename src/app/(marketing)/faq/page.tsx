import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { faqCategories, faqs, type FaqCategory } from "@/lib/faqs";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about pricing, implementation, security, support, billing, and cancellation.",
};

const categorySlugs = new Set(faqCategories.map((category) => category.slug));

export default async function FAQPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory: FaqCategory | "all" =
    category && categorySlugs.has(category as FaqCategory)
      ? (category as FaqCategory)
      : "all";

  const visibleFaqs =
    activeCategory === "all"
      ? faqs
      : faqs.filter((faq) => faq.category === activeCategory);

  return (
    <main className="bg-[#fffdf9]">
      <section className="py-14">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/resources">Resources</Link>
            <span className="mx-2">›</span>
            <span>FAQs</span>
          </nav>
          <h1 className="mt-6 font-serif text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600">
            Choose a topic below to find answers about pricing,
            implementation, security, support, billing, and cancellation.
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {faqCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/faq?category=${cat.slug}`}
                aria-current={activeCategory === cat.slug ? "page" : undefined}
                className={`rounded-xl border p-5 text-left transition ${
                  activeCategory === cat.slug
                    ? "border-emerald-800 bg-white shadow-sm"
                    : "border-[#dce2dd] bg-white hover:border-[#8da098]"
                }`}
              >
                <h2 className="font-semibold">{cat.label}</h2>
                <p className="mt-2 text-xs leading-5 text-stone-600">
                  {cat.blurb}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="py-14">
        <div className="container-shell grid gap-8 lg:grid-cols-[.3fr_1fr]">
          <aside>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
              Topics
            </p>
            <nav aria-label="FAQ categories" className="mt-5 grid gap-3 text-sm">
              <Link
                href="/faq"
                aria-current={activeCategory === "all" ? "page" : undefined}
                className={
                  activeCategory === "all"
                    ? "font-semibold text-emerald-900"
                    : "text-stone-600 hover:text-emerald-900"
                }
              >
                All
              </Link>
              {faqCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/faq?category=${cat.slug}`}
                  aria-current={activeCategory === cat.slug ? "page" : undefined}
                  className={
                    activeCategory === cat.slug
                      ? "font-semibold text-emerald-900"
                      : "text-stone-600 hover:text-emerald-900"
                  }
                >
                  {cat.label}
                </Link>
              ))}
            </nav>
          </aside>
          <FaqAccordion faqs={visibleFaqs} searchable />
        </div>
      </section>
      <section className="pb-16">
        <div className="container-shell flex flex-wrap items-center justify-between gap-5 rounded-xl bg-emerald-950 p-8 text-white">
          <div>
            <h2 className="font-serif text-3xl">Still have questions?</h2>
            <p className="mt-1 text-sm text-white/70">We’re here to help.</p>
          </div>
          <Link
            href="/contact"
            className="rounded-md border border-white/50 px-5 py-3 text-sm font-semibold"
          >
            Contact Us →
          </Link>
        </div>
      </section>
    </main>
  );
}
