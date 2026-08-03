import Link from "next/link";
import {
  createFurnishingProjectAction,
  getFurnishingStudio,
} from "@/app/actions/furnishing-studio";
import { FurnishingHeader } from "@/components/furnishing/furnishing-navigation";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = await getFurnishingStudio();
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="New furnishing project"
        description="Create a property-specific implementation while preserving the selected package snapshot."
        current="projects"
      />
      <p className="text-sm">
        <Link
          href="/admin/furnishing/projects"
          className="font-semibold text-emerald-800"
        >
          Projects
        </Link>{" "}
        › New project
      </p>
      <form action={createFurnishingProjectAction} className="space-y-6">
        <Step n="1" title="Property">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Property">
              <select name="propertyId" required className="input">
                <option value="">Select property</option>
                {data.properties.map((x: Record<string, unknown>) => (
                  <option key={String(x.id)} value={String(x.id)}>
                    {String(x.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project name">
              <input name="name" required className="input" />
            </Field>
            <Field label="Owner">
              <input name="owner" className="input" />
            </Field>
            <Field label="Designer or project lead">
              <input name="lead" className="input" />
            </Field>
            <Field label="Target installation date">
              <input name="targetDate" type="date" className="input" />
            </Field>
          </div>
        </Step>
        <Step n="2" title="Package">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Package">
              <select name="packageId" className="input">
                <option value="">Blank custom project</option>
                {data.packages.map((x: Record<string, unknown>) => (
                  <option key={String(x.id)} value={String(x.id)}>
                    {String(x.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Variant">
              <select name="variantId" className="input">
                <option value="">Select matching variant</option>
                {data.variants.map((x: Record<string, unknown>) => (
                  <option key={String(x.id)} value={String(x.id)}>
                    {String(x.name)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            The selected package, variant, rooms, items, and products are
            captured as an immutable project snapshot.
          </p>
        </Step>
        <Step n="3" title="Scope">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              "Living room",
              "Dining room",
              "Kitchen",
              "Primary bedroom",
              "Guest bedrooms",
              "Bathrooms",
              "Outdoor",
              "Technology",
              "Decor",
              "Supplies",
            ].map((x) => (
              <label
                key={x}
                className="flex items-center gap-2 rounded-xl border p-3 text-sm"
              >
                <input type="checkbox" name="scope" value={x} />
                {x}
              </label>
            ))}
          </div>
        </Step>
        <Step n="4" title="Budget">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Target budget", "targetBudget"],
              ["Contingency", "contingency"],
              ["Labor allowance", "labor"],
              ["Delivery allowance", "delivery"],
              ["Installation allowance", "installation"],
              ["Tax assumptions", "tax"],
            ].map(([label, name]) => (
              <Field key={name} label={label}>
                <input
                  name={name}
                  type="number"
                  min="0"
                  step=".01"
                  className="input"
                />
              </Field>
            ))}
          </div>
        </Step>
        <Step n="5" title="Review">
          <p className="text-sm text-stone-600">
            Creating this project establishes a property checklist, budget,
            procurement tracker, installation record, timeline, and package
            snapshot.
          </p>
          <button className="mt-5 rounded-xl bg-emerald-800 px-6 py-3 font-semibold text-white">
            Create Furnishing Project
          </button>
        </Step>
      </form>
    </main>
  );
}
function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-800 text-sm font-bold text-white">
          {n}
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}
