import { ContactInquiryForm } from "@/components/forms/contact-inquiry-form";
import { PageHero } from "@/components/marketing/page-hero";

export default function ContactPage() {
  return (
    <main>
      <PageHero eyebrow="Contact" title="Let’s talk about your property, stay, or partnership." description="Tell us what you’re building and we’ll help identify the right next step for Luxe Haven support." />
      <section className="py-20"><div className="container-shell grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><h2 className="font-serif text-4xl">Start the conversation.</h2><p className="mt-5 leading-8 text-muted-foreground">Use this form for owner consultations, property management inquiries, guest questions, or partnership opportunities.</p><div className="mt-8 rounded-3xl border border-border bg-card p-6"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Response focus</p><p className="mt-3 text-sm leading-7 text-muted-foreground">Share your property location, current listing status, goals, and biggest operating challenge so we can respond with context.</p></div></div><ContactInquiryForm /></div></section>
    </main>
  );
}
