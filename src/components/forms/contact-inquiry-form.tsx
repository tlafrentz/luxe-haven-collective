"use client";

import { useActionState } from "react";
import { submitContactInquiry, type FormState } from "@/app/actions/forms";
import { SubmitButton } from "@/components/forms/submit-button";

const initialState: FormState = { ok: false, message: "" };
const fieldClass = "rounded-2xl border border-border bg-background px-4 py-3 outline-none transition focus:border-accent";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-red-700">{errors[0]}</p>;
}

export function ContactInquiryForm() {
  const [state, action] = useActionState(submitContactInquiry, initialState);

  return (
    <form action={action} className="rounded-[2rem] border border-border bg-card p-6 md:p-8">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Name
          <input name="name" className={fieldClass} placeholder="Your name" autoComplete="name" />
          <FieldError errors={state.fieldErrors?.name} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input name="email" type="email" className={fieldClass} placeholder="you@example.com" autoComplete="email" />
          <FieldError errors={state.fieldErrors?.email} />
        </label>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Phone <span className="font-normal text-muted-foreground">optional</span>
          <input name="phone" className={fieldClass} placeholder="(555) 000-0000" autoComplete="tel" />
          <FieldError errors={state.fieldErrors?.phone} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Property Market <span className="font-normal text-muted-foreground">optional</span>
          <input name="propertyMarket" className={fieldClass} placeholder="Mesa, Phoenix, Scottsdale..." />
          <FieldError errors={state.fieldErrors?.propertyMarket} />
        </label>
      </div>
      <label className="mt-5 grid gap-2 text-sm font-medium">
        Inquiry Type
        <select name="inquiryType" className={fieldClass} defaultValue="Owner partnership">
          <option>Owner partnership</option>
          <option>Guest inquiry</option>
          <option>Listing optimization</option>
          <option>General question</option>
        </select>
        <FieldError errors={state.fieldErrors?.inquiryType} />
      </label>
      <label className="mt-5 grid gap-2 text-sm font-medium">
        Message
        <textarea name="message" className="min-h-36 rounded-2xl border border-border bg-background px-4 py-3 outline-none transition focus:border-accent" placeholder="Tell us about your property, goals, dates, or questions." />
        <FieldError errors={state.fieldErrors?.message} />
      </label>
      <SubmitButton>Submit Inquiry</SubmitButton>
      {state.message ? <p className={state.ok ? "mt-4 text-sm font-medium text-green-700" : "mt-4 text-sm font-medium text-red-700"}>{state.message}</p> : null}
      <p className="mt-4 text-xs text-muted-foreground">Your information is used only to respond to your inquiry and improve Luxe Haven follow-up.</p>
    </form>
  );
}
