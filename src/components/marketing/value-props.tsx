import Link from "next/link";
import { BarChart3, Clock3, PieChart, Star, UsersRound } from "lucide-react";

const outcomes = [
  {
    title: "Increase Revenue",
    copy: "Data-driven strategies that boost RevPAR and profits.",
    href: "/solutions/revenue",
    icon: BarChart3,
  },
  {
    title: "Delight Guests",
    copy: "Exceptional experiences that drive five-star reviews.",
    href: "/solutions/guest-experience",
    icon: Star,
  },
  {
    title: "Save Time",
    copy: "Automate operations and focus on what matters.",
    href: "/solutions/operations",
    icon: Clock3,
  },
  {
    title: "Make Better Decisions",
    copy: "Real-time insights to act with confidence.",
    href: "/solutions/investment",
    icon: PieChart,
  },
  {
    title: "Built by Operators",
    copy: "Tools and playbooks from real hospitality experts.",
    href: "/about",
    icon: UsersRound,
  },
] as const;

export function ValueProps() {
  return (
    <section
      aria-label="Luxe Haven outcomes"
      className="border-b border-[#dce2dd] bg-white"
    >
      <div className="mx-auto grid max-w-[1440px] sm:grid-cols-2 lg:grid-cols-5">
        {outcomes.map(({ title, copy, href, icon: Icon }, index) => (
          <article
            key={title}
            className={`px-7 py-10 text-center ${index ? "border-t border-[#e2e5e2] sm:border-l lg:border-t-0" : ""}`}
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#c9bfa9] text-[#074e38]">
              <Icon aria-hidden size={25} />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-[#171c19]">
              {title}
            </h2>
            <p className="mx-auto mt-2 max-w-[230px] text-sm leading-6 text-[#59635d]">
              {copy}
            </p>
            <Link
              href={href}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#07543d]"
            >
              Learn more <span aria-hidden>→</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
