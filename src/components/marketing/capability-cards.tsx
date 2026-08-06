import Link from "next/link";
import {
  Eye,
  Lightbulb,
  Scale,
  Zap,
  GraduationCap,
} from "lucide-react";
import { lifecycleStages } from "@/lib/plans";

const icons = {
  observe: Eye,
  understand: Lightbulb,
  decide: Scale,
  execute: Zap,
  learn: GraduationCap,
} as const;

export function CapabilityCards() {
  return (
    <section
      aria-label="Platform lifecycle"
      className="border-b border-[#dce2dd] bg-white"
    >
      <div className="mx-auto grid max-w-[1440px] sm:grid-cols-2 lg:grid-cols-5">
        {lifecycleStages.map((stage, index) => {
          const Icon = icons[stage.slug];
          return (
            <article
              key={stage.slug}
              className={`px-7 py-10 text-center ${index ? "border-t border-[#e2e5e2] sm:border-l lg:border-t-0" : ""}`}
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#c9bfa9] text-[#074e38]">
                <Icon aria-hidden size={25} />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-[#171c19]">
                {stage.label}
              </h2>
              <p className="mx-auto mt-2 max-w-[230px] text-sm leading-6 text-[#59635d]">
                {stage.description}
              </p>
              <Link
                href={`/performance/overview?stage=${stage.slug}`}
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#07543d]"
              >
                Learn more <span aria-hidden>→</span>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
