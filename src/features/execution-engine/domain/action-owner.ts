export type ActionOwner = {
  type:
    | "user"
    | "team"
    | "automation"
    | "system";

  id: string;

  displayName: string;
};
