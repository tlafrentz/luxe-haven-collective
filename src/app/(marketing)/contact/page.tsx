import { Suspense } from "react";

import { ContactInquiryForm } from "@/components/forms/contact-inquiry-form";
import { PageHero } from "@/components/marketing/page-hero";

function ContactFormFallback() {
  return (
    <div className="min-h-[620px] animate-pulse rounded-[2rem] border border-border bg-card p-6 md:p-8">
      <div className="h-3 w-32 rounded bg-muted" />
      <div className="mt-4 h-9 w-64 rounded bg-muted" />
      <div className="mt-4 h-4 w-full max-w-md rounded bg-muted" />

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="h-20 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
      </div>

      <div className="mt-5 h-44 rounded-2xl bg-muted" />
      <div className="mt-5 h-12 w-44 rounded-full bg-muted" />
    </div>
  );
}

export default function ContactPage() {
  return (
    <main>
      <PageHero
        eyebrow="Contact"
        title="Let’s talk about your property, stay, or partnership."
        description="Tell us what you’re building and we’ll help identify the right next step for Luxe Haven support."
      />

      <section className="py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h2 className="font-serif text-4xl">
              Start the conversation.
            </h2>

            <p className="mt-5 leading-8 text-muted-foreground">
              Use this form for owner consultations, property management
              inquiries, guest questions, Texas notary requests, or partnership
              opportunities.
            </p>

            <div className="mt-8 rounded-3xl border border-border bg-card p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                Response focus
              </p>

              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Share your property location, current listing status, service
                needs, preferred appointment details, goals, or biggest
                operating challenge so we can respond with context.
              </p>
            </div>
          </div>

          <Suspense fallback={<ContactFormFallback />}>
            <ContactInquiryForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
