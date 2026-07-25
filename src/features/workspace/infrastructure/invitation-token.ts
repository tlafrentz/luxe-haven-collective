import { createHash, randomBytes } from "node:crypto";

export function createWorkspaceInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return Object.freeze({
    token,
    hash: hashWorkspaceInvitationToken(token),
  });
}

export function hashWorkspaceInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
