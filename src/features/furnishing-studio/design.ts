export const STYLE_COMPATIBILITY = [
  "preferred",
  "compatible",
  "neutral",
  "avoid",
] as const;
export type StyleCompatibility = (typeof STYLE_COMPATIBILITY)[number];

export function compatibilityRank(value: StyleCompatibility | null) {
  return value === "preferred"
    ? 0
    : value === "compatible"
      ? 1
      : value === "neutral"
        ? 2
        : value === "avoid"
          ? 3
          : 4;
}

export function orderProductsForStyle<
  T extends Readonly<{
    compatibility: StyleCompatibility | null;
    name: string;
  }>,
>(products: readonly T[]) {
  return [...products].sort(
    (a, b) =>
      compatibilityRank(a.compatibility) - compatibilityRank(b.compatibility) ||
      a.name.localeCompare(b.name),
  );
}

export function inheritedRoomDirection<
  T extends Readonly<{
    moodTags: readonly string[];
    contextualTags: readonly string[];
    tokenIds: readonly string[];
  }>,
>(
  profile: T,
  room: Readonly<{
    moodTags?: readonly string[] | null;
    contextualTags?: readonly string[] | null;
    accentTokenIds?: readonly string[] | null;
  }> | null,
) {
  return {
    moodTags: room?.moodTags?.length ? room.moodTags : profile.moodTags,
    contextualTags: room?.contextualTags?.length
      ? room.contextualTags
      : profile.contextualTags,
    tokenIds: room?.accentTokenIds?.length
      ? room.accentTokenIds
      : profile.tokenIds,
    inherited:
      !room?.moodTags?.length &&
      !room?.contextualTags?.length &&
      !room?.accentTokenIds?.length,
  };
}

export function designReview(
  input: Readonly<{
    assignments: readonly Readonly<{
      compatibility: StyleCompatibility | null;
    }>[];
    rooms: readonly Readonly<{ hasDirection: boolean }>[];
    accentTokenCount: number;
    conflictingWoodToneRooms?: number;
  }>,
) {
  const issues: string[] = [];
  const avoid = input.assignments.filter(
      (x) => x.compatibility === "avoid",
    ).length,
    unclassified = input.assignments.filter(
      (x) => x.compatibility === null,
    ).length,
    missingRooms = input.rooms.filter((x) => !x.hasDirection).length;
  if (avoid) issues.push(`${avoid} products classified Avoid`);
  if (unclassified) issues.push(`${unclassified} products unclassified`);
  if (missingRooms)
    issues.push(`${missingRooms} rooms have no design direction`);
  if (!input.accentTokenCount) issues.push("No accent token selected");
  if (input.conflictingWoodToneRooms)
    issues.push(
      `${input.conflictingWoodToneRooms} rooms may have conflicting wood tones`,
    );
  return issues;
}

export function styleCoverage(
  assignments: readonly Readonly<{ compatibility: StyleCompatibility }>[],
  totalProducts: number,
) {
  const counts = {
    preferred: 0,
    compatible: 0,
    neutral: 0,
    avoid: 0,
    unclassified: Math.max(0, totalProducts - assignments.length),
  };
  for (const item of assignments) counts[item.compatibility]++;
  return counts;
}
