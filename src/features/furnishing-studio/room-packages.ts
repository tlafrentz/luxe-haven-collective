export const PACKAGE_PRIORITIES = ["essential", "recommended", "optional"] as const;
export type PackagePriority = (typeof PACKAGE_PRIORITIES)[number];
export type PackageIssueSeverity = "blocking" | "warning" | "informational";

export type PackageBudgetLine = Readonly<{
  quantity: number;
  unitPriceMinor: number | null;
  deliveryMinor?: number;
  assemblyMinor?: number;
  installationMinor?: number;
  isAlternative?: boolean;
}>;

export function validatePackagePriority(value: string): PackagePriority {
  if (!PACKAGE_PRIORITIES.includes(value as PackagePriority))
    throw new Error("ROOM_PACKAGE_PRIORITY_INVALID");
  return value as PackagePriority;
}

export function validatePackageQuantity(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("ROOM_PACKAGE_QUANTITY_INVALID");
  return value;
}

export function calculatePackageBudget(
  lines: readonly PackageBudgetLine[],
  contingencyBasisPoints = 0,
) {
  const included = lines.filter((line) => !line.isAlternative);
  const productSubtotalMinor = included.reduce(
    (total, line) => total + (line.unitPriceMinor ?? 0) * line.quantity,
    0,
  );
  const deliveryMinor = included.reduce(
    (total, line) => total + (line.deliveryMinor ?? 0) * line.quantity,
    0,
  );
  const assemblyMinor = included.reduce(
    (total, line) => total + (line.assemblyMinor ?? 0) * line.quantity,
    0,
  );
  const installationMinor = included.reduce(
    (total, line) => total + (line.installationMinor ?? 0) * line.quantity,
    0,
  );
  const subtotal =
    productSubtotalMinor + deliveryMinor + assemblyMinor + installationMinor;
  const contingencyMinor = Math.round(
    (subtotal * Math.max(0, contingencyBasisPoints)) / 10_000,
  );
  return {
    productSubtotalMinor,
    deliveryMinor,
    assemblyMinor,
    installationMinor,
    contingencyMinor,
    estimatedTotalMinor: subtotal + contingencyMinor,
    missingPriceCount: included.filter((line) => line.unitPriceMinor === null)
      .length,
  };
}

export type CapacityFacts = Readonly<{
  maximumGuests: number;
  sleepingCapacity: number;
  diningSeats: number;
  livingSeats: number;
  towelSets?: number;
}>;

export function validateGuestCapacity(facts: CapacityFacts) {
  const issues: { code: string; severity: PackageIssueSeverity }[] = [];
  if (facts.sleepingCapacity < facts.maximumGuests)
    issues.push({ code: "SLEEPING_CAPACITY_INSUFFICIENT", severity: "blocking" });
  if (facts.diningSeats < facts.maximumGuests)
    issues.push({ code: "DINING_CAPACITY_INSUFFICIENT", severity: "warning" });
  if (facts.livingSeats < facts.maximumGuests)
    issues.push({ code: "LIVING_CAPACITY_INSUFFICIENT", severity: "warning" });
  if (facts.towelSets !== undefined && facts.towelSets < facts.maximumGuests)
    issues.push({ code: "TOWEL_CAPACITY_INSUFFICIENT", severity: "warning" });
  return issues;
}

export type TvMountItem = Readonly<{
  roomId: string;
  kind: "television" | "mount" | "other";
  tvSizeInches?: number | null;
  mountMinimumInches?: number | null;
  mountMaximumInches?: number | null;
  mountNotRequiredReason?: string | null;
}>;

export function validateTvMounts(items: readonly TvMountItem[]) {
  const issues: { code: string; roomId: string; severity: PackageIssueSeverity }[] = [];
  for (const television of items.filter((item) => item.kind === "television")) {
    const mounts = items.filter(
      (item) => item.kind === "mount" && item.roomId === television.roomId,
    );
    if (!mounts.length && !television.mountNotRequiredReason)
      issues.push({
        code: "TELEVISION_MOUNT_REQUIRED",
        roomId: television.roomId,
        severity: "blocking",
      });
    else if (
      television.tvSizeInches &&
      mounts.length &&
      !mounts.some(
        (mount) =>
          (mount.mountMinimumInches ?? 0) <= television.tvSizeInches! &&
          (mount.mountMaximumInches ?? Number.MAX_SAFE_INTEGER) >=
            television.tvSizeInches!,
      )
    )
      issues.push({
        code: "TELEVISION_MOUNT_INCOMPATIBLE",
        roomId: television.roomId,
        severity: "blocking",
      });
  }
  return issues;
}

export function canTransitionPackage(from: string, to: string) {
  return new Set([
    "draft:in_review",
    "in_review:draft",
    "in_review:approved",
    "approved:retired",
  ]).has(`${from}:${to}`);
}

export function comparePackageSnapshots(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ field: key, before: before[key], after: after[key] }));
}
