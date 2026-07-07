"use client";

import { useActionState } from "react";
import { submitLeadMagnet, type FormState } from "@/app/actions/forms";
import { SubmitButton } from "@/components/forms/submit-button";

const initialState: FormState = { ok: false, message: "" };
const fieldClass = "rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-primary-foreground outline-none placeholder:text-primary-foreground/45 transition focus:border-primary-foreground";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-red-200">{errors[0]}</p>;
}

export function LeadMagnetForm() {
  const [state, action] = useActionState(submitLeadMagnet, initialState);

  return (
    <form action={action} className="rounded-[2rem] border border-border bg-[#171412] p-8 text-primary-foreground">
      <h2 className="font-serif text-4xl">Get the checklist</h2>
      <p className="mt-4 leading-7 text-primary-foreground/70">Enter your details and use the checklist to audit your STR like a hospitality operator.</p>
      <label className="mt-6 grid gap-2 text-sm font-medium">
        Name
        <input name="name" className={fieldClass} placeholder="Your name" autoComplete="name" />
        <FieldError errors={state.fieldErrors?.name} />
      </label>
      <label className="mt-5 grid gap-2 text-sm font-medium">
        Email
        <input name="email" type="email" className={fieldClass} placeholder="you@example.com" autoComplete="email" />
        <FieldError errors={state.fieldErrors?.email} />
      </label>
      <label className="mt-5 grid gap-2 text-sm font-medium">
        Property Market
        <input name="propertyMarket" className={fieldClass} placeholder="Mesa, Phoenix, Scottsdale..." />
        <FieldError errors={state.fieldErrors?.propertyMarket} />
      </label>
      <label className="mt-5 grid gap-2 text-sm font-medium">
        Property Status
        <select name="propertyStatus" className={fieldClass} defaultValue="Self-managing">
          <option>Planning a new STR</option>
          <option>Self-managing</option>
          <option>Managed by another company</option>
          <option>Exploring a purchase</option>
        </select>
        <FieldError errors={state.fieldErrors?.propertyStatus} />
      </label>
      <SubmitButton dark>Download Checklist</SubmitButton>
      {state.message ? <p className={state.ok ? "mt-4 text-sm font-medium text-green-200" : "mt-4 text-sm font-medium text-red-200"}>{state.message}</p> : null}
      <p className="mt-4 text-xs text-primary-foreground/50">You’ll receive the checklist by email, and Luxe Haven may follow up with relevant STR insights.</p>
    </form>
  );
}
