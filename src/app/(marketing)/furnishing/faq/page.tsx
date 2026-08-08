import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { faqs } from "@/lib/faqs";

export const metadata: Metadata = {
  title: "Furnishing Studio FAQ",
  description: "Frequently asked questions about Furnishing Studio.",
};

const furnishingFaqs = faqs.filter(
  (faq) => faq.audience === "owners" && faq.category === "furnishing",
);

export default function FurnishingStudioFaqPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-14">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/furnishing">Furnishing Studio</Link>
            <span className="mx-2">›</span>
            <span>FAQ</span>
          </nav>
          <h1 className="mt-6 font-serif text-5xl">
            Frequently asked questions
          </h1>
          <div className="mt-9 max-w-2xl">
            <FaqAccordion faqs={furnishingFaqs} />
          </div>
          <p className="mt-6 text-sm text-stone-600">
            <Link
              href="/faq?audience=owners&category=furnishing"
              className="font-semibold underline"
            >
              View all FAQs →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
