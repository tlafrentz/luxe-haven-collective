"use client";

import { useEffect, useState } from "react";
import type { QuizAnswers } from "./scoring";

const DRAFT_KEY = "luxe-haven:best-fit-quiz.v1";
const SCHEMA_VERSION = "1";

type StoredDraft = {
  schemaVersion?: string;
  savedAt?: string;
  answers?: QuizAnswers;
};

export function useQuizDraft() {
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as StoredDraft;
          if (stored.schemaVersion === SCHEMA_VERSION && stored.answers) {
            setAnswers(stored.answers);
          } else {
            window.localStorage.removeItem(DRAFT_KEY);
          }
        }
      } catch {
        window.localStorage.removeItem(DRAFT_KEY);
      } finally {
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt, answers }),
        );
      } catch {
        // Autosave is best-effort; ignore storage failures (e.g. private browsing).
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [answers, draftReady]);

  function resetDraft() {
    setAnswers({});
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  return { answers, setAnswers, draftReady, resetDraft };
}
