import type { Metadata } from "next";
import Link from "next/link";
import { Building2, House, Landmark, Users } from "lucide-react";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import {
  faqAudiences,
  faqCategoriesByAudience,
  faqs,
  type FaqAudience,
} from "@/lib/faqs";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Choose the audience that best matches you to find answers about working with Luxe Haven.",
};

const audienceIcons: Record<FaqAudience, typeof House> = {
  owners: House,
  guests: Users,
  partners: Building2,
  investors: Landmark,
};

const audienceSlugs = new Set(faqAudiences.map((audience) => audience.slug));

export default async function FAQPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string; category?: string }>;
}) {
  const { audience, category } = await searchParams;
  const activeAudience: FaqAudience =
    audience && audienceSlugs.has(audience as FaqAudience)
      ? (audience as FaqAudience)
      : "owners";

  const categories = faqCategoriesByAudience[activeAudience];
  const activeCategory =
    category && categories.some((cat) => cat.slug === category) ? category : "all";

  const visibleFaqs = faqs.filter(
    (faq) =>
      faq.audience === activeAudience &&
      (activeCategory === "all" || faq.category === activeCategory),
  );

  const audienceLabel =
    faqAudiences.find((item) => item.slug === activeAudience)?.label ?? "Owners";

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
            Choose the audience that best matches you. We&apos;ll show answers tailored to you.
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {faqAudiences.map((item) => {
              const Icon = audienceIcons[item.slug];
              const active = item.slug === activeAudience;
              return (
                <Link
                  key={item.slug}
                  href={`/faq?audience=${item.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-xl border p-5 text-left transition ${
                    active
                      ? "border-emerald-800 bg-white shadow-sm"
                      : "border-[#dce2dd] bg-white hover:border-[#8da098]"
                  }`}
                >
                  <Icon className="size-6 text-emerald-800" />
                  <h2 className="mt-5 font-semibold">{item.label}</h2>
                  <p className="mt-2 text-xs leading-5 text-stone-600">
                    {item.blurb}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section className="py-14">
        <div className="container-shell grid gap-8 lg:grid-cols-[.3fr_1fr]">
          <aside>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
              {audienceLabel}
            </p>
            <nav aria-label="FAQ categories" className="mt-5 grid gap-3 text-sm">
              <Link
                href={`/faq?audience=${activeAudience}`}
                aria-current={activeCategory === "all" ? "page" : undefined}
                className={
                  activeCategory === "all"
                    ? "font-semibold text-emerald-900"
                    : "text-stone-600 hover:text-emerald-900"
                }
              >
                All Questions
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/faq?audience=${activeAudience}&category=${cat.slug}`}
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
