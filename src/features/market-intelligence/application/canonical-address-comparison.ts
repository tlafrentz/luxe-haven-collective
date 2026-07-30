export interface CanonicalAddress {
  readonly houseNumber: string;
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
}

const STREET_SUFFIXES: Readonly<Record<string, string>> = Object.freeze({
  alley: "aly", avenue: "ave", boulevard: "blvd", circle: "cir", court: "ct",
  drive: "dr", highway: "hwy", lane: "ln", parkway: "pkwy", place: "pl",
  road: "rd", street: "st", terrace: "ter", trail: "trl", way: "way",
});

const DIRECTIONALS: Readonly<Record<string, string>> = Object.freeze({
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
});

export function canonicalAddress(value: string): CanonicalAddress | undefined {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return undefined;
  const streetInput = parts[0]!;
  const cityInput = parts[1]!;
  const statePostal = parts.slice(2).join(" ").match(/\b([a-z]{2})\s+(\d{5})(?:-\d{4})?\b/i);
  const houseNumber = streetInput.match(/^\s*(\d+[a-z]?(?:-\d+[a-z]?)?)\b/i)?.[1];
  if (!houseNumber || !cityInput || !statePostal) return undefined;

  return Object.freeze({
    houseNumber: normalizeToken(houseNumber),
    street: normalizeStreet(streetInput),
    city: normalizeWords(cityInput),
    state: statePostal[1]!.toUpperCase(),
    postalCode: statePostal[2]!,
  });
}

export function areCanonicalAddressesCompatible(requested: string, candidate: string): boolean {
  const left = canonicalAddress(requested);
  const right = canonicalAddress(candidate);
  return Boolean(left && right
    && left.houseNumber === right.houseNumber
    && left.street === right.street
    && left.city === right.city
    && left.state === right.state
    && left.postalCode === right.postalCode);
}

function normalizeStreet(value: string): string {
  return normalizeWords(value).split(" ")
    .map((part) => DIRECTIONALS[part] ?? STREET_SUFFIXES[part] ?? part)
    .join(" ");
}

function normalizeWords(value: string): string {
  return value.toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}
