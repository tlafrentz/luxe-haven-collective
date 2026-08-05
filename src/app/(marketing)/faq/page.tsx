import Link from "next/link";
import { Building2, House, Landmark, Users } from "lucide-react";
import { ResourcesNavigation } from "@/components/marketing/resources-navigation";

const faqs = [
  [
    "Do you manage properties directly?",
    "Yes. Luxe Haven supports hospitality operations through defined management, co-hosting, consulting, and platform engagements based on property fit and market coverage.",
  ],
  [
    "How do you help increase revenue?",
    "We evaluate pricing, positioning, conversion, availability strategy, guest experience, and operating constraints before recommending prioritized actions.",
  ],
  [
    "What is a Hospitality Performance System?",
    "It is a connected operating model that helps teams observe performance, understand drivers, decide what matters, execute work, and learn from measured outcomes.",
  ],
  [
    "Is there an owner portal?",
    "Yes. Authorized owners can access the workspace and property information made available to them according to their relationship and permissions.",
  ],
  [
    "How often will I receive reporting?",
    "Reporting frequency depends on the selected service. Reports remain period-bound records and are distinct from continuously updated dashboards.",
  ],
  [
    "Can you help if my property is already listed?",
    "Yes. Existing properties can benefit from a focused audit, listing optimization, guidebook work, furnishing improvements, or ongoing operational support.",
  ],
  [
    "How do we get started?",
    "Choose Get Started or contact us. We will identify your intended outcome, current property stage, and the best next step.",
  ],
] as const;

export default function FAQPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-14">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            FAQ
          </p>
          <h1 className="mt-5 font-serif text-6xl">Find answers quickly.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600">
            Choose a topic below to find answers about working with Luxe Haven.
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "For Owners",
                "Manage, optimize, and grow your property.",
                House,
              ],
              ["For Guests", "Before, during, and after your stay.", Users],
              [
                "For Partners",
                "Referrals, integrations, and partnerships.",
                Building2,
              ],
              [
                "For Investors",
                "Investment, due diligence, and performance.",
                Landmark,
              ],
            ].map(([title, text, Icon]) => {
              const Mark = Icon as typeof House;
              return (
                <div
                  key={String(title)}
                  className="rounded-xl border bg-white p-5"
                >
                  <Mark className="size-6 text-emerald-800" />
                  <h2 className="mt-5 font-semibold">{String(title)}</h2>
                  <p className="mt-2 text-xs leading-5 text-stone-600">
                    {String(text)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <ResourcesNavigation active="FAQs" />
      <section className="py-14">
        <div className="container-shell grid gap-8 lg:grid-cols-[.3fr_1fr]">
          <aside>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
              For owners
            </p>
            <nav className="mt-5 grid gap-3 text-sm text-stone-600">
              <span>All</span>
              <span>Property Management</span>
              <span>Revenue &amp; Pricing</span>
              <span>Guidebooks</span>
              <span>Platform &amp; Reporting</span>
              <span>Consulting</span>
              <span>General</span>
            </nav>
          </aside>
          <div className="divide-y rounded-xl border bg-white">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold">
                  {question}
                  <span className="float-right group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600">
                  {answer}
                </p>
              </details>
            ))}
          </div>
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
