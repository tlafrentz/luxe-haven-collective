import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { InvestmentCreateAccountForm } from "@/features/commerce-onboarding/investment-create-account-form";
import {
  investmentPackagesBySlug,
  type InvestmentPackageSlug,
} from "@/lib/investment-packages";
import {
  purchaseQuery,
  type InvestmentPurchaseParams,
} from "@/lib/investment-purchase-params";
import { purchaseSteps, purchaseStepLabels } from "../steps";

export const metadata: Metadata = {
  title: "Create Account or Sign In",
  description: "Welcome! How would you like to continue?",
};

export default async function InvestmentAccountPage({
  searchParams,
}: {
  searchParams: Promise<InvestmentPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? investmentPackagesBySlug[params.package as InvestmentPackageSlug]
    : undefined;
  if (!pkg) redirect("/investment-intelligence/packages");

  const query = purchaseQuery(params);
  const next = `/investment-intelligence/purchase/review${query ? `?${query}` : ""}`;
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
            analysis.
          </p>
          <div className="mt-7">
            <InvestmentCreateAccountForm next={next} signInHref={signInHref} />
          </div>
        </div>
      </div>
    </main>
  );
}
