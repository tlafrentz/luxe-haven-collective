"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { requestManualProviderSetupAction } from "@/app/actions/workspace-setup";

const providers = [
  { id: "airbnb", name: "Airbnb", recommended: true },
  { id: "vrbo", name: "Vrbo", recommended: false },
  { id: "guesty", name: "Guesty", recommended: false },
  { id: "hostaway", name: "Hostaway", recommended: false },
  { id: "hospitable", name: "Hospitable", recommended: false },
  { id: "manual", name: "Other / Manual", recommended: false },
] as const;

export function ProviderPicker({ alreadyRequested }: { alreadyRequested: boolean }) {
  const [selected, setSelected] = useState<string | null>(alreadyRequested ? "manual" : null);
  const [confirmed, setConfirmed] = useState(alreadyRequested);
  const [pending, startTransition] = useTransition();

  function choose(providerId: string) {
    setSelected(providerId);
    startTransition(async () => {
      await requestManualProviderSetupAction(providerId);
      setConfirmed(true);
    });
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-emerald-700" aria-hidden />
        <h2 className="mt-3 font-semibold text-emerald-950">We&apos;ll set this up with you.</h2>
        <p className="mt-2 text-sm text-emerald-900">
          Our team will follow up to connect{" "}
          {selected ? providers.find((p) => p.id === selected)?.name : "your platform"} securely. In the
          meantime, you can add properties manually.
        </p>
        <Link
          href="/dashboard/setup/import"
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-stone-950 px-6 text-sm font-semibold text-white"
        >
          Continue →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600">
        We never post or make changes. Choosing a platform below starts a secure, human-assisted connection
        &mdash; we won&apos;t access your account without you.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={pending}
            onClick={() => choose(provider.id)}
            className="relative rounded-xl border border-stone-200 bg-white p-5 text-left font-semibold text-stone-900 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {provider.recommended ? (
              <span className="absolute right-3 top-3 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">
                Recommended
              </span>
            ) : null}
            {pending && selected === provider.id ? "Connecting…" : `Connect ${provider.name}`}
          </button>
        ))}
      </div>
    </div>
  );
}
