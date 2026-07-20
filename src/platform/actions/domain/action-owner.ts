export type ActionOwnerType = "user" | "team" | "automation" | "system";
export type ActionOwner = Readonly<{
  type: ActionOwnerType;
  id: string;
  displayName: string;
}>;
