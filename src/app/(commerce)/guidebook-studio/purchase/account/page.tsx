import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { GuidebookCreateAccountForm } from "@/features/commerce-onboarding/guidebook-create-account-form";
import { guidebookPackagesBySlug, type GuidebookPackageSlug } from "@/lib/guidebook-packages";
import { purchaseQuery, type GuidebookPurchaseParams } from "@/lib/guidebook-purchase-params";
import { purchaseSteps, purchaseStepLabels } from "../steps";

export const metadata: Metadata = {
  title: "Create Account or Sign In",
  description: "Welcome! How would you like to continue?",
};

export default async function GuidebookAccountPage({
  searchParams,
}: {
  searchParams: Promise<GuidebookPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? guidebookPackagesBySlug[params.package as GuidebookPackageSlug]
    : undefined;
  if (!pkg) redirect("/guidebook-studio/packages");

  const query = purchaseQuery(params);
  const next = `/guidebook-studio/purchase/property${query ? `?${query}` : ""}`;
  const signInHref = `/login?next=${encodeURIComponent(next)}`;

  return (
    <main>
      <CommerceProgressHeader current="account" steps={purchaseSteps} labels={purchaseStepLabels} />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">Welcome! How would you like to continue?</h1>
          <p className="mt-2 text-sm text-stone-600">
            Create an account or sign in to continue with your {pkg.name} guidebook.
          </p>
          <div className="mt-7">
            <GuidebookCreateAccountForm next={next} signInHref={signInHref} />
          </div>
        </div>
      </div>
    </main>
  );
}
