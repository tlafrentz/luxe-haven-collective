"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  saveGuestCommunicationDraft,
  sendGuestCommunicationReplyAction,
  type GuestCommunicationComposerState,
} from "@/app/actions/guest-communications";

type Template = Readonly<{
  id: string;
  title: string;
  body: string;
  variables: readonly string[];
}>;

type GuestMessageComposerProps = {
  conversationId: string;
  initialBody?: string;
  initialTemplateId?: string;
  templates: readonly Template[];
  values: Readonly<Record<string, string>>;
  disabled?: boolean;
  focusOnMount?: boolean;
};

const initial: GuestCommunicationComposerState = {
  ok: false,
  message: "",
};

export function GuestMessageComposer({
  conversationId,
  initialBody = "",
  initialTemplateId = "",
  templates,
  values,
  disabled = false,
  focusOnMount = false,
}: GuestMessageComposerProps) {
  const storageKey = `guest-communication-draft:${conversationId}`;
  const scrollKey = `guest-communication-scroll:${conversationId}`;

  const [body, setBody] = useState(initialBody);
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [saveState, setSaveState] = useState("Saved");

  const [sendState, sendAction, pending] = useActionState(
    sendGuestCommunicationReplyAction,
    initial,
  );

  const hydrated = useRef(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (focusOnMount) bodyRef.current?.focus();
  }, [focusOnMount]);
  useEffect(() => {
    const localDraft = localStorage.getItem(storageKey);
    const position = Number(sessionStorage.getItem(scrollKey));

    if (Number.isFinite(position)) {
      window.scrollTo({ top: position });
    }

    const hydrationTimer = window.setTimeout(() => {
      if (localDraft && !initialBody) {
        setBody(localDraft);
      }

      hydrated.current = true;
    }, 0);

    const rememberScrollPosition = () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };

    window.addEventListener("scroll", rememberScrollPosition, {
      passive: true,
    });

    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("scroll", rememberScrollPosition);
    };
  }, [initialBody, scrollKey, storageKey]);

  useEffect(() => {
    if (!hydrated.current || disabled) {
      return;
    }

    localStorage.setItem(storageKey, body);

    const timer = window.setTimeout(async () => {
      const data = new FormData();

      data.set("conversationId", conversationId);
      data.set("body", body);

      if (templateId) {
        data.set("templateId", templateId);
      }

      const result = await saveGuestCommunicationDraft(initial, data);

      setSaveState(result.ok ? "Draft saved" : "Saved locally");
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [body, conversationId, disabled, storageKey, templateId]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    setSaveState("Saving…");

    const template = templates.find((item) => item.id === id);

    if (!template) {
      return;
    }

    const resolvedBody = template.body.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => values[key]?.trim() || `{{${key}}}`,
    );

    setBody(resolvedBody);
  }

  function handleBodyChange(value: string) {
    setBody(value);
    setSaveState("Saving…");
  }

  function handleSubmit() {
    localStorage.removeItem(storageKey);
  }

  return (
    <form
      action={sendAction}
      className="mt-4 space-y-3"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="conversationId" value={conversationId} />

      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <label className="block text-sm font-medium">
        Template
        <select
          name="templateId"
          value={templateId}
          onChange={(event) => applyTemplate(event.target.value)}
          disabled={disabled}
          className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2"
        >
          <option value="">Start without a template</option>

          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Reply
        <textarea
          ref={bodyRef}
          required
          name="body"
          value={body}
          onChange={(event) => handleBodyChange(event.target.value)}
          rows={7}
          maxLength={10000}
          disabled={disabled}
          className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2 disabled:bg-stone-100"
          placeholder="Write a reply or adapt a template…"
          aria-describedby="draft-status"
        />
      </label>

      {templateId ? (
        <section
          aria-label="Message preview"
          className="rounded-xl border border-stone-200 bg-stone-50 p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Reviewed preview
          </p>

          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">
            {body || "The resolved message will appear here."}
          </p>

          <p className="mt-3 text-xs text-stone-500">
            Delivery: Immediate · Attachments: None · The exact reviewed text
            above becomes the immutable message.
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          id="draft-status"
          aria-live="polite"
          className="text-xs text-stone-500"
        >
          {disabled ? "Read-only access" : saveState}
        </span>

        <button
          disabled={disabled || pending || !body.trim()}
          className="rounded-xl bg-stone-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Sending…" : "Send reply"}
        </button>
      </div>

      {sendState.message ? (
        <p
          role={sendState.ok ? "status" : "alert"}
          className={`rounded-lg p-3 text-sm ${
            sendState.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {sendState.message}
        </p>
      ) : null}
    </form>
  );
}
