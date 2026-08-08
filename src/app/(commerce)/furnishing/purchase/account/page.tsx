import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { FurnishingCreateAccountForm } from "@/features/commerce-onboarding/furnishing-create-account-form";
import {
  furnishingPackagesBySlug,
  type FurnishingPackageSlug,
} from "@/lib/furnishing-packages";
import {
  purchaseQuery,
  type FurnishingPurchaseParams,
} from "@/lib/furnishing-purchase-params";
import { purchaseSteps, purchaseStepLabels } from "../steps";

export const metadata: Metadata = {
  title: "Create Account or Sign In",
  description: "Welcome! How would you like to continue?",
};

export default async function FurnishingAccountPage({
  searchParams,
}: {
  searchParams: Promise<FurnishingPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? furnishingPackagesBySlug[params.package as FurnishingPackageSlug]
    : undefined;
  if (!pkg) redirect("/furnishing/packages");

  const query = purchaseQuery(params);
  const next = `/furnishing/purchase/property${query ? `?${query}` : ""}`;
  const signInHref = `/login?next=${encodeURIComponent(next)}`;

  return (
    <main>
      <CommerceProgressHeader
        current="account"
        steps={purchaseSteps}
        labels={purchaseStepLabels}
      />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">
            Welcome! How would you like to continue?
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Create an account or sign in to continue with your {pkg.name}{" "}
            furnishing project.
          </p>
          <div className="mt-7">
            <FurnishingCreateAccountForm next={next} signInHref={signInHref} />
          </div>
        </div>
      </div>
    </main>
  );
}
