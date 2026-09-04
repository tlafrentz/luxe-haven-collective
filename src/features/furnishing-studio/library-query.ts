export type LibraryFilterJoinInput = Readonly<{
  roomIds: readonly string[];
  styleIds: readonly string[];
  retailerIds: readonly string[];
  availability?: string;
}>;

/**
 * PostgREST only narrows the parent rows returned when a filtered embedded
 * resource is joined with `!inner` — without it, the embed is a left join
 * and every parent row is still returned (the filter just changes which
 * nested rows appear under it). `!inner` must be present in EVERY select
 * that applies the matching filter, including a head-only count query,
 * or PostgREST rejects the request outright (PGRST108: "not an embedded
 * resource in this request") if the filtered resource isn't embedded at
 * all in that select.
 */
export function libraryEmbedJoins(input: LibraryFilterJoinInput): Readonly<{ roomJoin: string; styleJoin: string; offerJoin: string }> {
  return {
    roomJoin: input.roomIds.length ? "!inner" : "",
    styleJoin: input.styleIds.length ? "!inner" : "",
    offerJoin: input.retailerIds.length || (input.availability && input.availability !== "archived") ? "!inner" : "",
  };
}
