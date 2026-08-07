import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { faqs } from "@/lib/faqs";

export const metadata: Metadata = {
  title: "Guidebook Studio FAQ",
  description: "Frequently asked questions about Guidebook Studio.",
};

const guidebookFaqs = faqs.filter(
  (faq) => faq.audience === "owners" && faq.category === "guidebooks",
);

export default function GuidebookStudioFaqPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-14">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/guidebook-studio">Guidebook Studio</Link>
            <span className="mx-2">›</span>
            <span>FAQ</span>
          </nav>
          <h1 className="mt-6 font-serif text-5xl">Frequently asked questions</h1>
          <div className="mt-9 max-w-2xl">
            <FaqAccordion faqs={guidebookFaqs} />
          </div>
          <p className="mt-6 text-sm text-stone-600">
            <Link href="/faq?audience=owners&category=guidebooks" className="font-semibold underline">
              View all FAQs →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
