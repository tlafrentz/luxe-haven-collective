"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  updateOrganizationAction,
  type OrganizationActionResult,
} from "@/app/actions/workspace-organization";
import type { OrganizationInput, OrganizationProfile } from "@/features/workspace";

const timezones = [
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Honolulu",
] as const;

type OrganizationFormValues = OrganizationInput & {
  address: NonNullable<OrganizationInput["address"]>;
};

function initialValues(profile: OrganizationProfile): OrganizationFormValues {
  return {
    displayName: profile.displayName,
    legalName: profile.legalName ?? "",
    description: profile.description ?? "",
    website: profile.website ?? "",
    logoUrl: profile.logoUrl ?? "",
    businessEmail: profile.businessEmail ?? "",
    businessPhone: profile.businessPhone ?? "",
    preferredContactMethod:
      profile.preferredContactMethod === "email" ||
      profile.preferredContactMethod === "phone" ||
      profile.preferredContactMethod === "either"
        ? profile.preferredContactMethod
        : "email",
    address: {
      line1: profile.address?.line1 ?? "",
      line2: profile.address?.line2 ?? "",
      city: profile.address?.city ?? "",
      region: profile.address?.region ?? "",
      postalCode: profile.address?.postalCode ?? "",
      country: profile.address?.country ?? profile.country,
    },
    timezone: profile.timezone,
    currency: profile.currency,
    language: profile.language,
    country: profile.country,
  };
}

