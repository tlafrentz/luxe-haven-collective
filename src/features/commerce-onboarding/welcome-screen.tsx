import Link from "next/link";
import { Check } from "lucide-react";

const checklist = ["Connect PMS or import properties", "Invite your team members", "Explore powerful insights in Observe"];

export function WelcomeScreen({ name }: { name?: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[#dce2dd] bg-white p-8 text-center md:p-12">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">Welcome</p>
      <h1 className="mt-3 font-serif text-4xl">
        Congratulations{name ? `, ${name}` : ""}!
      </h1>
      <p className="mt-4 text-sm leading-7 text-stone-600">
        You&apos;re now ready to build your Hospitality Performance workspace.
      </p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Setup typically takes 8–10 minutes.
      </p>
      <ul className="mt-7 space-y-3 text-left">
        {checklist.map((item) => (
          <li key={item} className="flex items-center gap-3 text-sm text-stone-700">
            <Check className="size-4 shrink-0 text-emerald-700" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/commerce/activate"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-900 px-6 text-sm font-semibold text-white"
        >
          Let&apos;s Begin →
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#789487] px-6 text-sm font-semibold text-[#26342e]"
        >
          Skip for Now
        </Link>
      </div>
    </div>
  );
}
