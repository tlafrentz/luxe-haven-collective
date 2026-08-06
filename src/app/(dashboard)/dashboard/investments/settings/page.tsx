import { Bell, Database, History, LockKeyhole } from "lucide-react";

const settings = [
  { icon: Database, title: "Evidence providers", copy: "Review the connected market-data providers used to build investment evidence." },
  { icon: Bell, title: "Analysis notifications", copy: "Manage alerts for completed analyses, low-confidence evidence, and reanalysis reminders." },
  { icon: History, title: "Version history", copy: "Investment analyses remain immutable. New assumptions create a new auditable version." },
  { icon: LockKeyhole, title: "Workspace access", copy: "Analyses, opportunities, reports, and shares remain owner and workspace scoped." },
] as const;

export default function InvestmentSettingsPage() {
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Investment Intelligence</p>
    <h1 className="mt-2 font-serif text-4xl text-stone-950">Settings</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">Control evidence, notifications, versioning, and access without changing any preserved investment decision.</p>
    <section className="mt-8 grid gap-4 md:grid-cols-2">
      {settings.map(({ icon: Icon, title, copy }) => <article key={title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <Icon aria-hidden="true" className="h-5 w-5 text-emerald-800" />
        <h2 className="mt-4 text-lg font-semibold text-stone-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{copy}</p>
        <button type="button" className="mt-5 min-h-10 rounded-xl border border-stone-300 px-4 text-sm font-semibold text-stone-800">Manage</button>
      </article>)}
    </section>
  </main>;
}