export function OrganizationForm({
  profile,
  readOnly = false,
}: Readonly<{ profile: OrganizationProfile; readOnly?: boolean }>) {
  const router = useRouter();
  const [values, setValues] = useState<OrganizationFormValues>(() => initialValues(profile));
  const [baseline, setBaseline] = useState<OrganizationFormValues>(() => initialValues(profile));
  const [revision, setRevision] = useState(profile.revision);
  const [result, setResult] = useState<OrganizationActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const fieldError = (name: string) =>
    result && !result.ok ? result.fieldErrors?.[name] : undefined;
  const update = (name: keyof OrganizationFormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setResult(null);
  };
  const updateAddress = (name: string, value: string) => {
    setValues((current) => ({
      ...current,
      address: { ...current.address, [name]: value },
    }));
    setResult(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || pending || readOnly) return;
    startTransition(async () => {
      const response = await updateOrganizationAction({
        workspaceId: profile.workspaceId,
        expectedRevision: revision,
        idempotencyKey: crypto.randomUUID(),
        values,
      });
      setResult(response);
      if (response.ok) {
        setBaseline(values);
        setRevision(response.revision);
        router.refresh();
      } else if (response.fieldErrors) {
        window.requestAnimationFrame(() => {
          formRef.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus();
        });
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-10" noValidate>
      <FormSection title="Business Identity" question="What should Luxe Haven call this business?">
        <Field label="Display name" name="displayName" required error={fieldError("displayName")}>
          <input id="displayName" value={values.displayName} onChange={(event) => update("displayName", event.target.value)} readOnly={readOnly} maxLength={120} aria-invalid={Boolean(fieldError("displayName"))} aria-describedby={fieldError("displayName") ? "displayName-error" : undefined} className="organization-input" />
        </Field>
        <Field label="Legal or company name" name="legalName" error={fieldError("legalName")}>
          <input id="legalName" value={values.legalName ?? ""} onChange={(event) => update("legalName", event.target.value)} readOnly={readOnly} maxLength={160} className="organization-input" />
        </Field>
        <Field label="Business description" name="description" error={fieldError("description")} wide>
          <textarea id="description" value={values.description ?? ""} onChange={(event) => update("description", event.target.value)} readOnly={readOnly} maxLength={2000} rows={4} className="organization-input" />
        </Field>
        <Field label="Website" name="website" error={fieldError("website")} wide>
          <input id="website" type="url" inputMode="url" value={values.website ?? ""} onChange={(event) => update("website", event.target.value)} readOnly={readOnly} aria-invalid={Boolean(fieldError("website"))} aria-describedby={fieldError("website") ? "website-error" : undefined} placeholder="https://example.com" className="organization-input" />
        </Field>
      </FormSection>

      <FormSection title="Brand" question="How should this business appear in customer-facing outputs?">
        <Field label="Public-facing business name" name="brandName">
          <input id="brandName" value={values.displayName} onChange={(event) => update("displayName", event.target.value)} readOnly={readOnly} className="organization-input" />
        </Field>
        <Field label="Logo URL or storage reference" name="logoUrl" error={fieldError("logoUrl")}>
          <input id="logoUrl" type="url" value={values.logoUrl ?? ""} onChange={(event) => update("logoUrl", event.target.value)} readOnly={readOnly} aria-invalid={Boolean(fieldError("logoUrl"))} aria-describedby={fieldError("logoUrl") ? "logoUrl-error" : "logoUrl-help"} className="organization-input" />
          <span id="logoUrl-help" className="mt-1 block text-xs text-stone-500">Use an existing HTTPS image or storage URL. Logo media management is not created here.</span>
        </Field>
      </FormSection>

      <FormSection title="Contact" question="How should the business be contacted?">
        <Field label="Business email" name="businessEmail" error={fieldError("businessEmail")}>
          <input id="businessEmail" type="email" value={values.businessEmail ?? ""} onChange={(event) => update("businessEmail", event.target.value)} readOnly={readOnly} aria-invalid={Boolean(fieldError("businessEmail"))} aria-describedby={fieldError("businessEmail") ? "businessEmail-error" : "businessEmail-help"} className="organization-input" />
          <span id="businessEmail-help" className="mt-1 block text-xs text-stone-500">This does not change your sign-in email.</span>
        </Field>
        <Field label="Business phone" name="businessPhone">
          <input id="businessPhone" type="tel" value={values.businessPhone ?? ""} onChange={(event) => update("businessPhone", event.target.value)} readOnly={readOnly} className="organization-input" />
        </Field>
        <Field label="Preferred contact method" name="preferredContactMethod">
          <select id="preferredContactMethod" value={values.preferredContactMethod ?? "email"} onChange={(event) => update("preferredContactMethod", event.target.value)} disabled={readOnly} className="organization-input">
            <option value="email">Email</option><option value="phone">Phone</option><option value="either">Either</option>
          </select>
        </Field>
        <div className="sm:col-span-2 grid gap-5 rounded-2xl bg-stone-50 p-5 sm:grid-cols-2">
          {(["line1", "line2", "city", "region", "postalCode"] as const).map((name) => (
            <Field key={name} label={{ line1: "Address line 1", line2: "Address line 2", city: "City", region: "State or region", postalCode: "Postal code" }[name]} name={`address.${name}`}>
              <input id={`address.${name}`} value={values.address?.[name] ?? ""} onChange={(event) => updateAddress(name, event.target.value)} readOnly={readOnly} className="organization-input" />
            </Field>
          ))}
        </div>
      </FormSection>

      <FormSection title="Regional Defaults" question="Which regional settings should Luxe Haven use by default?">
        <Field label="Country" name="country" required error={fieldError("country")}>
          <select id="country" value={values.country} onChange={(event) => update("country", event.target.value)} disabled={readOnly} className="organization-input"><option value="US">United States (US)</option></select>
        </Field>
        <Field label="Timezone" name="timezone" required error={fieldError("timezone")}>
          <select id="timezone" value={values.timezone} onChange={(event) => update("timezone", event.target.value)} disabled={readOnly} aria-invalid={Boolean(fieldError("timezone"))} aria-describedby={fieldError("timezone") ? "timezone-error" : undefined} className="organization-input">
            {!timezones.includes(values.timezone as typeof timezones[number]) ? <option value={values.timezone}>{values.timezone} — review required</option> : null}
            {timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
          </select>
        </Field>
        <Field label="Currency" name="currency" required error={fieldError("currency")}>
          <select id="currency" value={values.currency} onChange={(event) => update("currency", event.target.value)} disabled={readOnly} className="organization-input"><option value="USD">USD — US Dollar</option></select>
        </Field>
        <Field label="Language" name="language" required error={fieldError("language")}>
          <select id="language" value={values.language} onChange={(event) => update("language", event.target.value)} disabled={readOnly} className="organization-input"><option value="en-US">English (United States)</option></select>
        </Field>
        <p className="sm:col-span-2 text-xs leading-5 text-stone-500">These organization defaults are fallbacks. Explicit property overrides and individual user preferences remain distinct.</p>
      </FormSection>

      <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" role="status" className="text-sm">
          {result ? <span className={result.ok ? "text-emerald-700" : "text-red-700"}>{result.message}</span> : dirty ? <span className="text-amber-700">You have unsaved changes.</span> : <span className="text-stone-500">All changes are saved.</span>}
        </div>
        {!readOnly ? <button type="submit" disabled={!dirty || pending} className="min-h-11 rounded-full bg-stone-950 px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{pending ? "Saving…" : "Save organization"}</button> : <span className="text-sm font-semibold text-stone-600">Read only</span>}
      </div>
    </form>
  );
}

function FormSection({ title, question, children }: Readonly<{ title: string; question: string; children: React.ReactNode }>) {
  return <section aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-title`} className="border-t border-stone-200 pt-8 first:border-0 first:pt-0"><h2 id={`${title.toLowerCase().replaceAll(" ", "-")}-title`} className="text-xl font-semibold text-stone-950">{title}</h2><p className="mt-1 text-sm text-stone-600">{question}</p><div className="mt-6 grid gap-5 sm:grid-cols-2">{children}</div></section>;
}

function Field({ label, name, required = false, error, wide = false, children }: Readonly<{ label: string; name: string; required?: boolean; error?: string; wide?: boolean; children: React.ReactNode }>) {
  return <div className={wide ? "sm:col-span-2" : ""}><label htmlFor={name} className="block text-sm font-semibold text-stone-800">{label}{required ? <span className="ml-1 text-red-700">Required</span> : null}</label><div className="mt-2">{children}</div>{error ? <p id={`${name}-error`} className="mt-1 text-sm text-red-700">{error}</p> : null}</div>;
}
