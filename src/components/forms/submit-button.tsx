"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, dark = false }: { children: string; dark?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className={dark ? "mt-6 w-full rounded-full bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" : "mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"}
    >
      {pending ? "Submitting..." : children}
    </button>
  );
}
