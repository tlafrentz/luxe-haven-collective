import { createFurnishingPackageAction } from "@/app/actions/furnishing-studio";
import { FurnishingHeader } from "@/components/furnishing/furnishing-navigation";
export default function Page() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="New furnishing package"
        description="Create reusable furnishing intellectual property with a versioned starting variant."
        current="packages"
      />
      <form
        action={createFurnishingPackageAction}
        className="grid gap-5 rounded-2xl border bg-white p-6"
      >
        <label className="font-semibold">
          Package name
          <input
            name="name"
            required
            className="mt-2 block w-full rounded-xl border px-3 py-2"
          />
        </label>
        <label className="font-semibold">
          Description
          <textarea
            name="description"
            className="mt-2 block w-full rounded-xl border px-3 py-2"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            Property type
            <select
              name="propertyType"
              className="mt-2 block w-full rounded-xl border px-3 py-2"
            >
              {[
                "apartment",
                "house",
                "condo",
                "cabin",
                "townhome",
                "hotel room",
                "custom",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Style
            <select
              name="style"
              className="mt-2 block w-full rounded-xl border px-3 py-2"
            >
              {[
                "modern",
                "coastal",
                "mountain",
                "minimal",
                "luxury",
                "family",
                "boutique",
                "urban",
                "custom",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Variant
            <input
              name="variant"
              placeholder="2 Bedroom"
              className="mt-2 block w-full rounded-xl border px-3 py-2"
            />
          </label>
          <label>
            Budget tier
            <select
              name="budgetTier"
              className="mt-2 block w-full rounded-xl border px-3 py-2"
            >
              {["essential", "standard", "premium", "luxury"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Starting budget
            <input
              name="budget"
              type="number"
              min="0"
              className="mt-2 block w-full rounded-xl border px-3 py-2"
            />
          </label>
        </div>
        <button className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">
          Create package
        </button>
      </form>
    </main>
  );
}
