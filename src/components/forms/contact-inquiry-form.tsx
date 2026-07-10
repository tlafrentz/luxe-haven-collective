"use client";

import { useActionState, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  submitContactInquiry,
  type FormState,
} from "@/app/actions/forms";
import { SubmitButton } from "@/components/forms/submit-button";

const initialState: FormState = {
  ok: false,
  message: "",
};

const fieldClass =
  "rounded-2xl border border-border bg-background px-4 py-3 outline-none transition focus:border-accent";

const inquiryOptions = [
  "STR consulting",
  "Co-hosting or property management",
  "Owner partnership",
  "Stay or guest inquiry",
  "Listing optimization",
  "Texas notary service",
  "Partnership opportunity",
  "General question",
] as const;

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-xs font-medium text-red-700">{errors[0]}</p>;
}

function resolveInitialInquiry(service: string | null) {
  switch (service?.toLowerCase()) {
    case "notary":
      return "Texas notary service";

    case "consulting":
    case "str-consulting":
      return "STR consulting";

    case "cohosting":
    case "co-hosting":
    case "management":
      return "Co-hosting or property management";

    case "owner":
    case "owners":
      return "Owner partnership";

    case "stay":
    case "guest":
      return "Stay or guest inquiry";

    case "listing":
    case "optimization":
      return "Listing optimization";

    case "partnership":
      return "Partnership opportunity";

    default:
      return "STR consulting";
  }
}

export function ContactInquiryForm() {
  const searchParams = useSearchParams();

  const initialInquiryType = useMemo(
    () => resolveInitialInquiry(searchParams.get("service")),
    [searchParams],
  );

  const [inquiryType, setInquiryType] = useState(initialInquiryType);
  const [state, action] = useActionState(
    submitContactInquiry,
    initialState,
  );

  const isNotary = inquiryType === "Texas notary service";

  return (
    <form
      action={action}
      className="rounded-[2rem] border border-border bg-card p-6 md:p-8"
    >
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Inquiry details
        </p>

        <h2 className="mt-3 font-serif text-3xl">
          How can we help?
        </h2>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Choose the service that best matches your needs. The form will adapt
          so we can respond with the right information.
        </p>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Inquiry Type
        <select
          name="inquiryType"
          className={fieldClass}
          value={inquiryType}
          onChange={(event) => setInquiryType(event.target.value)}
        >
          {inquiryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <FieldError errors={state.fieldErrors?.inquiryType} />
      </label>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Name
          <input
            name="name"
            className={fieldClass}
            placeholder="Your name"
            autoComplete="name"
          />
          <FieldError errors={state.fieldErrors?.name} />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            className={fieldClass}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <FieldError errors={state.fieldErrors?.email} />
        </label>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Phone
          <span className="font-normal text-muted-foreground">
            {isNotary ? "required for notary service" : "optional"}
          </span>
          <input
            name="phone"
            type="tel"
            className={fieldClass}
            placeholder="(555) 000-0000"
            autoComplete="tel"
          />
          <FieldError errors={state.fieldErrors?.phone} />
        </label>

        {!isNotary ? (
          <label className="grid gap-2 text-sm font-medium">
            Property Market
            <span className="font-normal text-muted-foreground">
              optional
            </span>
            <input
              name="propertyMarket"
              className={fieldClass}
              placeholder="Mesa, Phoenix, Scottsdale..."
            />
            <FieldError errors={state.fieldErrors?.propertyMarket} />
          </label>
        ) : (
          <label className="grid gap-2 text-sm font-medium">
            Preferred Appointment Date
            <span className="font-normal text-muted-foreground">
              optional
            </span>
            <input
              name="preferredDate"
              type="date"
              className={fieldClass}
            />
            <FieldError errors={state.fieldErrors?.preferredDate} />
          </label>
        )}
      </div>

      {isNotary ? (
        <div className="mt-6 rounded-[1.5rem] border border-border bg-background/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Notary appointment
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Appointment Location
              <input
                name="appointmentLocation"
                className={fieldClass}
                placeholder="City, ZIP code, or Remote Online"
              />
              <FieldError
                errors={state.fieldErrors?.appointmentLocation}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Number of Signers
              <input
                name="signerCount"
                type="number"
                min="1"
                max="50"
                className={fieldClass}
                placeholder="1"
              />
              <FieldError errors={state.fieldErrors?.signerCount} />
            </label>
          </div>

          <label className="mt-5 grid gap-2 text-sm font-medium">
            General Document Type
            <input
              name="documentType"
              className={fieldClass}
              placeholder="Affidavit, power of attorney, real estate document..."
            />
            <FieldError errors={state.fieldErrors?.documentType} />
          </label>

          <div className="mt-5 rounded-2xl border border-amber-700/20 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
            For your privacy, do not enter Social Security numbers, driver’s
            license numbers, account numbers, door codes, complete document
            contents, or other sensitive personal information in this form.
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="preferredDate" value="" />
          <input type="hidden" name="appointmentLocation" value="" />
          <input type="hidden" name="documentType" value="" />
          <input type="hidden" name="signerCount" value="" />
        </>
      )}

      {isNotary ? (
        <input type="hidden" name="propertyMarket" value="" />
      ) : null}

      <label className="mt-5 grid gap-2 text-sm font-medium">
        Message
        <textarea
          name="message"
          className="min-h-40 rounded-2xl border border-border bg-background px-4 py-3 outline-none transition focus:border-accent"
          placeholder={
            isNotary
              ? "Share the preferred time, whether the document requires witnesses, and any accessibility or travel considerations."
              : "Tell us about your property, goals, dates, or questions."
          }
        />
        <FieldError errors={state.fieldErrors?.message} />
      </label>

      <SubmitButton>
        {isNotary ? "Request Notary Appointment" : "Submit Inquiry"}
      </SubmitButton>

      {state.message ? (
        <div
          role="status"
          className={
            state.ok
              ? "mt-5 rounded-2xl border border-green-700/20 bg-green-50 p-4 text-sm font-medium text-green-800"
              : "mt-5 rounded-2xl border border-red-700/20 bg-red-50 p-4 text-sm font-medium text-red-800"
          }
        >
          {state.message}
        </div>
      ) : null}

      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        Your information is used only to respond to your inquiry, coordinate
        requested services, and improve Luxe Haven follow-up.
      </p>
    </form>
  );
}
