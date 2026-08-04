import type { Metadata } from "next";
import { GetStartedGuide } from "@/components/marketing/get-started-guide";

export const metadata: Metadata = {
  title: "Get Started | Luxe Haven Collective",
  description:
    "Choose your hospitality goal and receive a clear recommended Luxe Haven solution path.",
};
export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string }>;
}) {
  const { goal } = await searchParams;
  return (
    <main>
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <p className="text-sm font-bold uppercase tracking-[.24em] text-[#9a6d0b]">
            Get started
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl md:text-7xl">
            Choose your path. We’ll guide you from start to success.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5f6963]">
            No account is required to explore. Your selected goal stays in the
            URL so you can return or share the path.
          </p>
        </div>
      </section>
      <section className="bg-[#f9faf8] py-16">
        <div className="container-shell">
          <GetStartedGuide initialGoal={goal} />
        </div>
      </section>
    </main>
  );
}
