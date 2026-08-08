"use client";

import { useState } from "react";
import {
  Wifi,
  MapPin,
  Phone,
  ShieldAlert,
  LogOut,
  Copy,
  Check,
} from "lucide-react";
import type { PublicGuidebookView } from "@/features/guidebook-studio";

type ActionKey = "wifi" | "directions" | "contact" | "emergency" | "checkout";

export function GuestQuickActionsBar({
  guidebook,
  track,
}: {
  guidebook: PublicGuidebookView;
  track: (event: string, section: string, target: string) => void;
}) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  const [copied, setCopied] = useState<ActionKey | null>(null);

  const checkoutSection = guidebook.sections.find((section) =>
    /check.?out|departure/i.test(`${section.key} ${section.title}`),
  );

  const actions: {
    key: ActionKey;
    label: string;
    icon: React.ReactNode;
    available: boolean;
  }[] = [
    { key: "wifi" as ActionKey, label: "Wi-Fi", icon: <Wifi />, available: Boolean(guidebook.wifi) },
    {
      key: "directions" as ActionKey,
      label: "Directions",
      icon: <MapPin />,
      available: Boolean(guidebook.address),
    },
    {
      key: "contact" as ActionKey,
      label: "Contact",
      icon: <Phone />,
      available: Boolean(guidebook.hostContact),
    },
    {
      key: "emergency" as ActionKey,
      label: "Emergency",
      icon: <ShieldAlert />,
      available: Boolean(guidebook.emergencyContact),
    },
    {
      key: "checkout" as ActionKey,
      label: "Check-out",
      icon: <LogOut />,
      available: Boolean(guidebook.checkoutTime) || Boolean(checkoutSection),
    },
  ].filter((action) => action.available);

  if (!actions.length) return null;

  function copy(key: ActionKey, value: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    });
  }

  return (
    <>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-x-0 bottom-[4.5rem] z-[70] mx-auto max-w-md px-4"
        >
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
            {open === "wifi" && guidebook.wifi ? (
              <QuickActionPanel title="Wi-Fi">
                <p className="whitespace-pre-wrap text-sm text-stone-700">
                  {guidebook.wifi}
                </p>
                <CopyButton
                  copied={copied === "wifi"}
                  onClick={() => {
                    copy("wifi", guidebook.wifi!);
                    track("wifi-copy", "quick-actions", "wifi");
                  }}
                />
              </QuickActionPanel>
            ) : null}
            {open === "directions" && guidebook.address ? (
              <QuickActionPanel title="Directions">
                <p className="text-sm text-stone-700">{guidebook.address}</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(guidebook.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track("map-open", "quick-actions", "directions")}
                  className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[var(--guide-primary)] px-5 font-semibold text-white"
                >
                  Open in Maps ↗
                </a>
              </QuickActionPanel>
            ) : null}
            {open === "contact" && guidebook.hostContact ? (
              <QuickActionPanel title="Contact host">
                <a
                  href={`tel:${guidebook.hostContact}`}
                  onClick={() => track("phone-tap", "quick-actions", "contact")}
                  className="inline-flex min-h-11 items-center rounded-full bg-[var(--guide-primary)] px-5 font-semibold text-white"
                >
                  Call {guidebook.hostContact}
                </a>
              </QuickActionPanel>
            ) : null}
            {open === "emergency" && guidebook.emergencyContact ? (
              <QuickActionPanel title="Emergency">
                <p className="whitespace-pre-wrap text-sm text-stone-700">
                  {guidebook.emergencyContact}
                </p>
                <CopyButton
                  copied={copied === "emergency"}
                  onClick={() => {
                    copy("emergency", guidebook.emergencyContact!);
                    track("emergency-copy", "quick-actions", "emergency");
                  }}
                />
              </QuickActionPanel>
            ) : null}
            {open === "checkout" ? (
              <QuickActionPanel title="Check-out">
                {guidebook.checkoutTime ? (
                  <p className="text-sm text-stone-700">
                    Checkout time: <strong>{guidebook.checkoutTime}</strong>
                  </p>
                ) : null}
                {checkoutSection ? (
                  <a
                    href={`#${checkoutSection.key}`}
                    onClick={() => {
                      setOpen(null);
                      track("section-jump", "quick-actions", "checkout");
                    }}
                    className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[var(--guide-primary)] px-5 font-semibold text-white"
                  >
                    View check-out instructions ↓
                  </a>
                ) : null}
              </QuickActionPanel>
            ) : null}
          </div>
        </div>
      ) : null}
      <nav
        aria-label="Quick actions"
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-stone-200 bg-white/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {actions.map((action) => (
            <li key={action.key} className="flex-1">
              <button
                type="button"
                onClick={() => setOpen((current) => (current === action.key ? null : action.key))}
                aria-pressed={open === action.key}
                className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold [&_svg]:size-5 ${
                  open === action.key ? "text-[var(--guide-primary)]" : "text-stone-600"
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function QuickActionPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--guide-accent)]">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-stone-300 px-4 text-sm font-semibold"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
