export type GuidebookInsertionResult = Readonly<{
  state: "inserted" | "unchanged" | "unavailable";
  body: string;
  focusTarget: "message-body" | "conversation-list";
}>;
export function buildGuidebookInsertionDraft(
  input: Readonly<{
    currentBody: string;
    requestedUrl?: string;
    publishedUrl?: string;
  }>,
): GuidebookInsertionResult {
  const current = input.currentBody.slice(0, 10_000),
    requested = input.requestedUrl?.trim(),
    published = input.publishedUrl?.trim();
  if (!requested)
    return Object.freeze({
      state: "unchanged",
      body: current,
      focusTarget: "message-body",
    });
  if (
    !published ||
    requested !== published ||
    !/^\/g\/[a-z0-9]{24,64}$/.test(published)
  )
    return Object.freeze({
      state: "unavailable",
      body: current,
      focusTarget: "conversation-list",
    });
  if (current.includes(published))
    return Object.freeze({
      state: "unchanged",
      body: current,
      focusTarget: "message-body",
    });
  const insertion = [current, "Guest guidebook:", published]
    .filter(Boolean)
    .join("\n\n");
  return Object.freeze({
    state: "inserted",
    body: insertion.slice(0, 10_000),
    focusTarget: "message-body",
  });
}
