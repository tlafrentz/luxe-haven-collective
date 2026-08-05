import { Suspense } from "react";
import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import { ContactInquiryForm } from "@/components/forms/contact-inquiry-form";

const reasons = [
  "Improve my property",
  "Guidebook",
  "Furnishing",
  "Investment",
  "Consulting",
  "Guest question",
  "Texas Notary",
  "Partnership",
];

export default function ContactPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-14">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            Contact
          </p>
          <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-tight md:text-6xl">
            Let’s talk about your property,
            <br />
            stay, or partnership.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-600">
            Tell us what you’re building and we’ll help identify the right next
            step for Luxe Haven support.
          </p>
        </div>
      </section>
      <section className="pb-12">
        <div className="container-shell grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <h2 className="font-serif text-3xl">What brings you here today?</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Choose a service in the form and add context so we can respond
              with the right information.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {reasons.map((reason) => (
                <div
                  key={reason}
                  className="rounded-xl border bg-white p-4 text-sm font-medium"
                >
                  {reason}
                </div>
              ))}
            </div>
          </div>
          <Suspense
            fallback={
              <div className="min-h-[620px] animate-pulse rounded-2xl bg-stone-100" />
            }
          >
            <ContactInquiryForm />
          </Suspense>
        </div>
      </section>
      <section className="pb-12">
        <div className="container-shell grid gap-4 rounded-xl bg-[#faf3e8] p-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Typical response time", "Within one business day", Clock3],
            ["Email", "hello@luxehavencollective.com", Mail],
            ["Call", "(480) 516-0198", Phone],
            ["Office", "Mesa, Arizona", MapPin],
          ].map(([label, value, Icon]) => {
            const Mark = Icon as typeof Clock3;
            return (
              <div key={String(label)} className="flex gap-3">
                <Mark className="size-5" />
                <div>
                  <p className="text-xs font-semibold">{String(label)}</p>
                  <p className="mt-1 text-xs text-stone-600">{String(value)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
