export interface CanonicalAddress {
  readonly houseNumber: string;
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
}

const STREET_SUFFIXES: Readonly<Record<string, string>> = Object.freeze({
  alley: "aly", aly: "aly", avenue: "ave", ave: "ave", boulevard: "blvd", blvd: "blvd",
  circle: "cir", cir: "cir", court: "ct", ct: "ct", drive: "dr", dr: "dr",
  highway: "hwy", hwy: "hwy", lane: "ln", ln: "ln", parkway: "pkwy", pkwy: "pkwy",
  place: "pl", pl: "pl", road: "rd", rd: "rd", street: "st", st: "st",
  terrace: "ter", ter: "ter", trail: "trl", trl: "trl", way: "way",
});

const DIRECTIONALS: Readonly<Record<string, string>> = Object.freeze({
  north: "n", n: "n", south: "s", s: "s", east: "e", e: "e", west: "w", w: "w",
  northeast: "ne", ne: "ne", northwest: "nw", nw: "nw",
  southeast: "se", se: "se", southwest: "sw", sw: "sw",
});

export function canonicalAddress(value: string): CanonicalAddress | undefined {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim();
  const statePostal = normalized.match(/\b([a-z]{2})[\s,]+(\d{5})(?:-\d{4})?\s*$/i);
  if (!statePostal || statePostal.index === undefined) return undefined;
  const beforeState = normalized.slice(0, statePostal.index).replace(/[\s,]+$/, "");
  const parts = beforeState.split(/\s*,\s*/).filter(Boolean);
  if (parts.length < 2) return undefined;
  const streetInput = parts[0]!;
  const cityInput = parts.slice(1).join(" ");
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
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}
