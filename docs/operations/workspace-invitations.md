# Workspace invitation operations

Workspace invitations expire seven days after issue. Delivery uses the existing
transactional email adapter. If initial delivery fails, the newly created
invitation is cancelled so the product does not imply usable access.

Resend rotates the secure token, extends expiry, and preserves the approved role
and property scope. A repeated command ID and identical payload replays its
receipt; using that command ID for different input is rejected.

Pending invitations may be cancelled. Cancelled and accepted tokens are
invalidated and cannot be replayed. Expired invitations remain visible in
history and can be resent.

Material events create a safe access activity record and security-notification
outbox entry: invitation sent/accepted, role or property scope changed, member
suspended/restored/removed.

When investigating access:

1. confirm membership is Active;
2. confirm role policy version;
3. confirm All/Selected/None property mode;
4. inspect selected-property rows;
5. inspect recent access activity and notification delivery;
6. never request or log the raw invitation token.
