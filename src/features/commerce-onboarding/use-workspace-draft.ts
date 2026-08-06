"use client";

import { useEffect, useState } from "react";
import type { WorkspaceConfigAnswers } from "./types";

const SCHEMA_VERSION = "1";

type StoredDraft = {
  schemaVersion?: string;
  savedAt?: string;
  answers?: WorkspaceConfigAnswers;
};

function draftKeyFor(scope: string) {
  return `luxe-haven:${SCHEMA_VERSION}:commerce-workspace:${scope}`;
}

export function useWorkspaceDraft(scope: string) {
  const draftKey = draftKeyFor(scope);
  const [answers, setAnswers] = useState<WorkspaceConfigAnswers>({});
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const stored = JSON.parse(raw) as StoredDraft;
          if (stored.schemaVersion === SCHEMA_VERSION && stored.answers) {
            setAnswers(stored.answers);
          } else {
            window.localStorage.removeItem(draftKey);
            setAnswers({});
          }
        } else {
          setAnswers({});
        }
      } catch {
        window.localStorage.removeItem(draftKey);
      } finally {
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt, answers }),
        );
      } catch {
        // Autosave is best-effort; ignore storage failures (e.g. private browsing).
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [answers, draftReady, draftKey]);

  function clearDraft() {
    setAnswers({});
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }

  return { answers, setAnswers, draftReady, clearDraft, draftKey };
}
