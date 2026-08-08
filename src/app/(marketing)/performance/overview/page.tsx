import type { Metadata } from "next";
import Link from "next/link";
import { PlatformFlywheel } from "@/components/marketing/platform-flywheel";
import { lifecycleStages, type LifecycleStage } from "@/lib/plans";

export const metadata: Metadata = {
  title: "HPM Platform",
  description:
    "See how the Hospitality Performance Platform connects Observe, Understand, Decide, Execute, and Learn into one system.",
};

const stageSlugs = new Set(lifecycleStages.map((stage) => stage.slug));

export default async function PlatformOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const initialStage: LifecycleStage =
    stage && stageSlugs.has(stage as LifecycleStage)
      ? (stage as LifecycleStage)
      : "observe";

  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/performance">HPM Platform</Link>
            <span className="mx-2">›</span>
            <span>Overview</span>
          </nav>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            How the platform works
          </p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl md:text-6xl">
            One connected system for every performance decision.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            The Hospitality Performance Platform runs on a five-stage
            lifecycle: Observe, Understand, Decide, Execute, and Learn.
            Explore each stage below.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell">
          <PlatformFlywheel initialStage={initialStage} />
        </div>
      </section>

      <section className="border-t border-[#dce2dd] bg-[#f9faf8] py-16">
        <div className="container-shell flex flex-wrap items-center justify-between gap-5 rounded-xl bg-emerald-950 p-8 text-white">
          <div>
            <h2 className="font-serif text-3xl">
              Ready to see which plan fits?
            </h2>
            <p className="mt-1 text-sm text-white/70">
              Every plan includes the full lifecycle, with more depth at
              higher tiers.
            </p>
          </div>
          <Link
            href="/performance/plans"
            className="rounded-md border border-white/50 px-5 py-3 text-sm font-semibold"
          >
            Compare Plans →
          </Link>
        </div>
      </section>
    </main>
  );
}
